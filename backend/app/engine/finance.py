"""Bill and savings model for the user's regime (PRD 10.6). Deterministic; no LLM numbers."""
from datetime import date

from ..schemas import Bill, Profile
from .data import regulatory


def select_regime(profile: Profile) -> tuple[str, int | None]:
    """Return (regime_id, legacy_expiry_year)."""
    reg = regulatory()
    d = profile.net_metering_agreement_date
    if d and d < reg["net_billing_start_date"]:
        y = int(d[:4]) + reg["regimes"]["LEGACY_NET_METERING"]["agreement_term_years"]
        return "LEGACY_NET_METERING", y
    return "NET_BILLING_2026", None


def effective_rate(bill: Bill | None) -> tuple[float, str]:
    """Effective variable import price (Rs/unit). Prefer the user's own bill (PRD 9.3)."""
    reg = regulatory()
    if bill and bill.current_units and bill.current_units > 0:
        variable = None
        if bill.energy_charges_rs:
            variable = bill.energy_charges_rs + (bill.fpa_rs or 0) + (bill.taxes_rs or 0)
        elif bill.total_amount_rs:
            variable = bill.total_amount_rs - (bill.fixed_charges_rs or 0)
        if variable and variable > 0:
            r = variable / bill.current_units
            if 5 < r < 120:
                return round(r, 1), "your bill"
    if bill and bill.protected:
        p = reg["protected"]
        return (p["rate_rs_low"] + p["rate_rs_high"]) / 2, "protected tariff estimate"
    return reg["non_protected_effective_rate_rs"]["typical"], "typical non-protected rate (no bill)"


def fixed_charge(bill: Bill | None) -> float:
    if bill and bill.fixed_charges_rs:
        return bill.fixed_charges_rs
    fc = regulatory()["fixed_charges_rs"]
    key = "protected" if bill and bill.protected else "non_protected"
    return (fc[key]["low"] + fc[key]["high"]) / 2


def month_bill(import_u: float, export_u: float, *, rate: float, fixed: float, regime: str,
               buyback: float, credit_in: float = 0.0) -> tuple[float, float]:
    """Return (bill_rs, carried_credit_units)."""
    if regime == "LEGACY_NET_METERING":
        net = import_u - export_u - credit_in
        if net < 0:
            return fixed, -net
        return fixed + net * rate, 0.0
    return fixed + import_u * rate - export_u * buyback, 0.0


def annual_bill(monthly_import: list[float], monthly_export: list[float], **kw) -> float:
    total, credit = 0.0, 0.0
    for i, e in zip(monthly_import, monthly_export):
        b, credit = month_bill(i, e, credit_in=credit, **kw)
        total += b
    return total


def cashflow(*, capex: float, annual_saving_by_regime: dict, regime: str, legacy_expiry: int | None,
             inverter_cost: float, battery_cost: float, battery_life_years: int = 10,
             degradation: float = 0.005, years: int = 25) -> dict:
    this_year = date.today().year
    cum = -capex
    series, payback = [], None
    for y in range(1, years + 1):
        r = regime
        if regime == "LEGACY_NET_METERING" and legacy_expiry and this_year + y > legacy_expiry:
            r = "NET_BILLING_2026"
        s = annual_saving_by_regime[r] * (1 - degradation) ** (y - 1)
        cost = 0.0
        if y == 11:
            cost += inverter_cost
        if battery_cost and y % battery_life_years == 0 and y < years:
            cost += battery_cost
        prev = cum
        cum += s - cost
        if payback is None and cum >= 0 and prev < 0:
            payback = round(y - 1 + (-prev) / max(s - cost, 1), 1)
        series.append({"year": y, "saving": round(s), "extra_cost": round(cost), "cumulative": round(cum)})
    return {"payback_years": payback, "cum_10y": series[9]["cumulative"], "cum_25y": series[-1]["cumulative"],
            "series": series}
