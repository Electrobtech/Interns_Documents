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


async def get_products(organization_id: uuid.UUID, status: str | None = None) -> list[dict] | None:
    """Best-effort fetch of products/offers (campaign-service owns
    /products). Used by SalesService.get_forecast/get_analytics to break
    pipeline value, revenue targets, and gap analysis down per product.
    Returns None on any failure — per-product breakdown degrades to
    org-wide-only rather than hard-failing the whole forecast."""
    settings = get_settings()
    token = sign_service_token(organization_id)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.CAMPAIGN_SERVICE_URL}/products",
                headers={"Authorization": f"Bearer {token}"},
                params={"status": status} if status else None,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception:
        logger.warning("product_service_fetch_failed (non-fatal)", exc_info=True)
        return None


async def get_follow_ups(organization_id: uuid.UUID, bucket: str | None = None) -> list[dict] | None:
    """Best-effort fetch of CRM follow-up reminders (contact-service owns
    /follow-ups). Used to build the Sales Agent's real task queue
    (GET /ai-agents/sales/queue) instead of the hardcoded "12 tasks queued"
    header badge. Returns None on any failure — the queue endpoint degrades
    to handoffs-only rather than hard-failing."""
    settings = get_settings()
    token = sign_service_token(organization_id)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.CONTACT_SERVICE_URL}/follow-ups",
                headers={"Authorization": f"Bearer {token}"},
                params={"bucket": bucket} if bucket else None,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception:
        logger.warning("follow_up_fetch_failed (non-fatal)", exc_info=True)
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


# ── Finances & Accounting (services/finance-service) ────────────────────────
#
# generate_course_invoice / record_expense are NOT best-effort — like
# create_campaign above, these are real financial/statutory writes (a GST
# invoice number, once issued, cannot be silently reused), so a failure
# must surface as a real error to whoever is confirming the action, not be
# swallowed.
#
# By design (see api/v1/finance_agent.py), the Sales Agent itself never
# calls these two directly from a chat turn — it only *proposes* a
# structured action for a human to review, exactly the same one-step-removed
# pattern this file already uses for create_campaign (agent drafts a plan
# item, POST .../convert commits it). That mirrors this repo's existing
# rule for the Sales Agent: "You NEVER take direct action on the CRM... you
# only produce... for a human to review and apply" (see
# app/agents/sales_agent.py's SYSTEM_PROMPT). Route a natural-language
# finance command ("record ₹45,000 developer salary payment") through
# POST /ai-agents/sales/finance/propose first, and only call the functions
# below from POST /ai-agents/sales/finance/confirm once a human has
# approved the parsed amount/category.

async def generate_course_invoice(
    organization_id: uuid.UUID,
    *,
    student_name: str,
    student_state: str,
    total_amount: float,
    course_name: str | None = None,
    student_gstin: str | None = None,
    student_address: str | None = None,
) -> dict:
    """Calls finance-service's POST /finances/invoices — computes the
    CGST/SGST-vs-IGST split, assigns the next gapless invoice number for
    this org+FY, and returns { invoice, transaction }. Raises on failure
    (bad seller GST profile, invalid amount, etc.) so the caller can show
    the real error rather than silently no-op'ing."""
    settings = get_settings()
    token = sign_service_token(organization_id)
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{settings.FINANCE_SERVICE_URL}/finances/invoices",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "studentName": student_name,
                "studentState": student_state,
                "totalAmount": total_amount,
                "courseName": course_name,
                "studentGstin": student_gstin,
                "studentAddress": student_address,
                "source": "ai_agent",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def record_expense(
    organization_id: uuid.UUID,
    *,
    category: str,
    amount: float,
    description: str | None = None,
    payment_method: str | None = None,
    reference_id: str | None = None,
) -> dict:
    """Calls finance-service's POST /finances/transactions with
    type=EXPENSE, source=ai_agent (tagged distinctly from manual entries —
    see the "AI Agent" badge in frontend/src/components/finances/
    ExpensesOutgoings.jsx). Raises on failure."""
    settings = get_settings()
    token = sign_service_token(organization_id)
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{settings.FINANCE_SERVICE_URL}/finances/transactions",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "type": "EXPENSE",
                "category": category,
                "amount": amount,
                "description": description,
                "paymentMethod": payment_method,
                "referenceId": reference_id,
                "source": "ai_agent",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_financial_summary(organization_id: uuid.UUID, *, from_date: str | None = None, to_date: str | None = None) -> dict | None:
    """Best-effort read (like get_contacts/get_leads above) — powers
    'what's our net revenue this month?'-style questions. Returns None on
    any failure rather than raising, since this only enriches a prompt."""
    settings = get_settings()
    token = sign_service_token(organization_id)
    params = {}
    if from_date:
        params["from"] = from_date
    if to_date:
        params["to"] = to_date
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.FINANCE_SERVICE_URL}/finances/summary",
                headers={"Authorization": f"Bearer {token}"},
                params=params or None,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception:
        logger.warning("finance_summary_fetch_failed (non-fatal)", exc_info=True)
        return None
