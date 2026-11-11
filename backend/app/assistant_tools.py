"""Functions the assistant may call. They run Roshni's deterministic engine; Gemini only passes inputs and explains results.

Each returns a small, JSON-friendly dict. Errors come back as {"error": "..."} so the model can ask the user for what is missing.
"""
from functools import wraps
from typing import Optional

from . import db
from .engine import extras
from .engine.audit import battery_options
from .engine.data import cities
from .engine.sizing import SizeReq, size_solar
from .engine.readiness import ReadinessIn, check as readiness_check
from .schemas import AC, Bill, Profile


def _safe(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        try:
            return fn(*a, **kw)
        except Exception as e:  # tool errors go back to the model, never to a 500
            return {"error": str(e)[:300]}
    return wrapper


def _battery(city, solar_kw, inverter_kw, inverter_type, outage_hours, ac_count, ac_tons, history):
    if city not in cities():
        return {"error": f"Unsupported city. Choose one of: {', '.join(list(cities()))}"}
    prof = Profile(city=city, outage_hours_per_day=outage_hours, acs=[AC(count=ac_count, tons=ac_tons)] if ac_count else [])
    bill = Bill(monthly_units_history=history[-12:], current_units=history[-1]) if history else None
    r = battery_options(prof, bill, dc_kw=solar_kw, inverter_kw=inverter_kw, inverter_type=inverter_type)
    return {"regime": r["regime"], "needs_inverter_change": r["needs_inverter_change"], "note": r["note"],
            "options": [{"usable_kwh": o["usable_kwh"], "monthly_saving_expected_rs": o["savings_monthly"]["expected"],
                         "extra_saving_vs_no_battery_rs": o["extra_saving_monthly"], "indicative_cost_rs": o["indicative_cost_rs"],
                         "simple_payback_years": o["simple_payback_years"], "backup_hours": o["backup_hours"]}
                        for o in r["options"]]}


@_safe
def battery_for_existing_system(city: str, solar_kw: float, inverter_kw: float, inverter_type: str = "on_grid",
                                outage_hours_per_day: float = 4, ac_count: int = 0, ac_tons: float = 1.5,
                                monthly_units_history: Optional[list[float]] = None) -> dict:
    """Compare adding 0, 5, 10 or 15 kWh of battery to an existing solar system. city must be a supported Pakistani city.
    inverter_type is on_grid or hybrid. monthly_units_history is the last 12 monthly bill units, oldest first (optional)."""
    return _battery(city, solar_kw, inverter_kw, inverter_type, outage_hours_per_day, ac_count, ac_tons, monthly_units_history)


@_safe
def battery_for_report(report_id: str) -> dict:
    """Run the battery comparison using the system, household profile and bill stored in one of the user's reports."""
    row = db.get_report(report_id)
    if not row:
        return {"error": "Report not found."}
    req, rep = row
    s = rep["system_summary"]
    if not s.get("inverter_kw"):
        return {"error": "That report has no inverter size, so a battery comparison is not possible."}
    p = req["profile"]
    acs = p.get("acs") or []
    return _battery(p["city"], s["dc_kwp"], s["inverter_kw"], "on_grid" if s["inverter_type"] == "on_grid" else "hybrid",
                    p.get("outage_hours_per_day", 4), sum(a.get("count", 0) for a in acs), acs[0].get("tons", 1.5) if acs else 1.5,
                    (req.get("bill") or {}).get("monthly_units_history") or None)


@_safe
def loan_vs_savings(amount_rs: float, markup_pct_per_year: float, months: int, down_payment_rs: float = 0,
                    monthly_saving_rs: Optional[float] = None) -> dict:
    """Monthly instalment of a solar loan and whether the user's monthly saving covers it."""
    return extras.financing(extras.FinanceIn(amount_rs=amount_rs, markup_pct=markup_pct_per_year, months=months,
                                             down_payment_rs=down_payment_rs, savings_expected=monthly_saving_rs,
                                             savings_low=monthly_saving_rs))


@_safe
def solar_readiness(owns_home: bool, avg_monthly_units: float, roof_area_sqft: Optional[float] = None,
                    shade: str = "none", protected: bool = False, budget_lakh: Optional[float] = None) -> dict:
    """Quick check whether solar makes sense now. shade is none, some or heavy."""
    return readiness_check(ReadinessIn(owns_home=owns_home, landlord_permission=owns_home, avg_monthly_units=avg_monthly_units,
                                       roof_area_sqft=roof_area_sqft, shade=shade, protected=protected, budget_lakh=budget_lakh))


@_safe
def compare_my_reports(report_ids: list[str]) -> dict:
    """Compare 2 to 4 saved reports on one basis (price per watt, savings, payback, critical issues)."""
    found = []
    for rid in dict.fromkeys(report_ids):
        row = db.get_report(rid)
        if row:
            found.append((rid, row[0], row[1]))
    if len(found) < 2:
        return {"error": "Need at least two valid report ids."}
    out = extras.compare(found)
    keys = ("title", "total_rs", "dc_kwp", "rs_per_w_system", "savings_monthly", "payback_years", "critical", "clarify", "works_in_outage")
    return {"rows": [{k: r[k] for k in keys} for r in out["rows"]], "notes": out["notes"]}


@_safe
def size_my_solar(city: str, avg_monthly_units: float, ac_count: int = 0, ac_tons: float = 1.5, outage_hours_per_day: float = 4,
                  budget_rs: Optional[float] = None, goal: str = "both") -> dict:
    """Suggest solar system sizes (on-grid, hybrid with 5 or 10 kWh battery) with cost ranges, monthly saving, payback and backup
    hours for a household. goal is bill, backup or both. city must be a supported Pakistani city."""
    if city not in cities():
        return {"error": f"Unsupported city. Choose one of: {', '.join(list(cities()))}"}
    prof = Profile(city=city, outage_hours_per_day=outage_hours_per_day, acs=[AC(count=ac_count, tons=ac_tons)] if ac_count else [])
    bill = Bill(current_units=avg_monthly_units, monthly_units_history=[avg_monthly_units] * 12)
    r = size_solar(SizeReq(profile=prof, bill=bill, budget_rs=budget_rs, goal=goal))
    return {"bill_today_monthly_rs": r["summary"]["bill_today_monthly_rs"], "regime": r["summary"]["regime"],
            "options": [{"name": o["name"], "solar_kw": o["dc_kw"], "inverter_kw": o["inverter_kw"], "battery_kwh": o["battery_kwh"],
                         "cost_low_rs": o["cost"]["low"], "cost_high_rs": o["cost"]["high"],
                         "monthly_saving_expected_rs": o["savings_monthly"]["expected"], "payback_years": o["payback_years"],
                         "backup_hours": o["backup_hours"], "within_budget": o["within_budget"]} for o in r["options"]],
            "note": "Indicative component price ranges, not quotes. Brands are not ranked; see the /size page for brand facts and checks."}


TOOLS = [size_my_solar, battery_for_existing_system, battery_for_report, loan_vs_savings, solar_readiness, compare_my_reports]
