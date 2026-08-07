"""JWT verification and permission checks.

Orbq never issues tokens (ADR-011). `auth-service` does. This module verifies
them against the shared secret, matching the claim shape produced by the Node
side's `shared/src/auth.js`: {userId, organizationId, role, permissions}.
"""
from __future__ import annotations

import uuid
from typing import Any

import jwt

from .errors import UnauthorizedError
from .tenancy import TenantContext

# Permission codes, mirroring the Node side's shared/src/permissions.js.
PERM_AI_USE = "ai_agents:use"
PERM_AI_MANAGE = "ai_agents:manage"
PERM_AI_APPROVE = "ai_agents:approve"
PERM_KNOWLEDGE_MANAGE = "ai_agents:manage"

# The platform's `permissions` table defines only `ai_agents:manage` — the
# finer-grained codes above are Orbq's own vocabulary. Without this expansion
# every real token 403s on every agent endpoint, because auth-service can only
# ever grant a code that exists in its table. Manage is strictly broader than
# use/approve, so implying them widens nothing.
_IMPLIED_PERMISSIONS: dict[str, frozenset[str]] = {
    PERM_AI_MANAGE: frozenset({PERM_AI_USE, PERM_AI_APPROVE}),
}


def expand_permissions(codes: frozenset[str]) -> frozenset[str]:
    implied = set(codes)
    for code in codes:
        implied |= _IMPLIED_PERMISSIONS.get(code, frozenset())
    return frozenset(implied)


def decode_token(token: str, *, secret: str, algorithm: str = "HS256") -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=[algorithm],
            options={"require": ["exp"]},  # a token without expiry is a permanent key
        )
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("Invalid authentication token") from exc


def tenant_from_claims(claims: dict[str, Any], *, workspace: str | None = None) -> TenantContext:
    """Map JWT claims onto a TenantContext.

    Accepts both camelCase (Node's shape) and snake_case so the same verifier
    works if the platform's claim naming is ever normalized.
    """
    org_raw = claims.get("organizationId") or claims.get("organization_id") or claims.get("org_id")
    user_raw = claims.get("userId") or claims.get("user_id") or claims.get("sub")

    if not org_raw:
        # No org claim means we cannot scope anything — refuse rather than
        # falling back to an unscoped query.
        raise UnauthorizedError("Token is missing an organization claim")
    if not user_raw:
        raise UnauthorizedError("Token is missing a user claim")

    try:
        org_id = uuid.UUID(str(org_raw))
        user_id = uuid.UUID(str(user_raw))
    except ValueError as exc:
        raise UnauthorizedError("Token contains a malformed identifier") from exc

    raw_perms = claims.get("permissions") or []
    if isinstance(raw_perms, str):
        raw_perms = [p.strip() for p in raw_perms.split(",") if p.strip()]

    return TenantContext(
        org_id=org_id,
        user_id=user_id,
        role=str(claims.get("role", "agent")),
        permissions=expand_permissions(frozenset(raw_perms)),
        workspace=workspace,
    )


def extract_bearer(authorization: str | None) -> str:
    if not authorization:
        raise UnauthorizedError("Missing Authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError("Authorization header must be 'Bearer <token>'")
    return token
