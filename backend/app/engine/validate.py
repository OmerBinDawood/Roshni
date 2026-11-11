"""Deterministic checks on extracted quotes (PRD 9.2): types, units, arithmetic, unknown models."""
from ..schemas import Quote


def _close(a: float, b: float, rel: float = 0.005, floor: float = 1.0) -> bool:
    """Rounding tolerance: 0.5% for line arithmetic by default."""
    return abs(a - b) <= max(floor, rel * max(abs(a), abs(b)))


def validate_quote(q: Quote) -> list[dict]:
    issues: list[dict] = []
    total = 0.0
    all_priced = True
    for i, li in enumerate(q.line_items):
        label = li.description or li.item_type
        if li.quantity is not None and li.quantity <= 0:
            issues.append({"line": i, "level": "error", "msg": f"'{label}': quantity must be positive."})
        if li.unit_price is not None and li.unit_price < 0:
            issues.append({"line": i, "level": "error", "msg": f"'{label}': price cannot be negative."})
        if li.quantity and li.unit_price is not None and li.line_total is not None:
            if not _close(li.quantity * li.unit_price, li.line_total):
                issues.append({"line": i, "level": "warn",
                               "msg": f"'{label}': {li.quantity:g} x Rs {li.unit_price:,.0f} = Rs {li.quantity * li.unit_price:,.0f}, "
                                      f"but the line total says Rs {li.line_total:,.0f}."})
        lt = li.line_total if li.line_total is not None else (
            li.quantity * li.unit_price if li.quantity and li.unit_price is not None else None)
        if lt is None:
            all_priced = False
        else:
            total += lt
        if li.item_type in ("panel", "inverter", "battery") and not li.model:
            issues.append({"line": i, "level": "warn", "msg": f"'{label}': no exact model number. Roshni will not guess it."})
        if li.item_type == "panel" and li.unit_price and li.unit_price > 200000:
            issues.append({"line": i, "level": "warn", "msg": f"'{label}': Rs {li.unit_price:,.0f} per panel looks like a line total, not a unit price."})
        if li.low_confidence:
            issues.append({"line": i, "level": "warn", "msg": f"'{label}': hard to read; please check."})
    if q.grand_total is not None and all_priced and q.line_items and not _close(total, q.grand_total, rel=0.002, floor=100):
        issues.append({"line": None, "level": "warn",
                       "msg": f"Line totals add up to Rs {total:,.0f}, but the grand total says Rs {q.grand_total:,.0f} "
                              f"(difference Rs {q.grand_total - total:,.0f})."})
    if not any(li.item_type == "panel" for li in q.line_items):
        issues.append({"line": None, "level": "info", "msg": "No solar panels found in the quote."})
    return issues
