"""Agent webhook subscriptions (Phase 5) — CRUD guarded by ai_agents:manage."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.models.support import AgentWebhook
from app.services.audit_service import log_audit

router = APIRouter()


class WebhookIn(BaseModel):
    url: HttpUrl
    events: list[str] = Field(default_factory=lambda: ["run.completed"])


class WebhookOut(BaseModel):
    id: uuid.UUID
    url: str
    events: list[str]
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/webhooks", response_model=list[WebhookOut])
async def list_webhooks(
    user: AuthUser = Depends(require_permission("ai_agents:manage")),
    session: AsyncSession = Depends(get_session),
) -> list[WebhookOut]:
    org = uuid.UUID(user.organization_id)
    rows = (await session.execute(select(AgentWebhook).where(AgentWebhook.organization_id == org))).scalars().all()
    return [WebhookOut.model_validate(r) for r in rows]


@router.post("/webhooks", response_model=WebhookOut, status_code=201)
async def create_webhook(
    body: WebhookIn,
    user: AuthUser = Depends(require_permission("ai_agents:manage")),
    session: AsyncSession = Depends(get_session),
) -> WebhookOut:
    org = uuid.UUID(user.organization_id)
    hook = AgentWebhook(organization_id=org, url=str(body.url), events=body.events)
    session.add(hook)
    await log_audit(session, org, user.user_id, "ai_agents.webhook.create", {"url": str(body.url)})
    await session.commit()
    return WebhookOut.model_validate(hook)


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: uuid.UUID,
    user: AuthUser = Depends(require_permission("ai_agents:manage")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    org = uuid.UUID(user.organization_id)
    result = await session.execute(
        delete(AgentWebhook).where(AgentWebhook.id == webhook_id, AgentWebhook.organization_id == org)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await log_audit(session, org, user.user_id, "ai_agents.webhook.delete", {"id": str(webhook_id)})
    await session.commit()
    return {"ok": True}
