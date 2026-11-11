"""Hourly self-consumption-first dispatch with outages (PRD 10.4)."""
import numpy as np
import pandas as pd

# Typical load-shedding slots in order of likelihood; covers all 24 hours so long rural outages are modelled
OUTAGE_ORDER = [19, 20, 14, 15, 21, 9, 10, 22, 13, 16, 11, 12, 23, 0, 8, 17, 1, 2, 18, 3, 7, 4, 5, 6]


def outage_mask(index: pd.DatetimeIndex, hours_per_day: float) -> np.ndarray:
    n = int(round(min(hours_per_day, len(OUTAGE_ORDER))))
    return np.isin(index.hour.values, OUTAGE_ORDER[:n])


def dispatch(pv: np.ndarray, load: np.ndarray, outage: np.ndarray, *, usable_kwh: float = 0.0,
             batt_kw: float = 0.0, inverter_type: str = "on_grid", export_limit_kw: float = 1e9,
             eff_c: float = 0.95, eff_d: float = 0.95) -> dict:
    n = len(load)
    has_batt = usable_kwh > 0 and inverter_type in ("hybrid", "off_grid")
    soc = usable_kwh * 0.5 if has_batt else 0.0
    out = {k: np.zeros(n) for k in ("direct", "charge", "export", "discharge", "import", "unserved", "curtail")}
    for h in range(n):
        p, l = pv[h], load[h]
        grid_up = not outage[h]
        if not grid_up and inverter_type == "on_grid":
            p = 0.0  # anti-islanding: on-grid inverters shut down in an outage
        direct = min(p, l)
        surplus = p - direct
        charge = 0.0
        if has_batt:
            charge = min(surplus, batt_kw, (usable_kwh - soc) / eff_c)
        export = min(surplus - charge, export_limit_kw) if grid_up and inverter_type != "off_grid" else 0.0
        curtail = surplus - charge - export
        deficit = l - direct
        discharge = min(deficit, batt_kw, soc * eff_d) if has_batt else 0.0
        rest = deficit - discharge
        imp = rest if grid_up else 0.0
        unserved = 0.0 if grid_up else rest
        soc += charge * eff_c - discharge / eff_d
        for k, v in (("direct", direct), ("charge", charge), ("export", export), ("discharge", discharge),
                     ("import", imp), ("unserved", unserved), ("curtail", curtail)):
            out[k][h] = v
    return out


def monthly(series: dict, index: pd.DatetimeIndex) -> pd.DataFrame:
    df = pd.DataFrame(series, index=index)
    return df.groupby(index.month).sum()
