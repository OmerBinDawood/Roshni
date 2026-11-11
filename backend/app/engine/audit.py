"""Orchestrates: load profile -> PV sim -> dispatch -> finance -> rules -> report dict."""
from datetime import date

import numpy as np

from ..schemas import AuditRequest, Bill, Profile
from . import ENGINE_VERSION
from .data import appliances, regulatory
from .dispatch import dispatch, monthly, outage_mask
from .finance import annual_bill, cashflow, effective_rate, fixed_charge, select_regime
from .load import build_load, scale_to_bill
from .pv import simulate_pv, site_temperatures
from .rules import backup_loads, run_rules

SEV_ORDER = {"CRITICAL": 0, "CLARIFY": 1, "INFO": 2, "OK": 3}
SCENARIOS = {"conservative": {"pv": 0.90, "buyback": "low"}, "expected": {"pv": 1.0, "buyback": "mid"},
             "optimistic": {"pv": 1.05, "buyback": "mid"}}


def energy_model(profile: Profile, bill: Bill | None, *, dc_kw: float, ac_kw: float | None, inverter_type: str,
                 usable_kwh: float, batt_kw: float, tilt: float = 20, azimuth: float = 180, gamma: float = -0.35):
    pv = simulate_pv(profile.city, dc_kw, ac_kw, tilt, azimuth, gamma) if dc_kw > 0 else None
    base = pv if pv is not None else simulate_pv(profile.city, 0.001, 0.001)
    load = build_load(profile, base.index, base["temp_air"].values)
    recon = []
    if bill and bill.monthly_units_history:
        load, recon = scale_to_bill(load, bill.monthly_units_history)
    outage = outage_mask(base.index, profile.outage_hours_per_day)
    return base.index, (pv["pv_kw"].values if pv is not None else np.zeros(len(load))), load.values, outage, recon, \
        (pv.attrs.get("clipped_kwh", 0) if pv is not None else 0)


def financials(profile: Profile, bill: Bill | None, idx, pv, load, outage, *, inverter_type, usable_kwh, batt_kw):
    reg = regulatory()
    regime, expiry = select_regime(profile)
    rate, rate_src = effective_rate(bill)
    fixed = fixed_charge(bill)
    nb = reg["regimes"]["NET_BILLING_2026"]
    no_solar = monthly({"import": np.where(outage, 0, load)}, idx)
    results = {}
    for name, sc in SCENARIOS.items():
        d = dispatch(pv * sc["pv"], load, outage, usable_kwh=usable_kwh, batt_kw=batt_kw, inverter_type=inverter_type)
        m = monthly(d, idx)
        buyback = nb["buyback_rate_low_rs"] if sc["buyback"] == "low" else nb["buyback_rate_rs"]
        before = annual_bill(list(no_solar["import"]), [0] * 12, rate=rate, fixed=fixed, regime="NET_BILLING_2026", buyback=buyback)
        by_regime = {}
        for r in ("LEGACY_NET_METERING", "NET_BILLING_2026"):
            after = annual_bill(list(m["import"]), list(m["export"]), rate=rate, fixed=fixed, regime=r, buyback=buyback)
            by_regime[r] = before - after
        results[name] = {"before": before, "by_regime": by_regime, "monthly": m, "dispatch": d}
    exp = results["expected"]
    m = exp["monthly"]
    gen = float(np.sum(pv))
    export_share = float(m["export"].sum() / gen) if gen else 0.0
    # Stress test: rules change again (buyback falls to Rs 7, protected category abolished)
    stress_rate = max(rate, reg["non_protected_effective_rate_rs"]["low"]) if bill and bill.protected else rate
    stress_before = annual_bill(list(no_solar["import"]), [0] * 12, rate=stress_rate, fixed=fixed, regime="NET_BILLING_2026", buyback=7)
    stress_after = annual_bill(list(m["import"]), list(m["export"]), rate=stress_rate, fixed=fixed, regime="NET_BILLING_2026", buyback=7)
    sav = {k: results[k]["by_regime"][regime] / 12 for k in SCENARIOS}
    return {
        "regime": regime, "regime_label": reg["regimes"][regime]["label"], "legacy_expiry_year": expiry,
        "effective_rate": rate, "effective_rate_source": rate_src, "fixed_charge": fixed,
        "bill_before_monthly": round(exp["before"] / 12),
        "savings_monthly": {"low": round(sav["conservative"]), "expected": round(sav["expected"]), "high": round(sav["optimistic"])},
        "savings_annual_by_regime": {r: round(v) for r, v in exp["by_regime"].items()},
        "net_metering_vs_net_billing_monthly": {r: round(v / 12) for r, v in exp["by_regime"].items()},
        "stress_test_monthly": round((stress_before - stress_after) / 12),
        "export_share": round(export_share, 3),
        "energy_monthly": [{"month": int(i), "pv": round(float(pv_m)), "load": round(float(l)),
                            "direct": round(float(r["direct"])), "export": round(float(r["export"])),
                            "import": round(float(r["import"])), "battery": round(float(r["discharge"])),
                            "unserved": round(float(r["unserved"]))}
                           for (i, r), pv_m, l in zip(m.iterrows(), monthly({"pv": pv}, idx)["pv"], monthly({"l": load}, idx)["l"])],
        "annual": {"pv_kwh": round(gen), "load_kwh": round(float(load.sum())),
                   "self_consumed_kwh": round(float(m["direct"].sum() + m["discharge"].sum())),
                   "export_kwh": round(float(m["export"].sum())), "import_kwh": round(float(m["import"].sum())),
                   "unserved_kwh": round(float(m["unserved"].sum()))},
        "_by_regime_annual": exp["by_regime"],
    }


def run_audit(req: AuditRequest) -> dict:
    s, p = req.system, req.profile
    dc_kw = s.panel_count * (s.panel.pmax_w or 0) / 1000
    inv_type = s.inverter.type or "on_grid"
    nb = max(1, s.battery_count) if (s.battery.usable_kwh or s.battery.nominal_kwh) else 0
    usable = (s.battery.usable_kwh or (s.battery.nominal_kwh or 0) * 0.9) * nb
    batt_kw = (s.battery.max_discharge_kw or (usable * 0.5)) * max(1, nb) if usable else 0
    batt_kw = min(batt_kw, s.inverter.rated_kw or batt_kw)
    idx, pv, load, outage, recon, clipped = energy_model(
        p, req.bill, dc_kw=dc_kw, ac_kw=s.inverter.rated_kw, inverter_type=inv_type, usable_kwh=usable,
        batt_kw=batt_kw, tilt=s.tilt, azimuth=s.azimuth,
        gamma=s.panel.gamma_pmax_pct if s.panel.gamma_pmax_pct is not None else -0.35)
    fin = financials(p, req.bill, idx, pv, load, outage, inverter_type=inv_type, usable_kwh=usable, batt_kw=batt_kw)
    site = site_temperatures(p.city)
    ctx = {"site": site, "regime": fin["regime"], "savings_monthly": fin["savings_monthly"], "export_share": fin["export_share"]}
    findings = sorted(run_rules(req, ctx), key=lambda f: SEV_ORDER[f.severity])

    capex = req.quote.grand_total or sum((li.line_total or (li.quantity or 0) * (li.unit_price or 0)) for li in req.quote.line_items)
    inv_cost = next((li.line_total or li.unit_price for li in req.quote.line_items if li.item_type == "inverter" and (li.line_total or li.unit_price)), capex * 0.2)
    bat_cost = sum((li.line_total or (li.quantity or 1) * (li.unit_price or 0)) for li in req.quote.line_items if li.item_type == "battery")
    cf = cashflow(capex=capex, annual_saving_by_regime=fin.pop("_by_regime_annual"), regime=fin["regime"],
                  legacy_expiry=fin["legacy_expiry_year"], inverter_cost=inv_cost or 0, battery_cost=bat_cost) if capex else None

    n_crit = sum(f.severity == "CRITICAL" for f in findings)
    n_clar = sum(f.severity == "CLARIFY" for f in findings)
    verdict = "red" if n_crit else ("amber" if n_clar else "green")
    reg = regulatory()
    unverified = [n for n, sp in (("panel", s.panel), ("inverter", s.inverter), ("battery", s.battery)) if sp.source and not sp.verified]
    return {
        "verdict": verdict, "counts": {"critical": n_crit, "clarify": n_clar},
        "system_summary": {"dc_kwp": round(dc_kw, 2), "inverter_kw": s.inverter.rated_kw, "inverter_type": inv_type,
                           "battery_usable_kwh": round(usable, 1), "panel_count": s.panel_count},
        "findings": [f.model_dump() for f in findings],
        "questions": [f.question for f in findings if f.question and f.severity in ("CRITICAL", "CLARIFY")],
        "finance": fin, "cashflow": cf, "capex": capex,
        "backup": {**backup_loads(req), "outage_hours_per_day": p.outage_hours_per_day,
                   "unserved_kwh_year": fin["annual"]["unserved_kwh"], "battery_usable_kwh": round(usable, 1),
                   "hours_on_battery": round(usable / max(backup_loads(req)["running_kw"], 0.01), 1) if usable else 0,
                   "works_in_outage": inv_type != "on_grid"},
        "site": site, "reconciliation": recon, "clipped_kwh": round(clipped),
        "assumptions": [
            f"Rules as of {reg['as_of']} ({fin['regime_label']}); buyback ~Rs {reg['regimes']['NET_BILLING_2026']['buyback_rate_rs']:.0f}/unit.",
            f"Import price Rs {fin['effective_rate']}/unit from {fin['effective_rate_source']}; fixed charge Rs {fin['fixed_charge']:.0f}/month stays after solar.",
            f"Weather: PVGIS typical year for {p.city}; {p.outage_hours_per_day:g} h/day load-shedding; soiling loss 7%, total system losses ~15%.",
        ],
        "unverified_specs": unverified,
        "versions": {"engine": ENGINE_VERSION, "regulatory": reg["version"], "appliances": appliances()["version"],
                     "generated": date.today().isoformat()},
    }


def battery_options(profile: Profile, bill: Bill | None, *, dc_kw: float, inverter_kw: float,
                    sizes=(0, 5, 10, 15), cost_per_kwh: float = 55000) -> dict:
    """Journey 2: should I add a battery? Simulate a few usable sizes with a hybrid inverter."""
    idx, pv, load, outage, recon, _ = energy_model(profile, bill, dc_kw=dc_kw, ac_kw=inverter_kw, inverter_type="hybrid",
                                                   usable_kwh=0, batt_kw=0)
    rows = []
    for kwh in sizes:
        bkw = min(kwh * 0.5, inverter_kw) if kwh else 0
        inv = "hybrid" if kwh else "on_grid"
        fin = financials(profile, bill, idx, pv, load, outage, inverter_type=inv, usable_kwh=kwh, batt_kw=bkw)
        rows.append({"usable_kwh": kwh, "savings_monthly": fin["savings_monthly"], "annual": fin["annual"],
                     "backup_hours": None})
    base = rows[0]["savings_monthly"]["expected"]
    bl_kw = max(0.3, profile.backup_fans * 0.08 + profile.backup_lights * 0.015 + (0.15 if profile.backup_fridge else 0))
    for r in rows:
        r["extra_saving_monthly"] = r["savings_monthly"]["expected"] - base
        r["indicative_cost_rs"] = round(r["usable_kwh"] * cost_per_kwh)
        r["simple_payback_years"] = round(r["indicative_cost_rs"] / (r["extra_saving_monthly"] * 12), 1) \
            if r["usable_kwh"] and r["extra_saving_monthly"] > 0 else None
        r["backup_hours"] = round(r["usable_kwh"] / bl_kw, 1)
    regime, _ = select_regime(profile)
    return {"regime": regime, "options": rows, "backup_load_kw": round(bl_kw, 2), "cost_per_usable_kwh_assumed": cost_per_kwh,
            "note": "Battery cost per usable kWh is an indicative assumption; replace with your actual quote."}
