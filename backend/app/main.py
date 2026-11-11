import os
import re
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from google.genai import errors as genai_errors  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from . import billfetch, db, gemini  # noqa: E402
from .auth import optional_user, required_user  # noqa: E402
from .engine.audit import battery_options, run_audit  # noqa: E402
from .engine.data import cities, regulatory  # noqa: E402
from .engine.readiness import ReadinessIn, check as readiness_check  # noqa: E402
from .engine.validate import validate_quote  # noqa: E402
from .schemas import AuditRequest, Bill, Profile, Quote, SystemConfig  # noqa: E402

app = FastAPI(title="Roshni API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "*").split(","), allow_methods=["*"],
                   allow_headers=["*"])

MAX_BYTES = 15 * 1024 * 1024
MAX_FILES = 6
MAX_TEXT = 20000  # characters of pasted text sent to the AI
ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"}


async def _read(files: list[UploadFile]) -> list[tuple[bytes, str]]:
    if files and len(files) > MAX_FILES:
        raise HTTPException(400, f"Please upload at most {MAX_FILES} files at a time.")
    out = []
    for f in files or []:
        b = await f.read()
        mime = (f.content_type or "").lower()
        if mime not in ALLOWED:
            raise HTTPException(415, f"Unsupported file type {mime or 'unknown'}. Use JPG, PNG, HEIC or PDF.")
        if len(b) > MAX_BYTES:
            raise HTTPException(413, "File too large (max 15 MB).")
        if not b:
            raise HTTPException(400, "Empty file.")
        out.append((b, mime))
    return out


def _guard(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except genai_errors.APIError as e:
        raise HTTPException(502, f"AI service error ({e.code}): {e.message}")
    except ValueError as e:  # malformed model output that failed schema validation
        raise HTTPException(502, f"Could not read the AI response, please try again. ({str(e)[:200]})")


def _consent(consent: Optional[str]):
    # PRD 13.3: record user consent for AI processing before sending documents to the model
    if str(consent).lower() not in ("1", "true", "yes", "on"):
        raise HTTPException(400, "Please agree to AI processing of your document before uploading.")


@app.get("/api/health")
def health():
    return {"ok": True, "model": gemini.MODEL, "db": db.backend_name()}


@app.get("/api/meta")
def meta():
    reg = regulatory()
    return {"cities": list(cities()), "rules_as_of": reg["as_of"],
            "buyback_rate_rs": reg["regimes"]["NET_BILLING_2026"]["buyback_rate_rs"],
            "net_billing_start_date": reg["net_billing_start_date"], "protected_threshold": reg["protected"]["threshold_units"]}


# ---------- datasheet catalogue ----------
def _apply_catalogue(kind: str, brand: str | None, model: str | None, spec):
    """Fill a spec from the datasheet store when the model has been seen before (PRD 9.2 normalisation)."""
    if not (brand and model):
        return None
    row, score = db.find_datasheet(kind, brand, model)
    if not row:
        return None
    data = {**row["specs"], "source": row["source"], "verified": bool(row["verified"])}
    for k, v in data.items():
        if k in type(spec).model_fields and v is not None:
            setattr(spec, k, v)
    return {"kind": kind, "brand": row["brand"], "model": row["model"], "match": score, "verified": bool(row["verified"])}


def system_from_quote(q: Quote) -> tuple[SystemConfig, list[dict]]:
    s = SystemConfig()
    matches = []
    for li in q.line_items:
        txt = f"{li.description} {li.model or ''}"
        if li.item_type == "panel":
            s.panel_count += int(li.quantity or 0)
            m = re.search(r"(\d{3})\s*-?\s*W?", li.model or "") or re.search(r"(\d{3})\s*W", txt, re.I)
            if m and 250 <= int(m.group(1)) <= 750:
                s.panel.pmax_w = float(m.group(1))
            if (r := _apply_catalogue("panel", li.brand, li.model, s.panel)):
                matches.append(r)
        elif li.item_type == "inverter":
            m = re.search(r"(\d+(?:\.\d+)?)\s*k\s*W?", txt, re.I)
            if m:
                s.inverter.rated_kw = float(m.group(1))
            low = txt.lower()
            s.inverter.type = "hybrid" if "hybrid" in low else "off_grid" if "off" in low and "grid" in low else \
                "on_grid" if ("on-grid" in low or "on grid" in low or "grid tie" in low or "ongrid" in low) else None
            if (r := _apply_catalogue("inverter", li.brand, li.model, s.inverter)):
                matches.append(r)
        elif li.item_type == "battery":
            s.battery_count += int(li.quantity or 1)
            m = re.search(r"(\d+(?:\.\d+)?)\s*kWh", txt, re.I)
            if m:
                s.battery.nominal_kwh = float(m.group(1))
            if (r := _apply_catalogue("battery", li.brand, li.model, s.battery)):
                matches.append(r)
    s.panels_per_string = q.panels_per_string
    s.strings_per_mppt = q.strings_per_mppt
    return s, matches


@app.post("/api/extract/quote")
async def extract_quote(files: list[UploadFile] = File(default=[]), text: Optional[str] = Form(default=None),
                        consent: Optional[str] = Form(default=None)):
    data = await _read(files)
    if not data and not (text and text.strip()):
        raise HTTPException(400, "Upload a quote photo/PDF or paste the quote text.")
    if text and len(text) > MAX_TEXT:
        raise HTTPException(413, f"Pasted text is too long (max {MAX_TEXT:,} characters).")
    _consent(consent)
    q = _guard(gemini.extract_quote, data, text)
    system, matches = system_from_quote(q)
    return {"quote": q, "system": system, "validation": validate_quote(q), "catalogue_matches": matches}


@app.post("/api/validate/quote")
def validate(q: Quote):
    return {"validation": validate_quote(q)}


def _bill_response(d) -> dict:
    thr = regulatory()["protected"]["threshold_units"]
    units = d.bill.current_units
    warnings = []
    if d.bill.monthly_units_history and len(d.bill.monthly_units_history) < 12:
        warnings.append(f"Only {len(d.bill.monthly_units_history)} months of history could be read.")
    if units is None:
        warnings.append("Could not read this month's units; please enter them.")
    return {**d.model_dump(), "protected_threshold": thr,
            "units_to_threshold": (thr - units) if units is not None else None,
            "warnings": warnings, "rules_as_of": regulatory()["as_of"]}


@app.post("/api/extract/bill")
async def extract_bill(file: UploadFile = File(...), consent: Optional[str] = Form(default=None)):
    data = await _read([file])
    _consent(consent)
    return _bill_response(_guard(gemini.decode_bill, data))


class BillLookupReq(BaseModel):
    disco: str
    reference: str
    consent: bool = False


@app.get("/api/bill/companies")
def bill_companies():
    return {"supported": sorted(billfetch.DISCOS), "not_supported": ["K-Electric"],
            "source": "Official PITC web-bill portal (bill.pitc.com.pk)"}


@app.post("/api/bill/lookup")
def bill_lookup(r: BillLookupReq, request: Request):
    _consent(str(r.consent))
    try:
        billfetch.rate_limit(request.client.host if request.client else "anon")
        text = billfetch.fetch_bill_html(r.disco, r.reference)
    except billfetch.LookupError_ as e:
        status = {"invalid_ref": 400, "unsupported": 400, "not_found": 404, "rate_limited": 429, "captcha": 409}.get(e.code, 502)
        raise HTTPException(status, e.message)
    out = _bill_response(_guard(gemini.decode_bill_text, text))
    out["source"] = "official PITC portal"
    return out


class SpecReq(BaseModel):
    kind: Literal["panel", "inverter", "battery"]
    brand: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=120)


@app.post("/api/specs/lookup")
def specs_lookup(r: SpecReq):
    row, score = db.find_datasheet(r.kind, r.brand, r.model)
    if row:
        return {**row["specs"], "source": row["source"], "verified": bool(row["verified"]), "from_catalogue": True,
                "match": score}
    spec = _guard(gemini.lookup_specs, r.kind, r.brand, r.model)
    specs = spec.model_dump(exclude={"source", "verified"})
    if any(v is not None for v in specs.values()):
        db.save_datasheet(r.kind, r.brand, r.model, specs, spec.source, verified=False)  # goes to the review queue
    return {**spec.model_dump(), "from_catalogue": False}


class TextReq(BaseModel):
    text: str = Field(max_length=4000)


@app.post("/api/profile/parse")
def profile_parse(r: TextReq):
    if not r.text.strip():
        raise HTTPException(400, "Describe your home first.")
    return _guard(gemini.profile_from_text, r.text)


# ---------- audit + reports ----------
@app.post("/api/audit")
def audit(req: AuditRequest, user: Optional[dict] = Depends(optional_user)):
    if req.system.panel_count <= 0 and req.mode == "full":
        raise HTTPException(400, "Add the number of panels (and their wattage) before checking.")
    try:
        report = run_audit(req)
    except ValueError as e:
        raise HTTPException(400, str(e))
    report["validation"] = validate_quote(req.quote)
    s = report["system_summary"]
    title = (req.quote.installer_name or ("Parts list" if req.mode == "parts" else "Quote")) +         f" · {s['dc_kwp']} kWp {s['inverter_type'].replace('_', '-')}"
    rid, token = db.save_report(req.mode, req.model_dump(mode="json"), report,
                                user_id=user["sub"] if user else None, title=title)
    return {"id": rid, "report": report, "owner_token": token, "saved_to_account": bool(user)}


def _get(rid: str):
    row = db.get_report(rid)
    if not row:
        raise HTTPException(404, "Report not found (it may have been deleted).")
    return row


@app.get("/api/report/{rid}")
def get_report(rid: str):
    request, report = _get(rid)
    return {"id": rid, "request": request, "report": report}


def _require_manage(rid: str, user: Optional[dict], token: Optional[str]):
    ok = db.can_manage(rid, user["sub"] if user else None, token)
    if ok is None:
        raise HTTPException(404, "Report not found")
    if not ok:
        raise HTTPException(403, "Only the person who created this report can do that.")


@app.get("/api/report/{rid}/access")
def report_access(rid: str, user: Optional[dict] = Depends(optional_user), x_owner_token: Optional[str] = Header(default=None)):
    own = db.report_owner(rid)
    if own is None:
        raise HTTPException(404, "Report not found")
    return {"can_manage": bool(db.can_manage(rid, user["sub"] if user else None, x_owner_token)),
            "owned_by_you": bool(user and own[0] == user["sub"]), "in_an_account": own[0] is not None}


@app.delete("/api/report/{rid}")
def delete_report(rid: str, user: Optional[dict] = Depends(optional_user), x_owner_token: Optional[str] = Header(default=None)):
    # PRD 13.3: user-controlled deletion (only the creator, not everyone holding the share link)
    _require_manage(rid, user, x_owner_token)
    db.delete_report(rid)
    return {"deleted": rid}


@app.post("/api/report/{rid}/claim")
def claim_report(rid: str, user: dict = Depends(required_user), x_owner_token: Optional[str] = Header(default=None)):
    """Save an anonymous report to the signed-in user's history (needs the creator token)."""
    _require_manage(rid, user, x_owner_token)
    db.claim_report(rid, user["sub"])
    return {"claimed": rid}


@app.get("/api/me/reports")
def my_reports(user: dict = Depends(required_user)):
    return {"email": user.get("email"), "reports": db.list_user_reports(user["sub"])}


@app.delete("/api/me/reports")
def delete_my_reports(user: dict = Depends(required_user)):
    return {"deleted": db.delete_user_reports(user["sub"])}


@app.post("/api/report/{rid}/urdu")
def report_urdu(rid: str):
    _, rep = _get(rid)
    if not all("title_ur" in f for f in rep["findings"]):
        rep["findings"] = _guard(gemini.translate_findings, rep["findings"])
        db.update_report(rid, rep)
    return {"id": rid, "report": rep}


class OutcomeReq(BaseModel):
    outcome: Literal["renegotiated", "changed_config", "added_protection", "walked_away", "proceeded", "undecided"]
    would_pay: Optional[Literal["yes", "maybe", "no"]] = None
    comment: Optional[str] = None


@app.post("/api/report/{rid}/outcome")
def report_outcome(rid: str, r: OutcomeReq, user: Optional[dict] = Depends(optional_user),
                   x_owner_token: Optional[str] = Header(default=None)):
    _require_manage(rid, user, x_owner_token)
    return {"id": db.save_outcome(rid, r.outcome, r.would_pay, (r.comment or "")[:1000])}


# ---------- other journeys ----------
class BatteryReq(BaseModel):
    profile: Profile
    bill: Optional[Bill] = None
    dc_kw: float = Field(ge=0, le=2000)
    inverter_kw: float = Field(ge=0, le=2000)
    inverter_type: Literal["on_grid", "hybrid", "off_grid"] = "on_grid"
    cost_per_usable_kwh: float = Field(55000, gt=0, le=1000000)


@app.post("/api/battery")
def battery(r: BatteryReq):
    if r.dc_kw <= 0 or r.inverter_kw <= 0:
        raise HTTPException(400, "Enter your solar size and inverter size.")
    try:
        return battery_options(r.profile, r.bill, dc_kw=r.dc_kw, inverter_kw=r.inverter_kw,
                               cost_per_kwh=r.cost_per_usable_kwh, inverter_type=r.inverter_type)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/readiness")
def readiness(r: ReadinessIn):
    return readiness_check(r)


# ---------- assistant ----------
def _report_context(rid: str) -> dict | None:
    row = db.get_report(rid)
    if not row:
        return None
    rep = row[1]
    ctx = {k: rep[k] for k in ("mode", "verdict", "system_summary", "findings", "finance", "backup", "cashflow", "assumptions")
           if k in rep}
    if ctx.get("finance"):
        ctx["finance"] = {k: v for k, v in ctx["finance"].items() if k != "energy_monthly"}
    if ctx.get("cashflow"):
        ctx["cashflow"] = {k: v for k, v in ctx["cashflow"].items() if k != "series"}
    return ctx


class ChatMsg(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatReq(BaseModel):
    messages: list[ChatMsg] = Field(max_length=40)
    report_id: Optional[str] = Field(None, max_length=24)


@app.post("/api/chat")
def chat(r: ChatReq):
    if not r.messages:
        raise HTTPException(400, "Empty conversation.")
    if r.messages[-1].role != "user" or not r.messages[-1].content.strip():
        raise HTTPException(400, "Ask a question first.")
    ctx = _report_context(r.report_id) if r.report_id else None
    return {"reply": _guard(gemini.chat, [m.model_dump() for m in r.messages], ctx)}


@app.post("/api/chat/upload")
async def chat_upload(messages: str = Form(...), report_id: Optional[str] = Form(default=None),
                      files: list[UploadFile] = File(default=[]), consent: Optional[str] = Form(default=None)):
    import json
    data = await _read(files)
    if data:
        _consent(consent)
    try:
        msgs = [ChatMsg.model_validate(m).model_dump() for m in json.loads(messages)][-40:]
    except Exception:
        raise HTTPException(400, "Invalid conversation.")
    if not msgs or msgs[-1]["role"] != "user":
        raise HTTPException(400, "Ask a question first.")
    ctx = _report_context(report_id) if report_id else None
    return {"reply": _guard(gemini.chat, msgs, ctx, data)}


# ---------- admin: datasheet review queue + north-star metric ----------
def _admin(token: Optional[str]):
    want = os.getenv("ADMIN_TOKEN")
    if not want or token != want:
        raise HTTPException(401, "Admin token required.")


@app.get("/api/admin/datasheets")
def admin_datasheets(only_unverified: bool = False, x_admin_token: Optional[str] = Header(default=None)):
    _admin(x_admin_token)
    return db.list_datasheets(only_unverified)


class VerifyReq(BaseModel):
    specs: dict
    verified_by: str


@app.post("/api/admin/datasheets/{did}/verify")
def admin_verify(did: str, r: VerifyReq, x_admin_token: Optional[str] = Header(default=None)):
    _admin(x_admin_token)
    if not db.verify_datasheet(did, r.specs, r.verified_by):
        raise HTTPException(404, "Datasheet not found")
    return {"verified": did}


@app.get("/api/admin/stats")
def admin_stats(x_admin_token: Optional[str] = Header(default=None)):
    _admin(x_admin_token)
    return db.outcome_stats()


# ---------- compare quotes, health check, financing ----------
from .engine import extras  # noqa: E402


class CompareReq(BaseModel):
    ids: list[str] = Field(min_length=2, max_length=4)


@app.post("/api/compare")
def compare_reports(r: CompareReq):
    found = []
    for rid in dict.fromkeys(r.ids):
        row = db.get_report(rid)
        if not row:
            raise HTTPException(404, f"Report {rid} not found.")
        found.append((rid, row[0], row[1]))
    if len(found) < 2:
        raise HTTPException(400, "Pick at least two different reports.")
    return extras.compare(found)


@app.post("/api/health-check")
def health_check(h: extras.HealthIn):
    try:
        return extras.health_check(h)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/financing")
def financing(f: extras.FinanceIn):
    if f.down_payment_rs >= f.amount_rs:
        raise HTTPException(400, "Down payment must be less than the system price.")
    return extras.financing(f)


# ---------- brand guide ----------
from .engine import brands as brand_guide  # noqa: E402


@app.get("/api/brands")
def list_brands():
    g = brand_guide.guide()
    return {"as_of": g["as_of"], "policy": g["policy"], "category_labels": brand_guide.CATEGORY_LABELS,
            "category_checks": g["category_checks"], "brands": g["brands"]}


@app.get("/api/brands/{bid}")
def get_brand(bid: str):
    b = next((x for x in brand_guide.guide()["brands"] if x["id"] == bid), None)
    if not b:
        raise HTTPException(404, "Brand not found")
    return b
