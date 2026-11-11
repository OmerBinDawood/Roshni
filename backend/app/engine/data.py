import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@lru_cache
def load(name: str) -> dict:
    return json.loads((DATA_DIR / f"{name}.json").read_text(encoding="utf-8"))


def regulatory() -> dict:
    return load("regulatory")


def cities() -> dict:
    return load("cities")


def appliances() -> dict:
    return load("appliances")
