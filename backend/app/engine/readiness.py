"""Solar readiness check (PRD 9.8, P0-lite): a 2-minute check that can honestly answer "not now"."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

from .data import regulatory

PANEL_M2 = 2.6          # ~580 W module footprint incl. spacing
PANEL_KW = 0.58
UNITS_PER_KWP_MONTH = 120  # rough Pakistan average (~4 units/kWp/day); indicative only


class ReadinessIn(BaseModel):
    owns_home: bool = True
    landlord_permission: bool = False
    roof_area_sqft: Optional[float] = Field(None, ge=0, le=200000)
    shade: Literal["none", "some", "heavy"] = "none"
    avg_monthly_units: Optional[float] = Field(None, ge=0, le=100000)
    protected: bool = False
    sanctioned_load_kw: Optional[float] = Field(None, ge=0, le=1000)
    wants_net_billing: bool = True
    roof_condition: Literal["good", "old", "unsure"] = "good"
    budget_lakh: Optional[float] = Field(None, ge=0, le=100000)


def check(r: ReadinessIn) -> dict:
    stop, caution, good = [], [], []
    if not r.owns_home and not r.landlord_permission:
        stop.append("You rent and don't have written permission from the owner. Solar is fixed to the roof and the meter "
                    "agreement is in the owner's name. Get written permission first, or consider a portable backup (UPS + battery).")
    elif not r.owns_home:
        caution.append("Renting: agree in writing who owns the system if you move out.")
    if r.shade == "heavy":
        stop.append("Heavy shade (trees, taller buildings, water tank) can cut output by half or more. Fix the shade or "
                    "choose another spot before buying.")
    elif r.shade == "some":
        caution.append("Some shade: ask the installer to place panels away from it and to string shaded panels separately.")
    if r.roof_condition == "old":
        caution.append("Old roof: get it checked or repaired first. Removing panels later for roof work costs money.")
    elif r.roof_condition == "unsure":
        caution.append("Not sure about the roof: ask a mason or engineer to check it can carry a steel structure.")

    max_kw_roof = None
    if r.roof_area_sqft:
        n = int(r.roof_area_sqft * 0.0929 * 0.7 / PANEL_M2)  # 70% of roof usable
        max_kw_roof = round(n * PANEL_KW, 1)
        if max_kw_roof < 1.5:
            stop.append(f"Your usable roof fits only about {n} panels (~{max_kw_roof} kW). That is too small to be worth a "
                        "full installation.")
        else:
            good.append(f"Your roof fits roughly {n} panels (~{max_kw_roof} kW).")

    need_kw = None
    thr = regulatory()["protected"]["threshold_units"]
    if r.avg_monthly_units is not None:
        need_kw = round(r.avg_monthly_units / UNITS_PER_KWP_MONTH, 1)
        if r.avg_monthly_units < 120:
            stop.append(f"Your use is low (~{r.avg_monthly_units:.0f} units/month). The fixed monthly charge stays after "
                        "solar, so savings would be small. A small backup system may make more sense than grid-tied solar.")
        elif r.protected and r.avg_monthly_units <= thr:
            caution.append(f"You are a protected consumer (under {thr} units) paying low rates, so each solar unit saves "
                           "less. Solar mainly helps if you want backup, or if the protected category ends (planned by 2027).")
        else:
            good.append(f"Your use (~{r.avg_monthly_units:.0f} units/month) suggests a system around {need_kw} kW to cover "
                        "daytime use. Under net billing, size for self-use, not export.")
    if need_kw and max_kw_roof and max_kw_roof < need_kw * 0.5:
        caution.append("Your roof can cover less than half your use. That is still fine, but set expectations on savings.")
    if r.sanctioned_load_kw and need_kw and r.wants_net_billing and need_kw > r.sanctioned_load_kw:
        caution.append(f"A ~{need_kw} kW system is above your sanctioned load ({r.sanctioned_load_kw:g} kW). Net-billing "
                       "approval may need a load extension first (fee and time).")
    if r.budget_lakh is not None and need_kw:
        est = need_kw * 1.4  # ~Rs 1.3-1.7 lakh per kW on-grid (PRD 2.4, indicative)
        if r.budget_lakh < est * 0.6:
            caution.append(f"Your budget (Rs {r.budget_lakh:g} lakh) is well below a typical on-grid system of this size "
                           f"(~Rs {est:.0f} lakh indicative, 2026). Consider a smaller system now and expanding later.")

    verdict = "not_now" if stop else ("check_first" if caution else "ready")
    return {"verdict": verdict, "stop": stop, "caution": caution, "good": good,
            "suggested_kw": need_kw, "max_kw_roof": max_kw_roof,
            "note": "Indicative only. Roshni does not sell systems; use this to decide whether to ask for quotes."}
