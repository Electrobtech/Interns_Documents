"""Repositories for the Marketing Agent expansion's persisted artifacts —
each mirrors MarketingRepository's shape (save + recent-list), with delete
where the frontend needs to manage a saved list."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing_extras import (
    AeoOptimization, CampaignPlan, CompetitorReport, CtwaAdPackage,
    IcpPersona, SeoContentBrief,
)


class SeoBriefRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, organization_id: uuid.UUID, topic: str, output: dict) -> SeoContentBrief:
        row = SeoContentBrief(organization_id=organization_id, topic=topic, output=output)
        self._session.add(row)
        await self._session.flush()
        return row

    async def recent(self, organization_id: uuid.UUID, limit: int = 30) -> list[SeoContentBrief]:
        stmt = (
            select(SeoContentBrief)
            .where(SeoContentBrief.organization_id == organization_id)
            .order_by(SeoContentBrief.created_at.desc())
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).scalars().all())


class PersonaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, organization_id: uuid.UUID, name: str, output: dict) -> IcpPersona:
        row = IcpPersona(organization_id=organization_id, name=name, output=output)
        self._session.add(row)
        await self._session.flush()
        return row

    async def recent(self, organization_id: uuid.UUID, limit: int = 30) -> list[IcpPersona]:
        stmt = (
            select(IcpPersona)
            .where(IcpPersona.organization_id == organization_id)
            .order_by(IcpPersona.created_at.desc())
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def delete(self, organization_id: uuid.UUID, persona_id: uuid.UUID) -> bool:
        row = (await self._session.execute(
            select(IcpPersona).where(
                IcpPersona.id == persona_id, IcpPersona.organization_id == organization_id
            )
        )).scalar_one_or_none()
        if not row:
            return False
        await self._session.delete(row)
        return True


class CampaignPlanRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(
        self, organization_id: uuid.UUID, name: str, goal: str, timeframe: str, output: dict,
    ) -> CampaignPlan:
        row = CampaignPlan(
            organization_id=organization_id, name=name, goal=goal, timeframe=timeframe, output=output,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def recent(self, organization_id: uuid.UUID, limit: int = 30) -> list[CampaignPlan]:
        stmt = (
            select(CampaignPlan)
            .where(CampaignPlan.organization_id == organization_id)
            .order_by(CampaignPlan.created_at.desc())
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def get(self, organization_id: uuid.UUID, plan_id: uuid.UUID) -> CampaignPlan | None:
        stmt = select(CampaignPlan).where(
            CampaignPlan.id == plan_id, CampaignPlan.organization_id == organization_id
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()


class CompetitorReportRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, organization_id: uuid.UUID, subject: str, output: dict) -> CompetitorReport:
        row = CompetitorReport(organization_id=organization_id, subject=subject, output=output)
        self._session.add(row)
        await self._session.flush()
        return row

    async def recent(self, organization_id: uuid.UUID, limit: int = 30) -> list[CompetitorReport]:
        stmt = (
            select(CompetitorReport)
            .where(CompetitorReport.organization_id == organization_id)
            .order_by(CompetitorReport.created_at.desc())
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).scalars().all())


class AeoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, organization_id: uuid.UUID, input_text: str, output: dict) -> AeoOptimization:
        row = AeoOptimization(organization_id=organization_id, input_text=input_text, output=output)
        self._session.add(row)
        await self._session.flush()
        return row

    async def recent(self, organization_id: uuid.UUID, limit: int = 30) -> list[AeoOptimization]:
        stmt = (
            select(AeoOptimization)
            .where(AeoOptimization.organization_id == organization_id)
            .order_by(AeoOptimization.created_at.desc())
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).scalars().all())


class CtwaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, organization_id: uuid.UUID, offer_brief: str, output: dict) -> CtwaAdPackage:
        row = CtwaAdPackage(organization_id=organization_id, offer_brief=offer_brief, output=output)
        self._session.add(row)
        await self._session.flush()
        return row

    async def recent(self, organization_id: uuid.UUID, limit: int = 30) -> list[CtwaAdPackage]:
        stmt = (
            select(CtwaAdPackage)
            .where(CtwaAdPackage.organization_id == organization_id)
            .order_by(CtwaAdPackage.created_at.desc())
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).scalars().all())
