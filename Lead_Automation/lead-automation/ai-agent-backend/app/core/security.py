"""JWT verification matching shared/src/auth.js exactly: HS256, payload
{userId, organizationId, role, permissions}, same JWT_SECRET."""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt

from app.config.settings import get_settings


@dataclass
class AuthUser:
    user_id: str
    organization_id: str
    role: str
    permissions: list[str]


def _decode(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


async def get_current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    payload = _decode(authorization.removeprefix("Bearer ").strip())
    return AuthUser(
        user_id=payload["userId"],
        organization_id=payload["organizationId"],
        role=payload.get("role", "agent"),
        permissions=payload.get("permissions", []),
    )


async def get_raw_bearer_token(authorization: str | None = Header(default=None)) -> str | None:
    if authorization and authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip()
    return None
