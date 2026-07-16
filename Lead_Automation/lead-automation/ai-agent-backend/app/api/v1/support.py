"""POST /ai-agents/support/run — Support Agent, grounded via RAG with
shared conversation memory."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.database.session import get_session
from app.repositories.support_repo import SupportRepository
from app.schemas.support import SupportRunIn, SupportRunOut, SupportRunSummary
from app.services.audit_service import log_audit
from app.services.support_service import SupportService

router = APIRouter()


@router.post("/support/run", response_model=SupportRunOut)
async def run_support_agent(
    body: SupportRunIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SupportRunOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await SupportService(session).run(organization_id, body)
    await log_audit(session, organization_id, user.user_id, "ai_agents.support.run", {"brief": body.brief[:200]})
    await session.commit()
    return result


@router.get("/support/runs", response_model=list[SupportRunSummary])
async def list_support_runs(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SupportRunSummary]:
    organization_id = uuid.UUID(user.organization_id)
    runs = await SupportRepository(session).recent_runs(organization_id)
    return [SupportRunSummary.model_validate(r) for r in runs]
