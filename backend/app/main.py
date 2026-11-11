import json
import re
import sqlite3
import uuid
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from . import gemini  # noqa: E402
from .engine.audit import battery_options, run_audit  # noqa: E402
from .engine.data import cities, regulatory  # noqa: E402
from .schemas import AuditRequest, Bill, Profile, Quote, SystemConfig  # noqa: E402

app = FastAPI(title="Roshni API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB = Path(__file__).resolve().parent.parent / "roshni.db"
MAX_BYTES = 15 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"}


def db():
    con = sqlite3.connect(DB)
    con.execute("CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, created TEXT DEFAULT CURRENT_TIMESTAMP, "
                "request TEXT, report TEXT)")
    return con


async def _read(files: list[UploadFile]) -> list[tuple[bytes, str]]:
    out = []
    for f in files or []:
        b = await f.read()
        mime = (f.content_type or "").lower()
        if mime not in ALLOWED:
            raise HTTPException(415, f"Unsupported file type {mime}. Use JPG, PNG, HEIC or PDF.")
        if len(b) > MAX_BYTES:
            raise HTTPException(413, "File too large (max 15 MB).")
        out.append((b, mime))
    return out


def _guard(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.get("/api/health")
def health():
    return {"ok": True, "model": gemini.MODEL}


@app.get("/api/meta")
def meta():
    reg = regulatory()
    return {"cities": list(cities()), "rules_as_of": reg["as_of"],
            "buyback_rate_rs": reg["regimes"]["NET_BILLING_2026"]["buyback_rate_rs"],
            "net_billing_start_date": reg["net_billing_start_date"], "protected_threshold": reg["protected"]["threshold_units"]}


def system_from_quote(q: Quote) -> SystemConfig:
    s = SystemConfig()
    for li in q.line_items:
        txt = f"{li.description} {li.model or ''}"
        if li.item_type == "panel":
            s.panel_count += int(li.quantity or 0)
            m = re.search(r"(\d{3})\s*-?\s*W?", li.model or "") or re.search(r"(\d{3})\s*W", txt, re.I)
            if m and 250 <= int(m.group(1)) <= 750:
                s.panel.pmax_w = float(m.group(1))
        elif li.item_type == "inverter":
            m = re.search(r"(\d+(?:\.\d+)?)\s*k\s*W?", txt, re.I)
            if m:
                s.inverter.rated_kw = float(m.group(1))
            low = txt.lower()
            s.inverter.type = "hybrid" if "hybrid" in low else "off_grid" if "off" in low and "grid" in low else \
                "on_grid" if ("on-grid" in low or "on grid" in low or "grid tie" in low) else None
        elif li.item_type == "battery":
            s.battery_count += int(li.quantity or 1)
            m = re.search(r"(\d+(?:\.\d+)?)\s*kWh", txt, re.I)
            if m:
                s.battery.nominal_kwh = float(m.group(1))
    return s


@app.post("/api/extract/quote")
async def extract_quote(files: list[UploadFile] = File(default=[]), text: Optional[str] = Form(default=None)):
    data = await _read(files)
    if not data and not (text and text.strip()):
        raise HTTPException(400, "Upload a quote photo/PDF or paste the quote text.")
    q = _guard(gemini.extract_quote, data, text)
    return {"quote": q, "system": system_from_quote(q)}


@app.post("/api/extract/bill")
async def extract_bill(file: UploadFile = File(...)):
    data = await _read([file])
    d = _guard(gemini.decode_bill, data)
    thr = regulatory()["protected"]["threshold_units"]
    units = d.bill.current_units
    return {**d.model_dump(), "protected_threshold": thr,
            "units_to_threshold": (thr - units) if units is not None else None,
            "rules_as_of": regulatory()["as_of"]}


class SpecReq(BaseModel):
    kind: Literal["panel", "inverter", "battery"]
    brand: str
    model: str


@app.post("/api/specs/lookup")
def specs_lookup(r: SpecReq):
    return _guard(gemini.lookup_specs, r.kind, r.brand, r.model)


class TextReq(BaseModel):
    text: str


@app.post("/api/profile/parse")
def profile_parse(r: TextReq):
    return _guard(gemini.profile_from_text, r.text)


@app.post("/api/audit")
def audit(req: AuditRequest):
    try:
        report = run_audit(req)
    except ValueError as e:
        raise HTTPException(400, str(e))
    rid = uuid.uuid4().hex[:12]
    with db() as con:
        con.execute("INSERT INTO reports (id, request, report) VALUES (?,?,?)",
                    (rid, req.model_dump_json(), json.dumps(report)))
    return {"id": rid, "report": report, "request": req}


@app.get("/api/report/{rid}")
def get_report(rid: str):
    with db() as con:
        row = con.execute("SELECT request, report FROM reports WHERE id=?", (rid,)).fetchone()
    if not row:
        raise HTTPException(404, "Report not found")
    return {"id": rid, "request": json.loads(row[0]), "report": json.loads(row[1])}


@app.post("/api/report/{rid}/urdu")
def report_urdu(rid: str):
    data = get_report(rid)
    rep = data["report"]
    if not all("title_ur" in f for f in rep["findings"]):
        rep["findings"] = _guard(gemini.translate_findings, rep["findings"])
        with db() as con:
            con.execute("UPDATE reports SET report=? WHERE id=?", (json.dumps(rep), rid))
    return {"id": rid, "report": rep}


class BatteryReq(BaseModel):
    profile: Profile
    bill: Optional[Bill] = None
    dc_kw: float
    inverter_kw: float
    cost_per_usable_kwh: float = 55000


@app.post("/api/battery")
def battery(r: BatteryReq):
    try:
        return battery_options(r.profile, r.bill, dc_kw=r.dc_kw, inverter_kw=r.inverter_kw, cost_per_kwh=r.cost_per_usable_kwh)
    except ValueError as e:
        raise HTTPException(400, str(e))


class ChatReq(BaseModel):
    messages: list[dict]
    report_id: Optional[str] = None
    context: Optional[dict] = None


@app.post("/api/chat")
def chat(r: ChatReq):
    ctx = r.context
    if r.report_id:
        try:
            ctx = get_report(r.report_id)["report"]
            ctx = {k: ctx[k] for k in ("verdict", "system_summary", "findings", "finance", "backup", "cashflow", "assumptions") if k in ctx}
            if ctx.get("finance"):
                ctx["finance"] = {k: v for k, v in ctx["finance"].items() if k != "energy_monthly"}
            if ctx.get("cashflow"):
                ctx["cashflow"] = {k: v for k, v in ctx["cashflow"].items() if k != "series"}
        except HTTPException:
            pass
    return {"reply": _guard(gemini.chat, r.messages, ctx)}
