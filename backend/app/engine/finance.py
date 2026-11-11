"""Bill and savings model for the user's regime (PRD 10.6). Deterministic; no LLM numbers.

Uses the official domestic slab tariff (S.R.O. 279(I)/2026):
  - unprotected: every unit billed at the rate of the slab the monthly total falls in (single slab)
  - protected (<= 200 units): one-previous-slab benefit
  - fixed charge: Rs per kW of sanctioned load per month, by slab
Taxes, FPA/QTA and duties are applied as one multiplier calibrated from the user's own bill.
"""
from dataclasses import dataclass
from datetime import date

from ..schemas import Bill, Profile
from .data import regulatory


def select_regime(profile: Profile) -> tuple[str, int | None]:
    """Return (regime_id, legacy_expiry_year)."""
    reg = regulatory()
    d = profile.net_metering_agreement_date
    if d and d < reg["net_billing_start_date"]:
        y = int(d[:4]) + reg["regimes"]["LEGACY_NET_METERING"]["agreement_term_years"]
        if y > date.today().year or (y == date.today().year and d[5:] > date.today().isoformat()[5:]):
            return "LEGACY_NET_METERING", y
        # Agreement already expired: renewals are under the 2026 regulations (net billing)
        return "NET_BILLING_2026", None
    return "NET_BILLING_2026", None


def _slab(table: list[dict], units: float) -> dict:
    for s in table:
        if s["upto"] is None or units <= s["upto"]:
            return s
    return table[-1]


@dataclass
class Tariff:
    protected: bool
    sanctioned_kw: float
    factor: float  # taxes + adjustments multiplier
    source: str

    def base(self, units: float) -> tuple[float, float]:
        """(energy_rs, fixed_rs) before taxes for one month."""
        t = regulatory()["domestic_tariff"]
        units = max(0.0, units)
        if self.protected and units <= regulatory()["protected"]["threshold_units"]:
            p = t["protected"]
            energy = min(units, 100) * p[0]["rate"] + max(0.0, units - 100) * p[1]["rate"]
            fixed = _slab(p, units)["fixed_per_kw"] * self.sanctioned_kw if units > 0 else 0.0
        else:
            s = _slab(t["unprotected"], units)
            energy = units * s["rate"]
            fixed = s["fixed_per_kw"] * self.sanctioned_kw
        return energy, fixed

    def month_cost(self, units: float) -> float:
        e, f = self.base(units)
        return (e + f) * self.factor

    def fixed_cost(self, units: float) -> float:
        return self.base(units)[1] * self.factor

    def avg_rate(self, units: float) -> float:
        return self.month_cost(units) / units if units > 0 else 0.0

    def as_unprotected(self) -> "Tariff":
        return Tariff(False, self.sanctioned_kw, self.factor, self.source)


def make_tariff(bill: Bill | None) -> Tariff:
    """Build the user's tariff, calibrating taxes/adjustments from their own bill (PRD 9.3)."""
    t = regulatory()["domestic_tariff"]
    protected = bool(bill and bill.protected)
    kw = (bill.sanctioned_load_kw if bill and bill.sanctioned_load_kw else None)
    if not kw and bill and bill.fixed_charges_rs and bill.current_units:
        per_kw = _slab(t["protected" if protected else "unprotected"], bill.current_units)["fixed_per_kw"]
        kw = round(bill.fixed_charges_rs / per_kw, 1) if per_kw else None
    kw = kw or t["default_sanctioned_load_kw"]
    tariff = Tariff(protected, kw, t["default_taxes_and_adjustments_factor"], "official 2026 slab tariff + typical taxes (no bill)")
    if bill and bill.current_units and bill.total_amount_rs:
        e, f = tariff.base(bill.current_units)
        if e + f > 0:
            factor = bill.total_amount_rs / (e + f)
            if 1.0 <= factor <= 1.8:
                tariff.factor = round(factor, 3)
                tariff.source = "official 2026 slab tariff, calibrated to your bill"
            else:
                tariff.source = "official 2026 slab tariff + typical taxes (your bill total looked unusual, e.g. arrears)"
    return tariff


def month_bill(import_u: float, export_u: float, *, tariff: Tariff, regime: str, buyback: float,
               credit_in: float = 0.0) -> tuple[float, float]:
    """Return (bill_rs, carried_credit_units)."""
    if regime == "LEGACY_NET_METERING":
        net = import_u - export_u - credit_in
        if net < 0:
            return tariff.fixed_cost(0), -net
        return tariff.month_cost(net), 0.0
    return tariff.month_cost(import_u) - export_u * buyback, 0.0


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
