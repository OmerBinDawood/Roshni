"""Neutral brand guide (no rankings): who makes it, what it is, what to check, how to verify."""
import re

from rapidfuzz import fuzz

from .data import load

CATEGORY_LABELS = {"panel": "Solar panels", "inverter": "Inverters", "battery_lithium": "Lithium batteries",
                   "battery_lead_acid": "Lead-acid (tubular / UPS) batteries"}


def guide() -> dict:
    return load("brands")


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def match(*texts: str | None) -> dict | None:
    """Find the brand mentioned in a brand/model/description string. Exact alias words first, then fuzzy name."""
    hay = " " + " ".join(_norm(t) for t in texts if t) + " "
    if not hay.strip():
        return None
    best, best_len = None, 0
    for b in guide()["brands"]:
        for alias in [b["name"], b["id"].replace("-", " "), *b["aliases"]]:
            a = _norm(alias)
            # whole-word match; prefer the longest alias (so "ja solar" beats "ja")
            if a and len(a) >= 2 and f" {a} " in hay and len(a) > best_len:
                best, best_len = b, len(a)
    if best:
        return best
    # Fuzzy fallback for misspellings ("Jinkko", "Pylonteck"): compare each word of the text with names and aliases
    generic = {"solar", "battery", "batteries", "energy", "power", "panel", "panels", "lithium", "inverter", "hybrid",
               "tubular", "green", "global", "micro", "series", "force", "box", "plus"}
    words = [w for w in hay.split() if len(w) >= 4 and w not in generic]
    best_score, best_brand = 0.0, None
    for b in guide()["brands"]:
        for alias in [b["name"], *b["aliases"]]:
            head = _norm(alias).split()[0] if _norm(alias) else ""
            if len(head) < 4 or head in generic:
                continue
            for w in words:
                score = fuzz.ratio(w, head)
                if score > best_score:
                    best_score, best_brand = score, b
    return best_brand if best_score >= 85 else None


def item_category(item_type: str, text: str) -> str | None:
    if item_type == "panel":
        return "panel"
    if item_type == "inverter":
        return "inverter"
    if item_type == "battery":
        return "battery_lead_acid" if re.search(r"tubular|lead|acid|agm|gel|ups battery|\bah\b.*12 ?v", text.lower()) else "battery_lithium"
    return None


def brand_notes(line_items: list) -> list[dict]:
    """For each main item in a quote, the matching brand profile and the checks for that kind of product."""
    g, out, seen = guide(), [], set()
    for li in line_items:
        text = f"{li.description or ''} {li.model or ''}"
        cat = item_category(li.item_type, text)
        if not cat:
            continue
        b = match(li.brand, li.model, li.description)
        key = (b["id"] if b else (li.brand or "unknown"), cat)
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "item_type": li.item_type, "category": cat, "category_label": CATEGORY_LABELS[cat],
            "brand_text": li.brand or None,
            "brand": {k: b[k] for k in ("id", "name", "origin", "about", "technology", "pakistan", "verify", "kind")} if b else None,
            "checks": g["category_checks"][cat],
        })
    return out


def price_data() -> dict:
    return load("brand_prices")


def prices_for(brand_id: str, category: str | None = None) -> list[dict]:
    rows = price_data()["prices"].get(brand_id, [])
    return [r for r in rows if category is None or r["category"] == category]


def _fmt_price(r: dict) -> str:
    if r["unit"] == "per_w":
        span = f"Rs {r['low']:g}" + (f" to {r['high']:g}" if r["high"] != r["low"] else "") + " per watt"
    else:
        span = f"Rs {r['low']:,.0f}" + (f" to {r['high']:,.0f}" if r["high"] != r["low"] else "")
    when = f"listed {r['as_of']}" if r.get("as_of") else "undated"
    return f"{r['product']}: {span} ({when}, {r['confidence']})"


def knowledge_text() -> str:
    """Compact brand guide for the assistant's knowledge base."""
    g = guide()
    lines = [f"## Brand guide (as of {g['as_of']}; neutral, no rankings)", g["policy"]]
    for b in g["brands"]:
        v = b.get("verify") or {}
        cats = ", ".join(CATEGORY_LABELS[c] for c in b["categories"])
        lines.append(f"- **{b['name']}** ({cats}; {b['origin']}): {b['about']} {b['technology']} Pakistan: {b['pakistan']}"
                     + (f" Verify: {v.get('label')} {v.get('url') or ''}" if v else ""))
    for cat, checks in g["category_checks"].items():
        lines.append(f"### What to check: {CATEGORY_LABELS[cat]}")
        lines += [f"- {c}" for c in checks]
    pd = price_data()
    lines.append(f"### Dealer price listings (collected {pd['as_of']})")
    lines.append(pd["disclaimer"])
    for bid, rows in pd["prices"].items():
        name = next((b["name"] for b in g["brands"] if b["id"] == bid), bid)
        lines.append(f"- {name}: " + "; ".join(_fmt_price(r) for r in rows))
    lines.append("Users can browse all brands at /brands.")
    return "\n".join(lines)
