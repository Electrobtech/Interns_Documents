"""POST /ai-agents/orchestrate — Phase 4 single entry point: intent
detection -> route to the right agent -> shared session memory."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.database.session import get_session
from app.services.orchestrator_service import OrchestratorService

router = APIRouter()


class OrchestrateIn(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str | None = None
    customer_name: str | None = None
    channel: str | None = None


class OrchestrateOut(BaseModel):
    routed_to: str
    result: dict[str, Any]


@router.post("/orchestrate", response_model=OrchestrateOut)
async def orchestrate(
    body: OrchestrateIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrchestrateOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await OrchestratorService(session).orchestrate(
        organization_id, body.message, body.session_id, body.customer_name, body.channel
    )
    return OrchestrateOut(**result)
