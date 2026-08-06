from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sales import SalesAgentConfig, SalesAgentRun


class SalesRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save_run(self, organization_id: uuid.UUID, brief: str, output: dict, knowledge_sources_used: list[str]) -> SalesAgentRun:
        run = SalesAgentRun(
            organization_id=organization_id, brief=brief, output=output,
            knowledge_sources_used=knowledge_sources_used,
        )
        self._session.add(run)
        await self._session.flush()
        return run

    async def recent_runs(self, organization_id: uuid.UUID, limit: int = 20) -> list[SalesAgentRun]:
        stmt = (
            select(SalesAgentRun)
            .where(SalesAgentRun.organization_id == organization_id)
            .order_by(SalesAgentRun.created_at.desc())
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).scalars().all())


class SalesConfigRepository:
    """One row per organization — see app/models/sales.py:SalesAgentConfig
    for why organization_id is the primary key rather than a synthetic id."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, organization_id: uuid.UUID) -> SalesAgentConfig | None:
        stmt = select(SalesAgentConfig).where(SalesAgentConfig.organization_id == organization_id)
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def upsert(
        self,
        organization_id: uuid.UUID,
        *,
        deal_value_field: str | None | object = ...,
        confidence_signal_config: dict | None | object = ...,
    ) -> SalesAgentConfig:
        """`...` (Ellipsis, via the `object` sentinel default) means "field
        not sent in this PATCH, leave as-is" — distinct from `None`/empty,
        which means "explicitly clear the mapping". Mirrors the COALESCE
        semantics contact-service's PUT /leads/:id already uses, just done
        in Python since this is a full ORM object, not a raw SQL UPDATE.
        """
        row = await self.get(organization_id)
        if row is None:
            row = SalesAgentConfig(organization_id=organization_id, confidence_signal_config={})
            self._session.add(row)

        if deal_value_field is not ...:
            row.deal_value_field = deal_value_field or None
        if confidence_signal_config is not ...:
            row.confidence_signal_config = confidence_signal_config or {}

        await self._session.flush()
        return row
