"""Schedule-based hourly load profile (PRD 10.2), optionally scaled to bill history."""
import numpy as np
import pandas as pd

from ..schemas import Profile
from .data import appliances

# AC windows fill outward from the hottest / main sleeping hours, so any number of hours (0-12 each) fits
DAY_HOURS = [13, 14, 12, 15, 11, 16, 10, 17, 9, 18, 8, 19]      # 12 daytime slots, hottest first
NIGHT_HOURS = [23, 0, 1, 22, 2, 3, 21, 4, 5, 20, 6, 7]          # 12 night slots, main sleeping hours first
EVENING = list(range(18, 24))


def _spread(hours_wanted: float, window: list[int]) -> np.ndarray:
    """Fraction (0..1) of each hour of the day the appliance runs, filling a window."""
    mask = np.zeros(24)
    h = max(0.0, min(hours_wanted, len(window)))
    for hr in window:
        take = min(1.0, h)
        mask[hr] = take
        h -= take
        if h <= 0:
            break
    return mask


def build_load(profile: Profile, index: pd.DatetimeIndex, temp_air: np.ndarray) -> pd.Series:
    a = appliances()
    hour = index.hour.values
    load = np.full(len(index), a["baseload_kw"])
    load += profile.fridges * a["fridge_kw_avg"]
    # Fans: heavier in warm months, mostly evening/night
    warm = np.clip((temp_air - 18) / 12, 0, 1)
    fan_mask = np.isin(hour, list(range(12, 24)) + [0, 1, 2, 3, 4, 5, 6]).astype(float)
    load += profile.fans * a["fan_kw"] * 0.6 * warm * fan_mask
    load += profile.lights * a["light_kw"] * np.isin(hour, EVENING + [5, 6]).astype(float)
    # Water motor: ~1 hour per day, morning
    load += profile.motor_hp * a["motor_kw_per_hp"] * (hour == 7)
    # ACs: duty cycle depends on outdoor temperature; off when cool
    for ac in profile.acs:
        kw = ac.tons * a["ac_kw_per_ton"]["inverter" if ac.inverter else "non_inverter"]
        mask = _spread(ac.day_hours, DAY_HOURS) + _spread(ac.night_hours, NIGHT_HOURS)
        duty = np.clip((temp_air - 26) / 14, 0, 0.95)
        load += ac.count * kw * mask[hour] * duty
    return pd.Series(load, index=index, name="load_kw")


def scale_to_bill(load: pd.Series, monthly_units: list[float], bill_month: int | None = None) -> tuple[pd.Series, list[dict]]:
    """Scale the modelled profile month-by-month to the bill history (measured beats modelled).

    Bill history is oldest-first, last 12 months; we map it to calendar months ending with the
    most recent full month. Returns the scaled load and a reconciliation table.
    """
    if not monthly_units:
        return load, []
    hist = monthly_units[-12:]
    modelled = load.groupby(load.index.month).sum()
    # Last entry = the bill's own month if known, else the previous calendar month
    from datetime import date
    last_month = bill_month if bill_month and 1 <= bill_month <= 12 else (date.today().month - 2) % 12 + 1
    months = [((last_month - len(hist) + 1 + i - 1) % 12) + 1 for i in range(len(hist))]
    factors = {}
    recon = []
    for m, units in zip(months, hist):
        mod = float(modelled.get(m, 0))
        if units and mod > 0:
            factors[m] = units / mod
        recon.append({"month": m, "bill_units": units, "modelled_units": round(mod),
                      "diff_pct": round((mod - units) / units * 100) if units else None})
    if factors:
        avg = float(np.mean(list(factors.values())))
        f = load.index.month.map(lambda m: factors.get(m, avg)).values
        load = load * f
    return load, recon
