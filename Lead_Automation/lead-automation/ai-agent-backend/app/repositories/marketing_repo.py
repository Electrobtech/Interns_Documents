from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing import MarketingAgentRun


class MarketingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save_run(self, organization_id: uuid.UUID, brief: str, output: dict, knowledge_sources_used: list[str]) -> MarketingAgentRun:
        run = MarketingAgentRun(
            organization_id=organization_id, brief=brief, output=output,
            knowledge_sources_used=knowledge_sources_used,
        )
        self._session.add(run)
        await self._session.flush()
        return run

    async def recent_runs(self, organization_id: uuid.UUID, limit: int = 20) -> list[MarketingAgentRun]:
        stmt = (
            select(MarketingAgentRun)
            .where(MarketingAgentRun.organization_id == organization_id)
            .order_by(MarketingAgentRun.created_at.desc())
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).scalars().all())
