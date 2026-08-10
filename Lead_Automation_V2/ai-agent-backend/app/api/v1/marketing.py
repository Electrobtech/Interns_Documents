"""POST /ai-agents/marketing/run — Marketing Agent, grounded via RAG,
returns the platform's required structured JSON output."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.database.tenant_scope import get_scoped_session
from app.repositories.marketing_repo import MarketingRepository
from app.schemas.marketing import MarketingRunIn, MarketingRunOut, MarketingRunSummary
from app.services.audit_service import log_audit
from app.services.marketing_service import MarketingService

router = APIRouter()


@router.post("/marketing/run", response_model=MarketingRunOut)
async def run_marketing_agent(
    body: MarketingRunIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_scoped_session),
) -> MarketingRunOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await MarketingService(session).run(organization_id, body.brief)
    await log_audit(session, organization_id, user.user_id, "ai_agents.marketing.run", {"brief": body.brief[:200]})
    await session.commit()
    return result


@router.get("/marketing/runs", response_model=list[MarketingRunSummary])
async def list_marketing_runs(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_scoped_session),
) -> list[MarketingRunSummary]:
    organization_id = uuid.UUID(user.organization_id)
    runs = await MarketingRepository(session).recent_runs(organization_id)
    return [MarketingRunSummary.model_validate(r) for r in runs]
