"""Additional journeys (PRD 9.8): quote comparison, existing-system health check, financing check."""
from typing import Literal, Optional

import numpy as np
from pydantic import BaseModel, Field

from .pv import simulate_pv

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ---------- multi-quote comparison (normalised basis, PRD 4.3 / 9.1) ----------
def compare(reports: list[tuple[str, dict, dict]]) -> dict:
    """reports: [(id, request, report)] -> normalised table + plain-language highlights."""
    rows = []
    for rid, req, rep in reports:
        s = rep["system_summary"]
        fin = rep.get("finance") or {}
        cf = rep.get("cashflow") or {}
        items = (req.get("quote") or {}).get("line_items") or []
        def line_total(t):
            return sum((li.get("line_total") or (li.get("quantity") or 1) * (li.get("unit_price") or 0)) for li in items if li.get("item_type") == t)
        panel_rs, batt_rs = line_total("panel"), line_total("battery")
        dc_w = (s.get("dc_kwp") or 0) * 1000
        rows.append({
            "id": rid,
            "title": (req.get("quote") or {}).get("installer_name") or f"Report {rid[:6]}",
            "mode": rep.get("mode", "full"),
            "total_rs": rep.get("capex") or None,
            "dc_kwp": s.get("dc_kwp"), "inverter_kw": s.get("inverter_kw"), "inverter_type": s.get("inverter_type"),
            "battery_usable_kwh": s.get("battery_usable_kwh") or 0,
            "rs_per_w_system": round(rep["capex"] / dc_w, 1) if rep.get("capex") and dc_w else None,
            "rs_per_w_panels": round(panel_rs / dc_w, 1) if panel_rs and dc_w else None,
            "rs_per_usable_kwh_battery": round(batt_rs / s["battery_usable_kwh"]) if batt_rs and s.get("battery_usable_kwh") else None,
            "savings_monthly": fin.get("savings_monthly"), "payback_years": cf.get("payback_years"),
            "net_10y": cf.get("cum_10y"), "critical": rep["counts"]["critical"], "clarify": rep["counts"]["clarify"],
            "verdict": rep["verdict"], "works_in_outage": rep["backup"]["works_in_outage"],
            "backup_hours": rep["backup"].get("hours_on_battery") or 0,
            "critical_titles": [f["title"] for f in rep["findings"] if f["severity"] == "CRITICAL"],
        })
    notes = []
    if len(rows) >= 2:
        def best(key, low=True):
            vals = [(r[key], r["title"]) for r in rows if r.get(key) is not None]
            return (min if low else max)(vals) if vals else None
        if (b := best("rs_per_w_system")):
            notes.append(f"Lowest price per watt: {b[1]} (Rs {b[0]}/W for the whole system).")
        safest = sorted(rows, key=lambda r: (r["critical"], r["clarify"]))[0]
        notes.append(f"Fewest problems found: {safest['title']} ({safest['critical']} critical, {safest['clarify']} to clarify).")
        if any(r["works_in_outage"] for r in rows) and not all(r["works_in_outage"] for r in rows):
            notes.append("Only some of these quotes give backup during load-shedding; compare like with like.")
        if (b := best("payback_years")):
            notes.append(f"Fastest expected payback: {b[1]} (~{b[0]} years).")
        sizes = [r["dc_kwp"] for r in rows if r["dc_kwp"]]
        if sizes and max(sizes) > 1.4 * min(sizes):
            notes.append("System sizes differ a lot; a cheaper total may simply mean fewer panels. Compare Rs/W and savings, not just totals.")
    return {"rows": rows, "notes": notes,
            "note": "All quotes are compared on the same basis: price per watt (DC), price per usable kWh of battery, the same tariff and the same household."}


# ---------- existing system health check (PRD 9.8, P1) ----------
class Reading(BaseModel):
    month: int = Field(ge=1, le=12)
    kwh: float = Field(ge=0, le=100000, description="Solar units generated in that month (from the inverter app or a generation meter)")


class HealthIn(BaseModel):
    city: str
    dc_kw: float = Field(gt=0, le=1000)
    inverter_kw: Optional[float] = Field(None, gt=0, le=1000)
    inverter_type: Literal["on_grid", "hybrid", "off_grid"] = "hybrid"
    tilt: float = Field(20, ge=0, le=90)
    azimuth: float = Field(180, ge=0, le=360)
    readings: list[Reading] = Field(min_length=1, max_length=12)
    bill_not_dropping: bool = False
    has_battery: bool = False
    zero_export: bool = False
    outage_hours_per_day: float = Field(0, ge=0, le=24)


def health_check(h: HealthIn) -> dict:
    sim = simulate_pv(h.city, h.dc_kw, h.inverter_kw, h.tilt, h.azimuth)
    monthly = sim["pv_kw"].groupby(sim.index.month).sum()
    rows, ratios = [], []
    for r in h.readings:
        exp = float(monthly.get(r.month, 0))
        low, high = exp * 0.85, exp * 1.05   # 15% below expected still counts as normal (weather, dust)
        ratio = r.kwh / exp if exp else None
        status = "good" if ratio is not None and r.kwh >= low else ("low" if ratio is not None and ratio >= 0.6 else "very_low")
        rows.append({"month": MONTHS[r.month - 1], "actual": round(r.kwh), "expected": round(exp),
                     "expected_low": round(low), "expected_high": round(high), "ratio": round(ratio, 2) if ratio else None,
                     "status": status})
        if ratio is not None:
            ratios.append(ratio)
    avg = float(np.mean(ratios)) if ratios else None
    verdict = "healthy" if avg and avg >= 0.85 else ("underperforming" if avg and avg >= 0.6 else "seriously_low")
    causes = []
    if verdict != "healthy":
        causes += [
            "Dust: panels in Pakistan can lose 5-25% between cleanings. Clean early morning with plain water and a soft brush.",
            "Shade: new buildings, trees or water tanks shading part of the array at some hours.",
            "A faulty string, connector or MPPT input: check that each MPPT shows power in the inverter app on a sunny day.",
        ]
        if h.zero_export:
            causes.append("Zero-export / export limit is on: when your home uses little power the inverter throttles the panels. "
                          "This is expected without net billing, and shows as lower generation.")
        if h.inverter_kw and h.dc_kw > h.inverter_kw * 1.3:
            causes.append("The array is much larger than the inverter, so midday output is clipped at the inverter limit.")
        if h.outage_hours_per_day and h.inverter_type == "on_grid":
            causes.append("On-grid inverters switch off during load-shedding, so outage hours produce nothing.")
    settings = []
    if h.inverter_type in ("hybrid", "off_grid"):
        settings += [
            "Output priority: use 'Solar first' (SUB/SBU style) during the day so solar runs the house before the grid.",
            "Grid charging of the battery: turn it OFF (or limit it to load-shedding preparation). Charging from the grid at night "
            "costs full tariff and makes the bill go up.",
            "Battery discharge cut-off (SOC): keep a reserve for load-shedding, but not so high that the battery never helps in the evening.",
            "Check the time and date on the inverter: wrong time breaks time-based settings.",
        ]
    if h.bill_not_dropping:
        settings.append("If your bill did not drop: compare units 'imported' on the bill with your evening use. Under net billing, "
                        "evening use (ACs, lights) still comes from the grid unless you have a battery.")
    return {"verdict": verdict, "average_ratio": round(avg, 2) if avg else None, "rows": rows, "possible_causes": causes,
            "settings_checklist": settings,
            "note": "Expected generation uses PVGIS typical-year weather for your city with ~15% system losses. "
                    "Ask your installer to verify settings; never open the inverter or DC wiring yourself."}


# ---------- financing check: instalment vs saving (PRD 9.8, P1) ----------
class FinanceIn(BaseModel):
    amount_rs: float = Field(gt=0, le=100_000_000)
    markup_pct: float = Field(ge=0, le=60)
    months: int = Field(ge=1, le=120)
    down_payment_rs: float = Field(0, ge=0)
    savings_low: Optional[float] = Field(None, ge=0)
    savings_expected: Optional[float] = Field(None, ge=0)


def financing(f: FinanceIn) -> dict:
    principal = max(0.0, f.amount_rs - f.down_payment_rs)
    r = f.markup_pct / 100 / 12
    emi = principal / f.months if r == 0 else principal * r * (1 + r) ** f.months / ((1 + r) ** f.months - 1)
    total = emi * f.months
    out = {"principal": round(principal), "instalment": round(emi), "total_paid": round(total + f.down_payment_rs),
           "total_markup": round(total - principal)}
    if f.savings_expected is not None:
        low = f.savings_low if f.savings_low is not None else f.savings_expected
        out["gap_expected"] = round(f.savings_expected - emi)
        out["gap_conservative"] = round(low - emi)
        out["verdict"] = ("covered" if low >= emi else "mostly_covered" if f.savings_expected >= emi else "not_covered")
        out["message"] = {
            "covered": "Even in the conservative case your monthly saving covers the instalment.",
            "mostly_covered": "Expected savings cover the instalment, but in a bad month (dust, haze, rule changes) you may pay extra.",
            "not_covered": "The instalment is higher than your expected saving; you will pay more each month until the loan ends.",
        }[out["verdict"]]
    return out
