"""Outbound webhooks — fired best-effort after agent runs and handoff status
changes. A webhook delivery failure never fails the triggering operation."""
from __future__ import annotations

import logging
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.support import AgentWebhook

logger = logging.getLogger(__name__)

# Events clients can subscribe to.
KNOWN_EVENTS = frozenset({
    "run.completed",
    "handoff.status_changed",
    "knowledge.indexed",
})


class WebhookService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def dispatch(
        self, organization_id: uuid.UUID, event: str, payload: dict
    ) -> None:
        stmt = select(AgentWebhook).where(
            AgentWebhook.organization_id == organization_id,
            AgentWebhook.active.is_(True),
        )
        hooks = list((await self._session.execute(stmt)).scalars().all())
        targets = [h for h in hooks if event in (h.events or [])]
        if not targets:
            return

        body = {
            "event": event,
            "organization_id": str(organization_id),
            "data": payload,
        }
        async with httpx.AsyncClient(timeout=10) as client:
            for hook in targets:
                try:
                    await client.post(hook.url, json=body)
                    logger.debug("webhook_delivered url=%s event=%s", hook.url, event)
                except httpx.HTTPError as exc:
                    logger.warning(
                        "webhook_delivery_failed url=%s event=%s error=%s",
                        hook.url, event, exc,
                    )
