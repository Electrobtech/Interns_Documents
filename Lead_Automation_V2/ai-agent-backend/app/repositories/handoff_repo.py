from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.handoff import HandoffRequest


class HandoffRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        organization_id: uuid.UUID,
        agent_type: str,
        original_brief: str,
        agent_output: dict,
        customer_name: str | None = None,
        channel: str | None = None,
        session_id: str | None = None,
    ) -> HandoffRequest:
        req = HandoffRequest(
            organization_id=organization_id,
            agent_type=agent_type,
            original_brief=original_brief,
            agent_output=agent_output,
            customer_name=customer_name,
            channel=channel,
            session_id=session_id,
            status="pending",
        )
        self._session.add(req)
        await self._session.flush()
        return req

    async def list_for_org(
        self,
        organization_id: uuid.UUID,
        status: str | None = None,
        agent_type: str | None = None,
        limit: int = 50,
    ) -> list[HandoffRequest]:
        stmt = (
            select(HandoffRequest)
            .where(HandoffRequest.organization_id == organization_id)
            .order_by(HandoffRequest.created_at.desc())
            .limit(limit)
        )
        if status:
            stmt = stmt.where(HandoffRequest.status == status)
        if agent_type:
            stmt = stmt.where(HandoffRequest.agent_type == agent_type)
        return list((await self._session.execute(stmt)).scalars().all())

    async def get(self, organization_id: uuid.UUID, handoff_id: uuid.UUID) -> HandoffRequest | None:
        stmt = select(HandoffRequest).where(
            HandoffRequest.id == handoff_id,
            HandoffRequest.organization_id == organization_id,
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def update_status(
        self,
        organization_id: uuid.UUID,
        handoff_id: uuid.UUID,
        status: str,
        assigned_to: str | None = None,
        resolution_note: str | None = None,
    ) -> HandoffRequest | None:
        req = await self.get(organization_id, handoff_id)
        if not req:
            return None
        req.status = status
        if assigned_to is not None:
            req.assigned_to = assigned_to
        if resolution_note is not None:
            req.resolution_note = resolution_note
        return req

    async def pending_count(self, organization_id: uuid.UUID) -> int:
        from sqlalchemy import func
        result = await self._session.execute(
            select(func.count()).select_from(HandoffRequest).where(
                HandoffRequest.organization_id == organization_id,
                HandoffRequest.status == "pending",
            )
        )
        return result.scalar_one()
