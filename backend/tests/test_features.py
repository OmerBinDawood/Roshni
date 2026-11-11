from fastapi.testclient import TestClient

from app import db
from app.engine.audit import run_audit
from app.engine.readiness import ReadinessIn, check
from app.engine.validate import validate_quote
from app.main import app
from app.schemas import LineItem, Quote
from tests.test_engine import sample_request

c = TestClient(app)
ADMIN = {"x-admin-token": "test-admin"}


def test_validator_arithmetic_and_models():
    q = Quote(line_items=[
        LineItem(item_type="panel", description="panels", brand="X", model="Y", quantity=10, unit_price=20000, line_total=150000),
        LineItem(item_type="inverter", description="inverter 6kW", quantity=1, unit_price=300000),
    ], grand_total=600000)
    msgs = " | ".join(i["msg"] for i in validate_quote(q))
    assert "line total says Rs 150,000" in msgs
    assert "no exact model number" in msgs
    assert "grand total says Rs 600,000" in msgs


def test_parts_mode_has_no_finance_but_runs_safety_rules():
    req = sample_request()
    req.mode = "parts"
    r = run_audit(req)
    assert r["finance"] is None and r["cashflow"] is None
    ids = {f["rule_id"] for f in r["findings"]}
    assert "R03" in ids and "R19" not in ids and "R22" not in ids


def test_backup_items_on_grid_nothing_runs():
    req = sample_request()
    req.system.inverter.type = "on_grid"
    r = run_audit(req)
    assert r["backup"]["items"] and all(i["runs"] is False for i in r["backup"]["items"])
    assert any(f["rule_id"] == "R25" for f in r["findings"])


def test_reconciliation_prompt_when_answers_disagree():
    req = sample_request()
    req.bill.monthly_units_history = [100] * 12   # tiny bills vs 2 ACs
    req.bill.bill_month = 10
    r = run_audit(req)
    assert r["reconciliation_prompts"], r["reconciliation"]
    assert "Do the ACs run fewer hours" in r["reconciliation_prompts"][0]


def test_legacy_regime_detected():
    req = sample_request()
    req.profile.net_metering_agreement_date = "2024-05-01"
    r = run_audit(req)
    assert r["finance"]["regime"] == "LEGACY_NET_METERING" and r["finance"]["legacy_expiry_year"] == 2031
    assert not any(f["rule_id"] == "R19" and f["severity"] == "CRITICAL" for f in r["findings"])


def test_missing_datasheet_is_cannot_verify_not_pass():
    req = sample_request()
    req.system.panel.voc = None
    r = run_audit(req)
    r03 = next(f for f in r["findings"] if f["rule_id"] == "R03")
    assert r03["severity"] == "CLARIFY" and r03["title"].startswith("Cannot verify")


def test_readiness():
    assert check(ReadinessIn(owns_home=False))["verdict"] == "not_now"
    assert check(ReadinessIn(shade="heavy"))["verdict"] == "not_now"
    assert check(ReadinessIn(avg_monthly_units=60))["verdict"] == "not_now"
    ok = check(ReadinessIn(avg_monthly_units=600, roof_area_sqft=1200))
    assert ok["verdict"] == "ready" and ok["suggested_kw"] == 5.0
    assert c.post("/api/readiness", json={"avg_monthly_units": 500}).status_code == 200


def test_report_lifecycle_outcome_delete():
    r = c.post("/api/audit", content=sample_request().model_dump_json(), headers={"content-type": "application/json"})
    rid = r.json()["id"]
    assert c.post(f"/api/report/{rid}/outcome", json={"outcome": "renegotiated", "would_pay": "yes"}).status_code == 200
    assert c.post(f"/api/report/{rid}/outcome", json={"outcome": "bogus"}).status_code == 422
    stats = c.get("/api/admin/stats", headers=ADMIN).json()
    assert stats["decisions_improved"] >= 1
    assert c.delete(f"/api/report/{rid}").status_code == 200
    assert c.get(f"/api/report/{rid}").status_code == 404


def test_datasheet_store_fuzzy_and_review_queue():
    did = db.save_datasheet("panel", "LONGi", "LR5-72HTH-580M", {"voc": 52.2, "pmax_w": 580}, "https://x", verified=False)
    row, score = db.find_datasheet("panel", "Longi", "LR5 72HTH 580M")
    assert row and row["id"] == did and score == 100
    row2, score2 = db.find_datasheet("panel", "LONGi", "LR5-72HTH-580")  # near miss
    assert row2 and score2 >= 92
    assert c.get("/api/admin/datasheets").status_code == 401
    q = c.get("/api/admin/datasheets?only_unverified=true", headers=ADMIN).json()
    assert any(d["id"] == did for d in q)
    assert c.post(f"/api/admin/datasheets/{did}/verify", json={"specs": {"voc": 52.27, "pmax_w": 580}, "verified_by": "eng"},
                  headers=ADMIN).status_code == 200
    # lookup now served from the catalogue, verified, without calling Gemini
    lk = c.post("/api/specs/lookup", json={"kind": "panel", "brand": "LONGi", "model": "LR5-72HTH-580M"}).json()
    assert lk["from_catalogue"] and lk["verified"] and lk["voc"] == 52.27


def test_upload_requires_consent_and_type():
    r = c.post("/api/extract/quote", data={"text": "10 x panel"})
    assert r.status_code == 400 and "agree" in r.json()["detail"]
    r = c.post("/api/extract/bill", files={"file": ("a.txt", b"hi", "text/plain")}, data={"consent": "true"})
    assert r.status_code == 415


def test_battery_with_existing_hybrid():
    req = sample_request()
    r = c.post("/api/battery", json={"profile": req.profile.model_dump(), "dc_kw": 6, "inverter_kw": 6, "inverter_type": "hybrid"})
    j = r.json()
    assert r.status_code == 200 and j["needs_inverter_change"] is False
    assert c.post("/api/battery", json={"profile": req.profile.model_dump(), "dc_kw": 0, "inverter_kw": 6}).status_code == 400


def test_bundled_bos_line_counts_as_mentioned_not_missing():
    req = sample_request()
    req.quote.line_items.append(LineItem(item_type="other", description="Mounting structure, cabling, earthing (2 pits), DC/AC SPD"))
    r = run_audit(req)
    by = {f["rule_id"]: f["title"] for f in r["findings"]}
    for rid in ("R12", "R13", "R14", "R15", "R16"):
        assert "not listed" not in by.get(rid, ""), (rid, by.get(rid))
        assert "mentioned but not itemised" in by[rid]


def test_combined_breaker_line_satisfies_ac_and_dc():
    req = sample_request()
    req.quote.line_items.append(LineItem(item_type="dc_breaker", description="DC breaker + SPD, AC breaker"))
    ids = {f["rule_id"] for f in run_audit(req)["findings"]}
    assert "R12" not in ids
    r13 = [f for f in run_audit(req)["findings"] if f["rule_id"] == "R13"]
    assert not r13, r13


def test_grand_total_mismatch_of_1_percent_is_flagged():
    q = Quote(line_items=[LineItem(item_type="panel", description="p", brand="a", model="b", quantity=14, unit_price=22000, line_total=308000),
                          LineItem(item_type="battery", description="b", brand="a", model="b", quantity=1, unit_price=1225000, line_total=1225000)],
              grand_total=1550000)
    assert any("grand total says Rs 1,550,000" in i["msg"] for i in validate_quote(q))
