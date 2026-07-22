"""Signs a service-identity JWT for calling the Node CRM services
(contact-service, campaign-service) the same way automation-service's
aiResponder.js signs a token to call ai-agent-service — HS256, same
JWT_SECRET, payload shape {userId, organizationId, role, permissions}
matching shared/src/auth.js's verifier on the Node side. This is the first
Python -> Node call in the codebase; every call here is best-effort and
must never fail the caller's primary request."""
from __future__ import annotations

import logging
import time
import uuid

import httpx
from jose import jwt

from app.config.settings import get_settings

logger = logging.getLogger(__name__)

_SERVICE_USER_ID = "00000000-0000-0000-0000-000000000000"


def sign_service_token(organization_id: uuid.UUID) -> str:
    settings = get_settings()
    now = int(time.time())
    payload = {
        "userId": _SERVICE_USER_ID,
        "organizationId": str(organization_id),
        "role": "admin",
        "permissions": ["contacts:read", "contacts:write", "campaigns:read", "campaigns:write"],
        "iat": now,
        "exp": now + 300,  # short-lived — minted fresh per call, never stored
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


async def get_contacts(organization_id: uuid.UUID, limit: int = 200) -> list[dict] | None:
    """Best-effort fetch — returns None on any failure rather than raising,
    since callers use this to enrich a prompt, not as a hard dependency."""
    settings = get_settings()
    token = sign_service_token(organization_id)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.CONTACT_SERVICE_URL}/contacts",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            return resp.json()[:limit]
    except Exception:
        logger.warning("contact_service_fetch_failed (non-fatal)", exc_info=True)
        return None


async def create_campaign(organization_id: uuid.UUID, *, name: str, type_: str, channel_type: str, message_body: str, status: str = "draft") -> dict:
    """Not best-effort — the caller (convert-plan-item route) needs a real
    result or a real error to show the user."""
    settings = get_settings()
    token = sign_service_token(organization_id)
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.post(
            f"{settings.CAMPAIGN_SERVICE_URL}/campaigns",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": name, "type": type_, "channel_type": channel_type, "message_body": message_body, "status": status},
        )
        resp.raise_for_status()
        return resp.json()
