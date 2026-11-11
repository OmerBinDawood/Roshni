from fastapi.testclient import TestClient

from app.main import app
from tests.test_engine import sample_request

c = TestClient(app)


def _audit(**over):
    req = sample_request()
    for k, v in over.items():
        setattr(req.quote, k, v)
    return c.post("/api/audit", content=req.model_dump_json(), headers={"content-type": "application/json"}).json()["id"]


def test_compare_normalises_and_highlights():
    a = _audit(installer_name="Alpha Solar", grand_total=900000)
    b = _audit(installer_name="Beta Energy", grand_total=1200000)
    r = c.post("/api/compare", json={"ids": [a, b]}).json()
    rows = {x["title"]: x for x in r["rows"]}
    assert rows["Alpha Solar"]["rs_per_w_system"] < rows["Beta Energy"]["rs_per_w_system"]
    assert rows["Alpha Solar"]["rs_per_w_panels"] == round(234000 / 5850, 1)
    assert any("Alpha Solar" in n for n in r["notes"])
    assert c.post("/api/compare", json={"ids": [a, a]}).status_code == 400
    assert c.post("/api/compare", json={"ids": [a]}).status_code == 422
    assert c.post("/api/compare", json={"ids": [a, "nope"]}).status_code == 404


def test_health_check_flags_low_generation_and_settings():
    good = c.post("/api/health-check", json={"city": "Lahore", "dc_kw": 5, "readings": [{"month": 5, "kwh": 760}]}).json()
    assert good["verdict"] == "healthy", good
    bad = c.post("/api/health-check", json={"city": "Lahore", "dc_kw": 5, "inverter_kw": 3, "zero_export": True,
                                            "bill_not_dropping": True,
                                            "readings": [{"month": 5, "kwh": 300}, {"month": 6, "kwh": 320}]}).json()
    assert bad["verdict"] in ("underperforming", "seriously_low")
    txt = " ".join(bad["possible_causes"] + bad["settings_checklist"])
    assert "Zero-export" in txt and "clipped" in txt and "Grid charging" in txt and "bill did not drop" in txt
    assert c.post("/api/health-check", json={"city": "Atlantis", "dc_kw": 5, "readings": [{"month": 1, "kwh": 1}]}).status_code == 400
    assert c.post("/api/health-check", json={"city": "Lahore", "dc_kw": 5, "readings": []}).status_code == 422
    assert c.post("/api/health-check", json={"city": "Lahore", "dc_kw": 5, "readings": [{"month": 13, "kwh": 1}]}).status_code == 422


def test_financing_emi_maths_and_verdicts():
    r = c.post("/api/financing", json={"amount_rs": 1000000, "markup_pct": 18, "months": 36,
                                       "savings_low": 20000, "savings_expected": 40000}).json()
    assert r["instalment"] == 36152  # standard annuity formula
    assert r["verdict"] == "mostly_covered"
    zero = c.post("/api/financing", json={"amount_rs": 120000, "markup_pct": 0, "months": 12}).json()
    assert zero["instalment"] == 10000 and zero["total_markup"] == 0
    assert c.post("/api/financing", json={"amount_rs": 100, "markup_pct": 10, "months": 12, "down_payment_rs": 100}).status_code == 400
    assert c.post("/api/financing", json={"amount_rs": 100, "markup_pct": 10, "months": 0}).status_code == 422


def test_api_input_bounds():
    req = sample_request().model_dump(mode="json")
    req["system"]["panel_count"] = -3
    assert c.post("/api/audit", json=req).status_code == 422
    req = sample_request().model_dump(mode="json")
    req["profile"]["outage_hours_per_day"] = 30
    assert c.post("/api/audit", json=req).status_code == 422
    req = sample_request().model_dump(mode="json")
    req["profile"]["city"] = "Atlantis"
    assert c.post("/api/audit", json=req).status_code == 400
    assert c.post("/api/chat", json={"messages": []}).status_code == 400
    assert c.post("/api/chat", json={"messages": [{"role": "system", "content": "x"}]}).status_code == 422
    assert c.post("/api/chat", json={"messages": [{"role": "user", "content": "x" * 5000}]}).status_code == 422
    assert c.post("/api/chat", json={"messages": [{"content": "hi"}]}).status_code == 422
    assert c.post("/api/extract/quote", data={"text": "x" * 25000, "consent": "true"}).status_code == 413
    files = [("files", (f"a{i}.png", b"x", "image/png")) for i in range(7)]
    assert c.post("/api/extract/quote", files=files, data={"consent": "true"}).status_code == 400
    assert c.post("/api/extract/bill", files={"file": ("e.png", b"", "image/png")}, data={"consent": "true"}).status_code == 400
    assert c.post("/api/readiness", json={"avg_monthly_units": -5}).status_code == 422
    assert c.post("/api/specs/lookup", json={"kind": "panel", "brand": "", "model": "x"}).status_code == 422
    assert c.get("/api/report/doesnotexist").status_code == 404


def test_engine_edge_cases():
    from app.engine.audit import run_audit
    from app.engine.finance import select_regime
    from app.schemas import AC, Bill, Profile
    # long outages are modelled (no 12 h cap)
    r12, r20 = sample_request(), sample_request()
    r12.profile.outage_hours_per_day, r20.profile.outage_hours_per_day = 12, 20
    assert run_audit(r20)["finance"]["annual"]["unserved_kwh"] > run_audit(r12)["finance"]["annual"]["unserved_kwh"]
    # AC hours up to 12 count
    a, b = sample_request(), sample_request()
    a.bill = b.bill = None
    a.profile.acs, b.profile.acs = [AC(day_hours=8, night_hours=0)], [AC(day_hours=12, night_hours=0)]
    assert run_audit(b)["finance"]["annual"]["load_kwh"] > run_audit(a)["finance"]["annual"]["load_kwh"]
    # expired legacy agreement -> net billing; live one -> legacy
    assert select_regime(Profile(net_metering_agreement_date="2018-03-01"))[0] == "NET_BILLING_2026"
    assert select_regime(Profile(net_metering_agreement_date="2025-06-01")) == ("LEGACY_NET_METERING", 2032)
    # zero panels / unknown battery capacity produce clear findings
    z = sample_request()
    z.system.panel_count = 0
    assert any(f["rule_id"] == "R02" and "Number of panels" in f["title"] for f in run_audit(z)["findings"])
    nb = sample_request()
    nb.system.battery.usable_kwh = nb.system.battery.nominal_kwh = None
    assert any(f["rule_id"] == "R09" and f["title"].startswith("Cannot verify") for f in run_audit(nb)["findings"])
    # north-facing panels flagged
    n = sample_request()
    n.system.azimuth, n.system.tilt = 0, 30
    assert any(f["rule_id"] == "R26" for f in run_audit(n)["findings"])
    # odd bills must not crash
    for bill in (Bill(current_units=0, total_amount_rs=500), Bill(current_units=400, monthly_units_history=[400] * 30),
                 Bill(current_units=400, bill_month=13, monthly_units_history=[0] * 12),
                 Bill(current_units=50, total_amount_rs=10**7)):
        x = sample_request()
        x.bill = bill
        assert run_audit(x)["verdict"] in ("red", "amber", "green")
    # off-grid without battery, cold city
    o = sample_request()
    o.system.inverter.type = "off_grid"
    o.system.battery_count = 0
    o.system.battery.usable_kwh = o.system.battery.nominal_kwh = None
    assert run_audit(o)["backup"]["works_in_outage"] is True
    q = sample_request()
    q.profile.city = "Quetta"
    assert run_audit(q)["site"]["t_min_air"] < 0
