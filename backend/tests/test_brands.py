from fastapi.testclient import TestClient

from app.engine.audit import run_audit
from app.engine.brands import guide, knowledge_text, match
from app.main import app
from tests.test_engine import sample_request

c = TestClient(app)

REQUESTED = ["longi", "jinko", "ja-solar", "canadian-solar", "trina", "aiko", "astronergy", "risen", "inverex", "crown",
             "solis", "growatt", "huawei", "sungrow", "deye", "knox", "goodwe", "fox-ess", "fronus", "ags", "exide", "osaka",
             "phoenix", "volta", "daewoo", "pylontech", "dyness", "byd", "narada", "felicity", "itel", "ziewnic", "sunwoda",
             "soluna", "sacred-sun", "hithium", "leoch"]


def test_every_requested_brand_has_a_complete_profile():
    g = guide()
    by_id = {b["id"]: b for b in g["brands"]}
    for bid in REQUESTED:
        assert bid in by_id, bid
        b = by_id[bid]
        for key in ("name", "categories", "origin", "about", "technology", "pakistan"):
            assert b[key], (bid, key)
        assert set(b["categories"]) <= set(g["category_checks"]), bid
    assert len({b["id"] for b in g["brands"]}) == len(g["brands"])  # unique ids


def test_guide_is_neutral():
    text = knowledge_text().lower()
    for word in ("best brand", "shortlist", "top pick", "number one", "#1"):
        assert word not in text, word
    assert "does not rank" in guide()["policy"]


def test_matching_names_models_and_typos():
    cases = {("LONGi", "LR5-72HTH-580M", ""): "longi", ("", "JKM585N", "Jinko Tiger Neo"): "jinko",
             ("JA", "JAM72D40", ""): "ja-solar", ("", "SUN-6K-SG04LP1", "Deye hybrid"): "deye",
             ("Pylontech", "US5000", ""): "pylontech", ("Jinkko", "", ""): "jinko", ("Pylonteck", "", ""): "pylontech",
             ("AGS", "", "tubular 200Ah"): "ags", ("", "", "Nitrox 6kW hybrid"): "inverex"}
    for args, want in cases.items():
        got = match(*args)
        assert got and got["id"] == want, (args, got and got["id"])
    for args in (("Local", "", "12V lithium battery"), ("", "", "Solar energy panel 550W"), ("Unknown Co", "X1", "")):
        assert match(*args) is None, args


def test_report_includes_brand_notes_with_checks():
    r = run_audit(sample_request())
    notes = {n["category"]: n for n in r["brands"]}
    assert notes["panel"]["brand"]["id"] == "longi" and notes["panel"]["brand"]["verify"]["url"].startswith("https://www.longi.com")
    assert notes["inverter"]["brand"]["id"] == "deye"
    assert notes["battery_lithium"]["brand"]["id"] == "pylontech"
    assert all(n["checks"] for n in r["brands"])


def test_unknown_brand_still_gets_checks_and_tubular_detected():
    from app.schemas import LineItem
    req = sample_request()
    req.quote.line_items.append(LineItem(item_type="battery", description="200Ah tubular battery", brand="Generic"))
    notes = run_audit(req)["brands"]
    lead = [n for n in notes if n["category"] == "battery_lead_acid"]
    assert lead and lead[0]["brand"] is None and lead[0]["checks"]


def test_brand_api():
    j = c.get("/api/brands").json()
    assert len(j["brands"]) >= 37 and "panel" in j["category_checks"]
    assert c.get("/api/brands/deye").json()["name"] == "Deye"
    assert c.get("/api/brands/nope").status_code == 404
