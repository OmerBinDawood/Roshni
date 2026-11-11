"""Journey: "size my solar". From the household (appliances, load-shedding, bill) to a few sensible systems with cost ranges,
savings, payback and backup hours, then the brand categories the user will need to shop for.

No scores and no brand ranking: options are chosen by plain financial rules (best simple payback within the budget), and brands are
listed alphabetically with the checks that matter (see brands.py). Prices are indicative component ranges, not quotes.
"""
import math
from typing import Literal, Optional

import numpy as np
from pydantic import BaseModel, Field

from ..schemas import Bill, Profile
from . import brands
from .audit import energy_model, financials
from .data import appliances, regulatory
from .readiness import PANEL_KW, PANEL_M2

SIZES_KW = [2, 3, 4, 5, 6, 8, 10, 12]
BATTERIES_KWH = [5, 10]
DAY_HOURS = range(8, 17)  # 8:00 to 16:59, the hours solar can serve directly


class SizeReq(BaseModel):
    profile: Profile
    bill: Optional[Bill] = None
    budget_rs: Optional[float] = Field(None, gt=0, le=100_000_000)
    roof_area_sqft: Optional[float] = Field(None, gt=0, le=200000)
    goal: Literal["bill", "backup", "both"] = "both"


def backup_kw(p: Profile) -> float:
    a = appliances()
    kw = p.backup_fans * a["fan_kw"] + p.backup_lights * a["light_kw"] + (0.15 if p.backup_fridge else 0)
    if p.backup_ac and p.acs:
        ac = p.acs[0]
        kw += p.backup_ac * ac.tons * a["ac_kw_per_ton"]["inverter" if ac.inverter else "non_inverter"]
    if p.backup_motor:
        kw += p.motor_hp * a["motor_kw_per_hp"]
    return max(kw, 0.3)


def cost_range(kind: str, dc_kw: float, inverter_kw: float, battery_kwh: float) -> dict:
    c = regulatory()["sizing_costs"]
    inv = c["inverter_hybrid_rs_per_kw" if kind == "hybrid" else "inverter_ongrid_rs_per_kw"]
    parts = {
        "panels": (dc_kw * 1000 * c["panel_rs_per_w"]["low"], dc_kw * 1000 * c["panel_rs_per_w"]["high"]),
        "inverter": (inverter_kw * inv["low"], inverter_kw * inv["high"]),
        "battery": (battery_kwh * c["battery_rs_per_usable_kwh"]["low"], battery_kwh * c["battery_rs_per_usable_kwh"]["high"]),
        "structure_install": (dc_kw * 1000 * c["structure_wiring_install_rs_per_w"]["low"],
                              dc_kw * 1000 * c["structure_wiring_install_rs_per_w"]["high"]),
    }
    low, high = sum(v[0] for v in parts.values()), sum(v[1] for v in parts.values())
    return {"low": round(low, -3), "high": round(high, -3), "mid": round((low + high) / 2, -3),
            "parts": {k: {"low": round(v[0], -3), "high": round(v[1], -3)} for k, v in parts.items() if v[1] > 0}}


def roof_limit_kw(sqft: float | None) -> float | None:
    if not sqft:
        return None
    return round(int(sqft * 0.0929 * 0.7 / PANEL_M2) * PANEL_KW, 1)


def _inverter_kw(dc_kw: float) -> float:
    return max(3.0, round(dc_kw / 1.2 * 2) / 2)


def _candidate(profile, bill, dc_kw, kind, battery_kwh, model):
    inverter_kw = _inverter_kw(dc_kw)
    usable = float(battery_kwh)
    batt_kw = min(usable * 0.5, inverter_kw) if usable else 0.0
    idx, pv, load, outage, recon, clipped = model
    fin = financials(profile, bill, idx, pv, load, outage, inverter_type=kind, usable_kwh=usable, batt_kw=batt_kw)
    cost = cost_range(kind, dc_kw, inverter_kw, battery_kwh)
    sav = fin["savings_monthly"]
    payback = round(cost["mid"] / (sav["expected"] * 12), 1) if sav["expected"] > 0 else None
    bkw = backup_kw(profile)
    return {"dc_kw": dc_kw, "inverter_kw": inverter_kw, "inverter_type": kind, "battery_kwh": battery_kwh,
            "cost": cost, "savings_monthly": sav, "payback_years": payback, "export_share": fin["export_share"],
            "annual_pv_kwh": fin["annual"]["pv_kwh"], "annual_import_kwh": fin["annual"]["import_kwh"],
            "backup_hours": round(usable / bkw, 1) if usable else 0.0, "backup_load_kw": round(bkw, 2),
            "works_in_outage": kind != "on_grid", "regime": fin["regime"]}, (idx, load, fin)


MARGINAL_PAYBACK_YEARS = 6  # keep adding panels while each extra step pays for itself within this many years


def _pick(cands: list[dict]):
    """Grow the system step by step while the extra cost of the next size pays back within MARGINAL_PAYBACK_YEARS."""
    cands = sorted(cands, key=lambda c: c["dc_kw"])
    if not cands:
        return None
    best = cands[0]
    for nxt in cands[1:]:
        extra_saving = (nxt["savings_monthly"]["expected"] - best["savings_monthly"]["expected"]) * 12
        extra_cost = nxt["cost"]["mid"] - best["cost"]["mid"]
        if extra_saving > 0 and extra_cost / extra_saving <= MARGINAL_PAYBACK_YEARS:
            best = nxt
        else:
            break
    return best


def size_solar(req: SizeReq) -> dict:
    p, bill = req.profile, req.bill
    roof = roof_limit_kw(req.roof_area_sqft)
    sizes = [s for s in SIZES_KW if roof is None or s <= roof] or [SIZES_KW[0]]

    plans: list[tuple[str, int]] = [("on_grid", 0)]
    if req.goal != "bill":
        plans += [("hybrid", b) for b in BATTERIES_KWH]
    cands: dict[tuple, dict] = {}
    base = None
    for s in sizes:  # weather, PV and load depend only on the size, so simulate once per size
        model = energy_model(p, bill, dc_kw=s, ac_kw=_inverter_kw(s), inverter_type="hybrid", usable_kwh=0, batt_kw=0)
        for kind, bat in plans:
            c, extra = _candidate(p, bill, s, kind, bat, model)
            cands[(kind, bat, s)] = c
            base = base or extra

    idx, load, fin0 = base
    load_s = np.asarray(load)
    day_mask = np.isin(idx.hour.values, list(DAY_HOURS))
    summary = {
        "annual_load_kwh": round(float(load_s.sum())),
        "avg_monthly_units": round(float(load_s.sum()) / 12),
        "daytime_share": round(float(load_s[day_mask].sum() / load_s.sum()), 2) if load_s.sum() else None,
        "bill_today_monthly_rs": fin0["bill_before_monthly"], "effective_rate_rs": fin0["effective_rate"],
        "regime": fin0["regime"], "regime_label": fin0["regime_label"], "roof_limit_kw": roof,
        "reconciliation_prompts": [],
    }

    def within(c):
        return req.budget_rs is None or c["cost"]["mid"] <= req.budget_rs

    options = []
    for kind, bat in plans:
        group = [c for (k, b, _), c in cands.items() if k == kind and b == bat]
        ok = [c for c in group if within(c)]
        # on-grid under net billing: avoid sizes that export most of their output cheaply
        lean = [c for c in ok if kind != "on_grid" or c["export_share"] <= 0.40] or ok
        pool = lean or group
        best = _pick(pool)
        if not best:
            continue
        over = req.budget_rs is not None and not within(best)
        name = {("on_grid", 0): "Cut the bill (on-grid, no backup)", ("hybrid", 5): "Bill and backup (hybrid + 5 kWh battery)",
                ("hybrid", 10): "Longer backup (hybrid + 10 kWh battery)"}[(kind, bat)]
        why = [f"Largest {kind.replace('_', '-')} size where each extra step still pays for itself within {MARGINAL_PAYBACK_YEARS} years"
               + (", within your budget" if req.budget_rs else "") + "."]
        if kind == "on_grid":
            why.append("Sized so no more than 40% of the solar is exported at the low buyback rate."
                       if summary["regime"] == "NET_BILLING_2026" else "Sized for your own use.")
            if req.goal != "bill":
                why.append("It will switch off during load-shedding (anti-islanding); it gives no backup.")
        else:
            why.append(f"Runs your chosen backup load (~{best['backup_load_kw']} kW) for about {best['backup_hours']} hours from a full battery.")
        if over:
            why.append("Over your budget even at the smallest size; consider the cheaper option or a smaller battery.")
        options.append({**best, "name": name, "within_budget": not over, "why": why})

    if not options:
        raise ValueError("Could not size a system for this household.")

    needed = ["panel", "inverter"] + (["battery_lithium"] if any(o["battery_kwh"] for o in options) else [])
    g = brands.guide()
    brand_options = {
        cat: {"label": brands.CATEGORY_LABELS[cat], "checks": g["category_checks"].get(cat, []),
              "brands": sorted(({"id": b["id"], "name": b["name"], "kind": b["kind"], "origin": b["origin"], "about": b["about"],
                                 "pakistan": b["pakistan"], "verify": b.get("verify")} for b in g["brands"] if cat in b["categories"]),
                               key=lambda b: b["name"].lower())}
        for cat in needed}
    return {
        "summary": summary, "options": options, "brand_options": brand_options,
        "cost_note": regulatory()["sizing_costs"]["note"], "prices_as_of": regulatory()["sizing_costs"]["as_of"],
        "next": "Ask 2 or 3 installers for quotes with exact brands and models, then check each one with Roshni's quote check.",
        "policy": g["policy"],
        "assumptions": [
            "Costs are component ranges (panels, inverter, battery, structure and installation); approval and meter fees are extra.",
            "Payback is simple (cost midpoint divided by yearly saving); the full report adds inverter and battery replacements.",
            f"Savings use the {summary['regime_label']} rules and your tariff; they are estimates, not promises.",
        ],
    }
