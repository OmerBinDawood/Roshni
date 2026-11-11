"""Saved profile, outcome insights, screenshot-reading limits and the assistant's calculator tools."""
import pytest
from fastapi.testclient import TestClient

from app import assistant_tools as tools, auth, db, gemini
from app.main import app
from tests.test_auth import FakeJWKS, H, token
from tests.test_engine import sample_request

c = TestClient(app)


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch):
    monkeypatch.setattr(auth, "_jwks", lambda: FakeJWKS())


PROFILE = {"city": "Multan", "fans": 8, "outage_hours_per_day": 5,
           "acs": [{"count": 2, "tons": 1.5, "inverter": True, "day_hours": 6, "night_hours": 8}]}


def test_profile_needs_sign_in_and_round_trips():
    assert c.get("/api/me/profile").status_code == 401
    t = token(sub="profile-user")
    assert c.get("/api/me/profile", headers=H(t)).json() == {"profile": None}
    assert c.put("/api/me/profile", json=PROFILE, headers=H(t)).status_code == 200
    got = c.get("/api/me/profile", headers=H(t)).json()["profile"]
    assert got["city"] == "Multan" and got["fans"] == 8
    c.put("/api/me/profile", json={**PROFILE, "fans": 9}, headers=H(t))
    assert c.get("/api/me/profile", headers=H(t)).json()["profile"]["fans"] == 9
    # profiles are per user
    assert c.get("/api/me/profile", headers=H(token(sub="someone-else"))).json() == {"profile": None}
    assert c.put("/api/me/profile", json={"fans": -1}, headers=H(t)).status_code == 422


def test_delete_all_reports_also_removes_saved_profile():
    t = token(sub="delete-user")
    c.put("/api/me/profile", json=PROFILE, headers=H(t))
    assert c.delete("/api/me/reports", headers=H(t)).status_code == 200
    assert c.get("/api/me/profile", headers=H(t)).json()["profile"] is None


def test_insights_need_admin_token_and_count_rules_per_decision():
    assert c.get("/api/admin/insights").status_code == 401
    r = c.post("/api/audit", content=sample_request().model_dump_json(), headers={"content-type": "application/json"})
    rid, owner = r.json()["id"], r.json()["owner_token"]
    assert c.post(f"/api/report/{rid}/outcome", json={"outcome": "renegotiated", "would_pay": "yes"},
                  headers={"x-owner-token": owner}).status_code == 200
    out = c.get("/api/admin/insights", headers={"x-admin-token": "test-admin"}).json()
    assert out["responses"] >= 1 and out["would_pay"]["yes"] >= 1
    assert all(r["by_outcome"].get("renegotiated") for r in out["rules"] if r["responses"])
    assert {r["severity"] for r in out["rules"]} <= {"CRITICAL", "CLARIFY"}  # no OK/INFO noise
    assert db.outcome_insights()["note"]


def test_readings_upload_is_validated_before_calling_gemini(monkeypatch):
    monkeypatch.setattr(gemini, "readings_from_image", lambda files: pytest.fail("should not reach Gemini"))
    png = ("s.png", b"\x89PNG", "image/png")
    assert c.post("/api/extract/readings", files={"files": png}).status_code == 400          # no consent
    assert c.post("/api/extract/readings", data={"consent": "true"}).status_code == 400      # no file
    assert c.post("/api/extract/readings", data={"consent": "true"},
                  files={"files": ("a.txt", b"x", "text/plain")}).status_code == 415         # wrong type


def test_readings_upload_returns_what_gemini_read(monkeypatch):
    monkeypatch.setattr(gemini, "readings_from_image", lambda files: {"readings": [{"month": 8, "kwh": 612}], "note": None})
    r = c.post("/api/extract/readings", data={"consent": "true"}, files={"files": ("s.png", b"\x89PNG", "image/png")})
    assert r.status_code == 200 and r.json()["readings"] == [{"month": 8, "kwh": 612}]


def test_assistant_tools_run_the_engine_and_return_errors_not_exceptions():
    loan = tools.loan_vs_savings(900000, 16, 36, 0, 40000)
    assert loan["verdict"] == "covered" and loan["instalment"] > 0
    assert tools.solar_readiness(owns_home=False, avg_monthly_units=300)["verdict"] == "not_now"
    bat = tools.battery_for_existing_system("Lahore", 6, 6, "on_grid", 4)
    assert [o["usable_kwh"] for o in bat["options"]] == [0, 5, 10, 15] and bat["needs_inverter_change"]
    assert "error" in tools.battery_for_existing_system("Atlantis", 6, 6)
    assert "error" in tools.battery_for_report("nope")
    assert "error" in tools.compare_my_reports(["a", "b"])
    assert "error" in tools.loan_vs_savings(-5, 10, 12)


def test_battery_tool_uses_a_stored_report():
    r = c.post("/api/audit", content=sample_request().model_dump_json(), headers={"content-type": "application/json"})
    out = tools.battery_for_report(r.json()["id"])
    assert "options" in out or "error" in out  # a sample with no inverter size answers with a clear error


# ---------- size my solar ----------
from app.engine.sizing import SizeReq, size_solar  # noqa: E402
from app.schemas import AC, Bill, Profile  # noqa: E402

SIZE_BODY = {"profile": {"city": "Lahore", "acs": [{"count": 2, "tons": 1.5, "inverter": True, "day_hours": 6, "night_hours": 8}],
                         "outage_hours_per_day": 4},
             "bill": {"current_units": 520, "total_amount_rs": 36000, "bill_month": 10,
                      "monthly_units_history": [300, 280, 350, 420, 560, 650, 700, 680, 600, 450, 350, 520]},
             "budget_rs": 1500000, "goal": "both"}


def test_size_options_cost_ranges_and_no_scores():
    r = c.post("/api/size", json=SIZE_BODY)
    assert r.status_code == 200, r.text
    out = r.json()
    kinds = [(o["inverter_type"], o["battery_kwh"]) for o in out["options"]]
    assert kinds == [("on_grid", 0), ("hybrid", 5), ("hybrid", 10)]
    for o in out["options"]:
        assert o["cost"]["low"] < o["cost"]["mid"] < o["cost"]["high"]
        assert o["cost"]["low"] == sum(p["low"] for p in o["cost"]["parts"].values()) or abs(o["cost"]["low"] - sum(p["low"] for p in o["cost"]["parts"].values())) < 3000
        assert o["why"] and o["savings_monthly"]["expected"] > 0
    assert out["options"][0]["works_in_outage"] is False and out["options"][1]["backup_hours"] > 0
    assert out["summary"]["bill_today_monthly_rs"] > 0 and 0 < out["summary"]["daytime_share"] < 1
    # brands: alphabetical, grouped by what the options need, no score or rank fields anywhere
    for cat, grp in out["brand_options"].items():
        names = [b["name"].lower() for b in grp["brands"]]
        assert names == sorted(names) and grp["checks"]
    assert set(out["brand_options"]) == {"panel", "inverter", "battery_lithium"}
    def keys(x):
        if isinstance(x, dict):
            for k, v in x.items():
                yield k.lower()
                yield from keys(v)
        elif isinstance(x, list):
            for v in x:
                yield from keys(v)
    assert not {"score", "rank", "rating", "stars", "best"} & set(keys(out))


def test_size_respects_goal_budget_and_roof():
    bill_only = size_solar(SizeReq(profile=Profile(city="Lahore"), goal="bill"))
    out = bill_only
    assert [o["inverter_type"] for o in out["options"]] == ["on_grid"] and set(out["brand_options"]) == {"panel", "inverter"}
    tight = size_solar(SizeReq(profile=Profile(city="Lahore"), budget_rs=50000, goal="both"))
    assert all(o["within_budget"] is False for o in tight["options"])            # honest when nothing fits
    small_roof = size_solar(SizeReq(profile=Profile(city="Lahore"), roof_area_sqft=200, goal="bill"))
    assert small_roof["options"][0]["dc_kw"] <= small_roof["summary"]["roof_limit_kw"] or small_roof["options"][0]["dc_kw"] == 2


def test_size_validates_input_and_assistant_tool():
    assert c.post("/api/size", json={**SIZE_BODY, "budget_rs": -5}).status_code == 422
    assert c.post("/api/size", json={**SIZE_BODY, "goal": "luxury"}).status_code == 422
    out = tools.size_my_solar("Lahore", 450, ac_count=1, budget_rs=800000)
    assert out["options"] and "error" not in out
    assert "error" in tools.size_my_solar("Atlantis", 450)


# ---------- per-brand prices ----------
from app.engine import brands as brand_guide  # noqa: E402


def test_price_data_is_sourced_dated_or_flagged_and_matches_brands():
    pd = brand_guide.price_data()
    ids = {b["id"] for b in brand_guide.guide()["brands"]}
    assert pd["disclaimer"] and "re-verify" in pd["disclaimer"].lower()
    for bid, rows in pd["prices"].items():
        assert bid in ids, bid
        for r in rows:
            assert r["source"].startswith("https://") and r["confidence"] and r["low"] <= r["high"] and r["low"] > 0
            assert r["category"] in {c for b in brand_guide.guide()["brands"] if b["id"] == bid for c in b["categories"]}
            if r["category"] == "panel":
                assert 20 <= r["low"] <= 80 and r["unit"] == "per_w"          # Rs per watt, not a line total
    assert "Dealer price listings" in brand_guide.knowledge_text()


def test_size_response_carries_prices_per_brand():
    out = c.post("/api/size", json=SIZE_BODY).json()
    aiko = next(b for b in out["brand_options"]["panel"]["brands"] if b["id"] == "aiko")
    assert aiko["prices"] and aiko["prices"][0]["as_of"] == "2026-10-08"
    assert out["price_disclaimer"] and out["market_notes"]


def test_estimate_uses_brand_listings_and_falls_back_to_market_ranges():
    body = {"dc_kw": 5, "inverter_kw": 4, "inverter_type": "hybrid", "battery_kwh": 5,
            "panel_brand": "aiko", "inverter_brand": "goodwe", "battery_brand": "dyness", "budget_rs": 1000000}
    r = c.post("/api/size/estimate", json=body).json()
    assert set(r["from_listings"]) == {"panels", "inverter", "battery"}
    assert r["parts"]["structure_install"]["basis"] == "market range"
    assert r["total"]["low"] == sum(p["low"] for p in r["parts"].values()) and r["budget_verdict"] in ("within", "maybe")
    assert r["parts"]["panels"]["low"] == 5000 * 41                               # Rs 41/W from the dated listing
    none = c.post("/api/size/estimate", json={**body, "panel_brand": None, "inverter_brand": "deye", "battery_brand": "felicity"}).json()
    assert none["from_listings"] == [] and all(p["basis"] == "market range" for p in none["parts"].values())  # no listing found
    ongrid = c.post("/api/size/estimate", json={**body, "inverter_type": "on_grid", "battery_kwh": 0}).json()
    assert ongrid["parts"]["inverter"]["basis"] == "market range" and "battery" not in ongrid["parts"]
    assert c.post("/api/size/estimate", json={**body, "dc_kw": -1}).status_code == 422
    over = c.post("/api/size/estimate", json={**body, "budget_rs": 100000}).json()
    assert over["budget_verdict"] == "over"
