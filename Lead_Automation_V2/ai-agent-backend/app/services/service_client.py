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


async def get_leads(organization_id: uuid.UUID, limit: int = 300) -> list[dict] | None:
    """Best-effort fetch of CRM leads (contact-service owns /leads). Returns
    None on any failure â€” the Cold Lead Revival Radar degrades to reasoning
    from contacts alone rather than hard-failing."""
    settings = get_settings()
    token = sign_service_token(organization_id)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.CONTACT_SERVICE_URL}/leads",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            return resp.json()[:limit]
    except Exception:
        logger.warning("lead_service_fetch_failed (non-fatal)", exc_info=True)
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


async def get_customer_context(organization_id: uuid.UUID, contact_id: str) -> dict | None:
    """Fetches the customer's own record so the Support Agent can answer
    account questions ("what plan am I on", "have you replied to me") from
    real data instead of deflecting.

    The knowledge base only holds documents; questions about *this customer*
    were previously unanswerable, and the agent would ask the customer for
    details the platform already had. Best-effort: returns None on any
    failure, since a missing record must not fail the support run.
    """
    settings = get_settings()
    token = sign_service_token(organization_id)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            headers = {"Authorization": f"Bearer {token}"}
            contact_resp = await client.get(
                f"{settings.CONTACT_SERVICE_URL}/contacts/{contact_id}", headers=headers
            )
            contact_resp.raise_for_status()
            contact = contact_resp.json()
            if not contact or not contact.get("id"):
                return None

            # The lead row (score/stage/priority) lives on a separate endpoint.
            lead = None
            try:
                leads_resp = await client.get(
                    f"{settings.CONTACT_SERVICE_URL}/leads", headers=headers
                )
                leads_resp.raise_for_status()
                lead = next(
                    (l for l in leads_resp.json() if str(l.get("contact_id")) == str(contact_id)),
                    None,
                )
            except Exception:
                logger.warning("lead_lookup_failed (non-fatal)", exc_info=True)

            return {"contact": contact, "lead": lead}
    except Exception:
        logger.warning("customer_context_fetch_failed (non-fatal)", exc_info=True)
        return None


def format_customer_context(ctx: dict | None) -> str | None:
    """Renders the account record as prompt text. Only fields that are
    actually populated are emitted, so the model never sees empty labels it
    might treat as real values."""
    if not ctx or not ctx.get("contact"):
        return None
    c = ctx["contact"]
    lead = ctx.get("lead") or {}

    lines = []
    for label, value in (
        ("Name", c.get("name")),
        ("Email", c.get("email")),
        ("Phone", c.get("phone")),
        ("Acquired via", c.get("source")),
        ("Customer since", (c.get("created_at") or "")[:10] or None),
        ("Tags", ", ".join(c.get("tags") or []) or None),
        ("Opted out of messaging", "yes" if c.get("opted_out") else None),
        ("Lead stage", lead.get("stage")),
        ("Lead score", lead.get("score")),
        ("Lead priority", lead.get("priority")),
    ):
        if value not in (None, "", []):
            lines.append(f"- {label}: {value}")

    notes = (c.get("notes") or "").strip()
    if notes:
        lines.append(f"- Notes on file: {notes[:600]}")

    return "\n".join(lines) if lines else None
