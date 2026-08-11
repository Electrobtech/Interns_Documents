"""Marketing Agent performance panel — real usage/reliability stats and
artifact counts. No fabricated ROAS/ad-spend figure here (see
analytics-service's own comment on why that number is illustrative)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.tenant_scope import get_scoped_session
from app.services.marketing_performance_service import MarketingPerformanceService

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.get("/marketing/performance")
async def marketing_performance(
    days: int = 30,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_scoped_session),
) -> dict:
    organization_id = uuid.UUID(user.organization_id)
    return await MarketingPerformanceService(session).summary(organization_id, days=days)
