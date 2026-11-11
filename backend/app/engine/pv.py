"""Hourly PV generation using pvlib (PVWatts DC + inverter models)."""
import numpy as np
import pandas as pd
import pvlib

from .weather import city_coords, get_tmy

# Losses (fraction). Soiling is set higher than European defaults (PRD 10.3): dust is significant.
LOSSES = {"soiling": 0.07, "wiring": 0.02, "mismatch": 0.02, "lid_and_age": 0.02, "shading_availability": 0.03}
BANDS = {"low": 0.90, "expected": 1.0, "high": 1.05}


def simulate_pv(city: str, dc_kw: float, ac_kw: float | None, tilt: float = 20, azimuth: float = 180,
                gamma_pdc_pct: float = -0.35) -> pd.DataFrame:
    """Return hourly AC kW (expected) plus cell temperature. Index = local time, 8760 rows."""
    tmy = get_tmy(city)
    lat, lon = city_coords(city)
    loc = pvlib.location.Location(lat, lon, tz=str(tmy.index.tz))
    # Mid-interval sun position to match PVGIS hourly averages
    sp = loc.get_solarposition(tmy.index + pd.Timedelta(minutes=30))
    sp.index = tmy.index
    poa = pvlib.irradiance.get_total_irradiance(
        surface_tilt=tilt, surface_azimuth=azimuth,
        solar_zenith=sp["apparent_zenith"], solar_azimuth=sp["azimuth"],
        dni=tmy["dni"], ghi=tmy["ghi"], dhi=tmy["dhi"],
        dni_extra=pvlib.irradiance.get_extra_radiation(tmy.index), model="haydavies",
    )
    poa_global = poa["poa_global"].fillna(0).clip(lower=0)
    t_cell = pvlib.temperature.faiman(poa_global, tmy["temp_air"], tmy["wind_speed"])
    loss = 1.0
    for v in LOSSES.values():
        loss *= 1 - v
    pdc = pvlib.pvsystem.pvwatts_dc(poa_global, t_cell, pdc0=dc_kw * 1000, gamma_pdc=gamma_pdc_pct / 100) * loss
    pdc0_inv = (ac_kw or dc_kw) * 1000 / 0.96
    pac = pvlib.inverter.pvwatts(pdc, pdc0=pdc0_inv, eta_inv_nom=0.96).clip(lower=0)
    clipped = (pdc * 0.96 - pac).clip(lower=0).sum() / 1000
    out = pd.DataFrame({"pv_kw": pac.values / 1000, "t_cell": t_cell.values, "temp_air": tmy["temp_air"].values},
                       index=tmy.index)
    out.attrs["clipped_kwh"] = float(clipped)
    return out


def site_temperatures(city: str) -> dict:
    sim = simulate_pv(city, 1.0, 1.0)
    tmy = get_tmy(city)
    return {
        "t_min_air": float(np.floor(tmy["temp_air"].min())),
        "t_cell_max": float(np.ceil(sim["t_cell"].max())),
        "t_air_max": float(np.ceil(tmy["temp_air"].max())),
    }
