"""Typical meteorological year from PVGIS (via pvlib), cached on disk per city."""
from pathlib import Path

import pandas as pd
from pvlib.iotools import get_pvgis_tmy

from .data import cities

CACHE = Path(__file__).resolve().parent.parent.parent / ".cache" / "tmy"
PKT_OFFSET = 5  # Pakistan Standard Time, UTC+5


def city_coords(city: str) -> tuple[float, float]:
    c = cities().get(city)
    if not c:
        raise ValueError(f"Unknown city '{city}'. Supported: {', '.join(cities())}")
    return c["lat"], c["lon"]


def get_tmy(city: str) -> pd.DataFrame:
    """Hourly TMY in local time (PKT), 8760 rows, columns ghi/dni/dhi/temp_air/wind_speed."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{city.lower()}.pkl"
    if path.exists():
        return pd.read_pickle(path)
    lat, lon = city_coords(city)
    data, _meta = get_pvgis_tmy(lat, lon, map_variables=True, roll_utc_offset=PKT_OFFSET, timeout=60)
    data = data[["ghi", "dni", "dhi", "temp_air", "wind_speed"]]
    data.index = data.index.tz_convert(f"Etc/GMT-{PKT_OFFSET}")
    data.to_pickle(path)
    return data
