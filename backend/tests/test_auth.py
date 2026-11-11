import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app import auth
from app.main import app
from tests.test_engine import sample_request

KEY = ec.generate_private_key(ec.SECP256R1())


class FakeJWKS:
    def get_signing_key_from_jwt(self, token):
        return type("K", (), {"key": KEY.public_key()})()


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch):
    monkeypatch.setattr(auth, "_jwks", lambda: FakeJWKS())


def token(sub="user-1", email="a@example.com", exp=3600, aud="authenticated", key=KEY):
    return jwt.encode({"sub": sub, "email": email, "aud": aud, "exp": int(time.time()) + exp}, key, algorithm="ES256")


c = TestClient(app)
H = lambda t: {"authorization": f"Bearer {t}"}  # noqa: E731


def audit(headers=None):
    r = c.post("/api/audit", content=sample_request().model_dump_json(), headers={"content-type": "application/json", **(headers or {})})
    assert r.status_code == 200, r.text
    return r.json()


def test_signed_in_audit_is_saved_to_history():
    t = token(sub="user-hist")
    j = audit(H(t))
    assert j["saved_to_account"] is True
    mine = c.get("/api/me/reports", headers=H(t)).json()
    assert mine["email"] == "a@example.com" and any(r["id"] == j["id"] for r in mine["reports"])
    other = c.get("/api/me/reports", headers=H(token(sub="someone-else"))).json()
    assert not any(r["id"] == j["id"] for r in other["reports"])
    # owner can delete without the anonymous token; others cannot
    assert c.delete(f"/api/report/{j['id']}", headers=H(token(sub="someone-else"))).status_code == 403
    assert c.delete(f"/api/report/{j['id']}", headers=H(t)).status_code == 200


def test_claim_anonymous_report_requires_creator_token():
    j = audit()
    t = token(sub="claimer")
    assert c.post(f"/api/report/{j['id']}/claim", headers=H(t)).status_code == 403          # just has the link
    assert c.post(f"/api/report/{j['id']}/claim").status_code == 401                         # not signed in
    r = c.post(f"/api/report/{j['id']}/claim", headers={**H(t), "x-owner-token": j["owner_token"]})
    assert r.status_code == 200
    assert any(x["id"] == j["id"] for x in c.get("/api/me/reports", headers=H(t)).json()["reports"])
    acc = c.get(f"/api/report/{j['id']}/access", headers=H(t)).json()
    assert acc["owned_by_you"] and acc["can_manage"]


def test_clock_skew_tolerated_just_after_sign_in():
    # a token that expired a few seconds ago on our clock (skew) is still accepted
    assert c.get("/api/me/reports", headers=H(token(exp=-10))).status_code == 200


def test_bad_tokens_rejected():
    assert c.get("/api/me/reports").status_code == 401
    assert c.get("/api/me/reports", headers=H(token(exp=-300))).status_code == 401
    assert c.get("/api/me/reports", headers=H(token(aud="anon"))).status_code == 401
    other_key = ec.generate_private_key(ec.SECP256R1())
    assert c.get("/api/me/reports", headers=H(token(key=other_key))).status_code == 401
    assert c.get("/api/me/reports", headers=H("not-a-jwt")).status_code == 401


def test_delete_all_my_reports():
    t = token(sub="wipe-me")
    audit(H(t)); audit(H(t))
    assert c.delete("/api/me/reports", headers=H(t)).json()["deleted"] == 2
    assert c.get("/api/me/reports", headers=H(t)).json()["reports"] == []
