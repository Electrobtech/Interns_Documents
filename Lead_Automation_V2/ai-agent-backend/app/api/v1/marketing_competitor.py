"""Competitor & market intelligence — part of the Marketing Agent expansion.
LLM-reasoned analysis only; there is no live competitor data source. Every
response carries a disclaimer field the frontend must always render."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.tenant_scope import get_scoped_session
from app.schemas.marketing_extras import CompetitorIntelIn, CompetitorIntelOut, CompetitorReportSummary
from app.services.audit_service import log_audit
from app.services.competitor_service import CompetitorService

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/marketing/competitor-intel", response_model=CompetitorIntelOut)
async def generate_competitor_intel(
    body: CompetitorIntelIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_scoped_session),
) -> CompetitorIntelOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await CompetitorService(session).generate(organization_id, body.subject)
    await log_audit(session, organization_id, user.user_id, "ai_agents.marketing.competitor_intel", {"subject": body.subject[:200]})
    await session.commit()
    return result


@router.get("/marketing/competitor-reports", response_model=list[CompetitorReportSummary])
async def list_competitor_reports(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_scoped_session),
) -> list[CompetitorReportSummary]:
    organization_id = uuid.UUID(user.organization_id)
    rows = await CompetitorService(session).list_recent(organization_id)
    return [CompetitorReportSummary.model_validate(r) for r in rows]
