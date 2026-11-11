"""Persistence. Uses DATABASE_URL (Postgres/Supabase) when set, otherwise a local SQLite file.

Tables follow PRD 11.3: reports (quote + audit snapshot), datasheets (catalogue for models seen in quotes,
with a review queue), decision_outcomes (north-star metric).
"""
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from rapidfuzz import fuzz, process
from sqlalchemy import (JSON, Boolean, Column, DateTime, MetaData, String, Table, Text, create_engine, delete,
                        insert, select, update)

_default = f"sqlite:///{Path(__file__).resolve().parent.parent / 'roshni.db'}"
URL = os.getenv("DATABASE_URL") or _default
if URL.startswith("postgres://"):
    URL = "postgresql://" + URL[len("postgres://"):]
if URL.startswith("postgresql://"):
    URL = "postgresql+psycopg://" + URL[len("postgresql://"):]

engine = create_engine(URL, pool_pre_ping=True, future=True)
meta = MetaData()


def now():
    return datetime.now(timezone.utc)


reports = Table(
    "reports", meta,
    Column("id", String(24), primary_key=True),
    Column("created_at", DateTime(timezone=True), default=now),
    Column("mode", String(16)),
    Column("request", JSON),
    Column("report", JSON),
    Column("user_id", String(64), index=True),         # Supabase auth user (null = anonymous)
    Column("owner_token_hash", String(64)),            # sha256 of the creator's private token (anonymous ownership)
    Column("title", String(200)),
)

datasheets = Table(
    "datasheets", meta,
    Column("id", String(24), primary_key=True),
    Column("kind", String(16), index=True),
    Column("brand", String(80)),
    Column("model", String(120)),
    Column("key", String(220), index=True),
    Column("specs", JSON),
    Column("source", Text),
    Column("verified", Boolean, default=False),
    Column("verified_by", String(80)),
    Column("verified_at", DateTime(timezone=True)),
    Column("created_at", DateTime(timezone=True), default=now),
    Column("seen_count", JSON),  # int stored as JSON for portability
)

outcomes = Table(
    "decision_outcomes", meta,
    Column("id", String(24), primary_key=True),
    Column("report_id", String(24), index=True),
    Column("outcome", String(32)),
    Column("would_pay", String(16)),
    Column("comment", Text),
    Column("reported_at", DateTime(timezone=True), default=now),
)

meta.create_all(engine)


def _migrate():
    """Add columns introduced after a table was first created (works on SQLite and Postgres)."""
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    for table in meta.sorted_tables:
        have = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name not in have:
                ddl = col.type.compile(dialect=engine.dialect)
                with engine.begin() as c:
                    c.execute(text(f'alter table {table.name} add column {col.name} {ddl}'))
                    if col.index:
                        c.execute(text(f'create index if not exists ix_{table.name}_{col.name} on {table.name} ({col.name})'))


_migrate()

if engine.dialect.name == "postgresql":
    # Supabase exposes the public schema over its REST API with the publishable key. Enable RLS with no
    # policies so only this backend (connecting as the postgres role, which bypasses RLS) can read or write.
    from sqlalchemy import text

    with engine.begin() as _c:
        for _t in ("reports", "datasheets", "decision_outcomes"):
            _c.execute(text(f"alter table public.{_t} enable row level security"))


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def backend_name() -> str:
    return engine.dialect.name


# ---------- reports ----------
def _hash(token: str) -> str:
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()


def save_report(mode: str, request: dict, report: dict, user_id: str | None = None, title: str | None = None) -> tuple[str, str]:
    """Returns (report_id, owner_token). The token lets an anonymous creator delete or claim the report later."""
    import secrets
    rid, token = new_id(), secrets.token_urlsafe(24)
    with engine.begin() as c:
        c.execute(insert(reports).values(id=rid, mode=mode, request=request, report=report, created_at=now(),
                                         user_id=user_id, owner_token_hash=_hash(token), title=(title or "")[:200]))
    return rid, token


def get_report(rid: str):
    with engine.begin() as c:
        r = c.execute(select(reports.c.request, reports.c.report).where(reports.c.id == rid)).first()
    return (r[0], r[1]) if r else None


def report_owner(rid: str):
    with engine.begin() as c:
        r = c.execute(select(reports.c.user_id, reports.c.owner_token_hash).where(reports.c.id == rid)).first()
    return (r[0], r[1]) if r else None


def can_manage(rid: str, user_id: str | None, token: str | None) -> bool | None:
    """None = no such report. Owner user, or holder of the creator token, may manage it."""
    own = report_owner(rid)
    if own is None:
        return None
    owner_user, token_hash = own
    if user_id and owner_user == user_id:
        return True
    return bool(token and token_hash and _hash(token) == token_hash)


def update_report(rid: str, report: dict):
    with engine.begin() as c:
        c.execute(update(reports).where(reports.c.id == rid).values(report=report))


def claim_report(rid: str, user_id: str) -> bool:
    with engine.begin() as c:
        n = c.execute(update(reports).where(reports.c.id == rid).values(user_id=user_id)).rowcount
    return n > 0


def list_user_reports(user_id: str) -> list[dict]:
    q = (select(reports.c.id, reports.c.created_at, reports.c.mode, reports.c.title, reports.c.report)
         .where(reports.c.user_id == user_id).order_by(reports.c.created_at.desc()).limit(200))
    with engine.begin() as c:
        rows = c.execute(q).mappings().all()
    out = []
    for r in rows:
        rep = r["report"] or {}
        fin = rep.get("finance") or {}
        out.append({"id": r["id"], "created_at": r["created_at"].isoformat() if r["created_at"] else None, "mode": r["mode"],
                    "title": r["title"], "verdict": rep.get("verdict"), "counts": rep.get("counts"),
                    "system_summary": rep.get("system_summary"), "capex": rep.get("capex"),
                    "savings_monthly": fin.get("savings_monthly")})
    return out


def delete_report(rid: str) -> bool:
    with engine.begin() as c:
        c.execute(delete(outcomes).where(outcomes.c.report_id == rid))
        n = c.execute(delete(reports).where(reports.c.id == rid)).rowcount
    return n > 0


def delete_user_reports(user_id: str) -> int:
    with engine.begin() as c:
        ids = [r[0] for r in c.execute(select(reports.c.id).where(reports.c.user_id == user_id)).all()]
        if ids:
            c.execute(delete(outcomes).where(outcomes.c.report_id.in_(ids)))
            c.execute(delete(reports).where(reports.c.id.in_(ids)))
    return len(ids)


# ---------- datasheets ----------
def norm_key(brand: str | None, model: str | None) -> str:
    s = f"{brand or ''} {model or ''}".lower()
    return re.sub(r"[^a-z0-9]+", "", s)


def find_datasheet(kind: str, brand: str, model: str, threshold: int = 92):
    """Exact normalised match first, then fuzzy match within the same kind."""
    key = norm_key(brand, model)
    with engine.begin() as c:
        rows = c.execute(select(datasheets).where(datasheets.c.kind == kind)).mappings().all()
    if not rows:
        return None, None
    for r in rows:
        if r["key"] == key:
            return dict(r), 100
    best = process.extractOne(key, {i: r["key"] for i, r in enumerate(rows)}, scorer=fuzz.ratio)
    if best and best[1] >= threshold:
        return dict(rows[best[2]]), round(best[1])
    return None, None


def save_datasheet(kind: str, brand: str, model: str, specs: dict, source: str | None, verified=False) -> str:
    existing, score = find_datasheet(kind, brand, model, threshold=100)
    with engine.begin() as c:
        if existing:
            c.execute(update(datasheets).where(datasheets.c.id == existing["id"])
                      .values(seen_count=int(existing.get("seen_count") or 1) + 1))
            return existing["id"]
        did = new_id()
        c.execute(insert(datasheets).values(id=did, kind=kind, brand=brand, model=model, key=norm_key(brand, model),
                                            specs=specs, source=source, verified=verified, seen_count=1, created_at=now()))
        return did


def list_datasheets(only_unverified=False):
    q = select(datasheets).order_by(datasheets.c.created_at.desc())
    if only_unverified:
        q = q.where(datasheets.c.verified.is_(False))
    with engine.begin() as c:
        return [dict(r) for r in c.execute(q).mappings().all()]


def verify_datasheet(did: str, specs: dict, by: str) -> bool:
    with engine.begin() as c:
        n = c.execute(update(datasheets).where(datasheets.c.id == did)
                      .values(specs=specs, verified=True, verified_by=by, verified_at=now())).rowcount
    return n > 0


# ---------- outcomes ----------
def save_outcome(report_id: str, outcome: str, would_pay: str | None, comment: str | None) -> str:
    oid = new_id()
    with engine.begin() as c:
        c.execute(insert(outcomes).values(id=oid, report_id=report_id, outcome=outcome, would_pay=would_pay,
                                          comment=comment, reported_at=now()))
    return oid


def outcome_stats() -> dict:
    with engine.begin() as c:
        rows = c.execute(select(outcomes.c.outcome)).all()
        n_reports = len(c.execute(select(reports.c.id)).all())
    counts: dict = {}
    for (o,) in rows:
        counts[o] = counts.get(o, 0) + 1
    changed = sum(v for k, v in counts.items() if k in ("renegotiated", "changed_config", "added_protection", "walked_away"))
    return {"reports": n_reports, "responses": len(rows), "by_outcome": counts,
            "decisions_improved": changed, "json": json.dumps(counts)}
