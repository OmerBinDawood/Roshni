from fastapi.testclient import TestClient
from app.main import app
from tests.test_engine import sample_request

c = TestClient(app)


def test_meta():
    assert "Lahore" in c.get("/api/meta").json()["cities"]


def test_audit_roundtrip():
    r = c.post("/api/audit", content=sample_request().model_dump_json(), headers={"content-type": "application/json"})
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    g = c.get(f"/api/report/{rid}").json()
    assert g["report"]["verdict"] == "red"


def test_battery():
    req = sample_request()
    r = c.post("/api/battery", json={"profile": req.profile.model_dump(), "bill": req.bill.model_dump(), "dc_kw": 6, "inverter_kw": 6})
    assert r.status_code == 200 and len(r.json()["options"]) == 4
