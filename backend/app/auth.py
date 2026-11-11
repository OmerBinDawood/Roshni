"""Supabase Auth: verify the user's access token (JWT) against the project's published signing keys (JWKS).

Signed-in users can keep their reports; everyone else stays anonymous (PRD 20: no account for the first audit).
"""
import os
from functools import lru_cache
from typing import Optional

import jwt
from fastapi import Header, HTTPException


@lru_cache
def _jwks() -> Optional[jwt.PyJWKClient]:
    url = os.getenv("SUPABASE_JWKS_URL") or (
        f"{os.getenv('SUPABASE_URL').rstrip('/')}/auth/v1/.well-known/jwks.json" if os.getenv("SUPABASE_URL") else None)
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600) if url else None


def verify(token: str) -> dict:
    client = _jwks()
    if not client:
        raise HTTPException(503, "Sign-in is not configured on this server.")
    try:
        key = client.get_signing_key_from_jwt(token)
        return jwt.decode(token, key.key, algorithms=["ES256", "RS256", "EdDSA"], audience="authenticated",
                          options={"require": ["exp", "sub"]})
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"Your session is invalid or expired. Please sign in again. ({type(e).__name__})")


def optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    """FastAPI dependency: the signed-in user's claims, or None when anonymous."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return verify(authorization.split(" ", 1)[1].strip())


def required_user(authorization: Optional[str] = Header(default=None)) -> dict:
    user = optional_user(authorization)
    if not user:
        raise HTTPException(401, "Please sign in.")
    return user
