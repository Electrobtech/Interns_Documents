"""Marketing Agent performance panel — real usage/reliability stats (via the
existing ProviderLogRepository, now populated since marketing_service.py's
usage-logging gap was fixed) plus counts of the new persisted artifacts.
Deliberately does not reuse analytics-service's ROAS figure here without its
"illustrative" caveat — see PerformancePanel.jsx on the frontend side."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing import MarketingAgentRun
from app.models.marketing_extras import (
    CampaignPlan, CompetitorReport, IcpPersona, SeoContentBrief,
)
from app.repositories.provider_log_repo import ProviderLogRepository


class MarketingPerformanceService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _count(self, model, organization_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count()).select_from(model).where(model.organization_id == organization_id)
        )
        return result.scalar_one()

    async def summary(self, organization_id: uuid.UUID, days: int = 30) -> dict:
        stats = await ProviderLogRepository(self._session).stats(days=days, organization_id=organization_id)
        marketing_usage = next((a for a in stats["by_agent"] if a["agent_type"] == "marketing"), None)

        counts = {
            "content_runs": await self._count(MarketingAgentRun, organization_id),
            "seo_briefs": await self._count(SeoContentBrief, organization_id),
            "personas": await self._count(IcpPersona, organization_id),
            "campaign_plans": await self._count(CampaignPlan, organization_id),
            "competitor_reports": await self._count(CompetitorReport, organization_id),
        }

        return {
            "range_days": days,
            "artifact_counts": counts,
            "usage": marketing_usage or {"agent_type": "marketing", "providers": []},
        }
