"""POST /ai-agents/sales/run — Sales Agent, grounded via RAG."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.database.session import get_session
from app.repositories.sales_repo import SalesRepository
from app.schemas.sales import SalesRunIn, SalesRunOut, SalesRunSummary
from app.services.audit_service import log_audit
from app.services.sales_service import SalesService

router = APIRouter()


@router.post("/sales/run", response_model=SalesRunOut)
async def run_sales_agent(
    body: SalesRunIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SalesRunOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await SalesService(session).run(organization_id, body)
    await log_audit(session, organization_id, user.user_id, "ai_agents.sales.run", {"brief": body.brief[:200]})
    await session.commit()
    return result


@router.get("/sales/runs", response_model=list[SalesRunSummary])
async def list_sales_runs(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SalesRunSummary]:
    organization_id = uuid.UUID(user.organization_id)
    runs = await SalesRepository(session).recent_runs(organization_id)
    return [SalesRunSummary.model_validate(r) for r in runs]
