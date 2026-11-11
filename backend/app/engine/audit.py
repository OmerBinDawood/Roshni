"""Orchestrates: load profile -> PV sim -> dispatch -> finance -> rules -> report dict."""
from datetime import date

import numpy as np

from ..schemas import AuditRequest, Bill, Profile
from . import ENGINE_VERSION
from .data import appliances, regulatory
from .dispatch import dispatch, monthly, outage_mask
from .finance import annual_bill, cashflow, make_tariff, select_regime
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
        scaled, recon = scale_to_bill(load, bill.monthly_units_history, bill.bill_month)
        if profile.scale_to_bill:
            load = scaled
    outage = outage_mask(base.index, profile.outage_hours_per_day)
    return base.index, (pv["pv_kw"].values if pv is not None else np.zeros(len(load))), load.values, outage, recon, \
        (pv.attrs.get("clipped_kwh", 0) if pv is not None else 0)


def financials(profile: Profile, bill: Bill | None, idx, pv, load, outage, *, inverter_type, usable_kwh, batt_kw):
    reg = regulatory()
    regime, expiry = select_regime(profile)
    tariff = make_tariff(bill)
    nb = reg["regimes"]["NET_BILLING_2026"]
    no_solar = monthly({"import": np.where(outage, 0, load)}, idx)
    results = {}
    for name, sc in SCENARIOS.items():
        d = dispatch(pv * sc["pv"], load, outage, usable_kwh=usable_kwh, batt_kw=batt_kw, inverter_type=inverter_type)
        m = monthly(d, idx)
        buyback = nb["buyback_rate_low_rs"] if sc["buyback"] == "low" else nb["buyback_rate_rs"]
        before = annual_bill(list(no_solar["import"]), [0] * 12, tariff=tariff, regime="NET_BILLING_2026", buyback=buyback)
        by_regime = {}
        for r in ("LEGACY_NET_METERING", "NET_BILLING_2026"):
            after = annual_bill(list(m["import"]), list(m["export"]), tariff=tariff, regime=r, buyback=buyback)
            by_regime[r] = before - after
        results[name] = {"before": before, "by_regime": by_regime, "monthly": m, "dispatch": d}
    exp = results["expected"]
    m = exp["monthly"]
    gen = float(np.sum(pv))
    export_share = float(m["export"].sum() / gen) if gen else 0.0
    # Stress test: rules change again (buyback falls to Rs 7, protected category abolished)
    st = tariff.as_unprotected()
    stress_before = annual_bill(list(no_solar["import"]), [0] * 12, tariff=st, regime="NET_BILLING_2026", buyback=7)
    stress_after = annual_bill(list(m["import"]), list(m["export"]), tariff=st, regime="NET_BILLING_2026", buyback=7)
    sav = {k: results[k]["by_regime"][regime] / 12 for k in SCENARIOS}
    avg_units = float(no_solar["import"].mean())
    rep_units = bill.current_units if bill and bill.current_units else avg_units
    return {
        "regime": regime, "regime_label": reg["regimes"][regime]["label"], "legacy_expiry_year": expiry,
        "effective_rate": round(tariff.avg_rate(rep_units), 1), "effective_rate_source": tariff.source,
        "fixed_charge": round(tariff.fixed_cost(rep_units)),
        "tariff": {"protected": tariff.protected, "sanctioned_kw": tariff.sanctioned_kw,
                   "taxes_factor": tariff.factor, "source": tariff.source},
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
    parts = req.mode == "parts"
    fin = None if parts else financials(p, req.bill, idx, pv, load, outage, inverter_type=inv_type, usable_kwh=usable, batt_kw=batt_kw)
    site = site_temperatures(p.city)
    orientation_loss = 0.0
    if dc_kw > 0 and (abs(s.azimuth - 180) > 30 or s.tilt > 35 or s.tilt < 5):
        best = simulate_pv(p.city, dc_kw, s.inverter.rated_kw, 20, 180)["pv_kw"].sum()
        orientation_loss = max(0.0, 1 - float(np.sum(pv)) / best) if best else 0.0
    ctx = {"site": site, "mode": req.mode, "orientation_loss": orientation_loss,
           "tilt": s.tilt, "azimuth": s.azimuth,
           "regime": fin["regime"] if fin else None,
           "savings_monthly": fin["savings_monthly"] if fin else None,
           "export_share": fin["export_share"] if fin else 0.0}
    findings = sorted(run_rules(req, ctx), key=lambda f: SEV_ORDER[f.severity])

    capex = req.quote.grand_total or sum((li.line_total or (li.quantity or 0) * (li.unit_price or 0)) for li in req.quote.line_items)
    cf = None
    if fin:
        inv_cost = next((li.line_total or li.unit_price for li in req.quote.line_items
                         if li.item_type == "inverter" and (li.line_total or li.unit_price)), capex * 0.2)
        bat_cost = sum((li.line_total or (li.quantity or 1) * (li.unit_price or 0)) for li in req.quote.line_items if li.item_type == "battery")
        by_regime = fin.pop("_by_regime_annual")
        if capex:
            cf = cashflow(capex=capex, annual_saving_by_regime=by_regime, regime=fin["regime"],
                          legacy_expiry=fin["legacy_expiry_year"], inverter_cost=inv_cost or 0, battery_cost=bat_cost)

    n_crit = sum(f.severity == "CRITICAL" for f in findings)
    n_clar = sum(f.severity == "CLARIFY" for f in findings)
    verdict = "red" if n_crit else ("amber" if n_clar else "green")
    reg = regulatory()
    unverified = [n for n, sp in (("panel", s.panel), ("inverter", s.inverter), ("battery", s.battery)) if sp.source and not sp.verified]
    bl = backup_loads(req)
    assumptions = [f"Weather: PVGIS typical year for {p.city}; coldest air {site['t_min_air']:.0f} C, "
                   f"hottest panel {site['t_cell_max']:.0f} C (used for string checks)."]
    if fin:
        assumptions = [
            f"Rules as of {reg['as_of']} ({fin['regime_label']}); buyback ~Rs {reg['regimes']['NET_BILLING_2026']['buyback_rate_rs']:.0f}/unit.",
            f"Tariff: {fin['effective_rate_source']} (NEPRA S.R.O. 279(I)/2026); about Rs {fin['effective_rate']}/unit all-in at your usage, "
            f"taxes and adjustments x{fin['tariff']['taxes_factor']}, sanctioned load {fin['tariff']['sanctioned_kw']:g} kW.",
            f"Unprotected bills charge every unit at the rate of the slab your total falls in, so lowering your grid units also lowers the rate "
            f"and the fixed charge (about Rs {fin['fixed_charge']:.0f}/month today); the fixed charge never reaches zero.",
            f"Weather: PVGIS typical year for {p.city}; {p.outage_hours_per_day:g} h/day load-shedding; soiling loss 7%, total system losses ~15%.",
            "Inverter replacement assumed in year 11; battery replacement every 10 years.",
        ]
        if recon:
            assumptions.append("Your answers were scaled to match your bill history." if p.scale_to_bill
                               else "Your answers were NOT scaled to your bill history (your choice).")
    return {
        "mode": req.mode,
        "verdict": verdict, "counts": {"critical": n_crit, "clarify": n_clar},
        "system_summary": {"dc_kwp": round(dc_kw, 2), "inverter_kw": s.inverter.rated_kw, "inverter_type": inv_type,
                           "battery_usable_kwh": round(usable, 1), "panel_count": s.panel_count},
        "findings": [f.model_dump() for f in findings],
        "questions": [f.question for f in findings if f.question and f.severity in ("CRITICAL", "CLARIFY")],
        "finance": fin, "cashflow": cf, "capex": capex,
        "backup": {**bl, "outage_hours_per_day": p.outage_hours_per_day,
                   "unserved_kwh_year": fin["annual"]["unserved_kwh"] if fin else None,
                   "battery_usable_kwh": round(usable, 1),
                   "hours_on_battery": round(usable / max(bl["running_kw"], 0.01), 1) if usable else 0,
                   "works_in_outage": inv_type != "on_grid",
                   "items": backup_items(req, inv_type, usable, batt_kw)},
        "site": site, "reconciliation": recon, "reconciliation_prompts": reconciliation_prompts(recon),
        "clipped_kwh": round(clipped),
        "assumptions": assumptions,
        "unverified_specs": unverified,
        "versions": {"engine": ENGINE_VERSION, "regulatory": reg["version"], "appliances": appliances()["version"],
                     "generated": date.today().isoformat()},
    }


MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
               "November", "December"]


def reconciliation_prompts(recon: list[dict], threshold: int = 20) -> list[str]:
    """Gentle prompts where answers and bill disagree by more than the threshold (PRD 9.4)."""
    out = []
    for r in sorted(recon, key=lambda r: -abs(r["diff_pct"] or 0))[:2]:
        if r["diff_pct"] is None or abs(r["diff_pct"]) <= threshold:
            continue
        m = MONTH_NAMES[r["month"] - 1]
        if r["diff_pct"] > 0:
            out.append(f"Your bill shows about {r['bill_units']:,.0f} units in {m}, but your answers suggest about "
                       f"{r['modelled_units']:,.0f}. Do the ACs run fewer hours than you said?")
        else:
            out.append(f"Your bill shows about {r['bill_units']:,.0f} units in {m}, but your answers suggest only about "
                       f"{r['modelled_units']:,.0f}. Are there other appliances (geyser, iron, motor, extra AC) we missed?")
    return out


def backup_items(req: AuditRequest, inv_type: str, usable: float, batt_kw: float) -> list[dict]:
    """What will and will not run during load-shedding (PRD 9.6)."""
    a, p = appliances(), req.profile
    items = []
    if p.backup_fans:
        items.append(("Fans", p.backup_fans, p.backup_fans * a["fan_kw"], 0.0))
    if p.backup_lights:
        items.append(("Lights", p.backup_lights, p.backup_lights * a["light_kw"], 0.0))
    if p.backup_fridge:
        items.append(("Fridge", 1, 0.15, a["fridge_surge_kw"]))
    if p.backup_ac and p.acs:
        ac = p.acs[0]
        kind = "inverter" if ac.inverter else "non_inverter"
        kw = ac.tons * a["ac_kw_per_ton"][kind]
        items.append((f"{ac.tons:g}-ton AC", p.backup_ac, p.backup_ac * kw, kw * a["ac_surge_multiplier"][kind]))
    if p.backup_motor:
        m = p.motor_hp * a["motor_kw_per_hp"]
        items.append((f"{p.motor_hp:g} HP water motor", 1, m, m * a["motor_surge_multiplier"]))
    inv = req.system.inverter
    limit = min(inv.rated_kw or 1e9, batt_kw if usable else 1e9)
    surge_cap = inv.surge_kva or ((inv.rated_kw or 0) * 2) or 1e9
    out, running = [], 0.0
    for name, n, kw, surge in items:
        row = {"name": name, "count": n, "kw": round(kw, 2)}
        if inv_type == "on_grid":
            out.append({**row, "runs": False, "reason": "On-grid inverter switches off in load-shedding"})
        elif not usable:
            out.append({**row, "runs": "day_only", "reason": "Only while the sun is up (no battery)"})
        elif running + kw > limit:
            out.append({**row, "runs": False, "reason": "Not enough inverter/battery power with the items above on"})
        elif surge and running + kw + surge > surge_cap:
            out.append({**row, "runs": False, "reason": "Start-up surge may trip the inverter"})
        else:
            running += kw
            out.append({**row, "runs": True, "reason": f"About {usable / max(running, 0.01):.1f} h with everything above on"})
    return out


def battery_options(profile: Profile, bill: Bill | None, *, dc_kw: float, inverter_kw: float,
                    sizes=(0, 5, 10, 15), cost_per_kwh: float = 55000, inverter_type: str = "on_grid") -> dict:
    """Journey 2: should I add a battery? Simulate a few usable sizes with a hybrid inverter."""
    idx, pv, load, outage, recon, _ = energy_model(profile, bill, dc_kw=dc_kw, ac_kw=inverter_kw, inverter_type="hybrid",
                                                   usable_kwh=0, batt_kw=0)
    rows = []
    for kwh in sizes:
        bkw = min(kwh * 0.5, inverter_kw) if kwh else 0
        inv = "hybrid" if kwh else inverter_type
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
    return {"regime": regime, "existing_inverter_type": inverter_type, "needs_inverter_change": inverter_type == "on_grid", "options": rows, "backup_load_kw": round(bl_kw, 2), "cost_per_usable_kwh_assumed": cost_per_kwh,
            "note": "Battery cost per usable kWh is an indicative assumption; replace with your actual quote."}
