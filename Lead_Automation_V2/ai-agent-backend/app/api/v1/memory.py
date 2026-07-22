"""Shared memory API — inspect and manage conversation sessions used by the
orchestrator. Each session is a sequence of AgentConversationTurns."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.database.session import get_session
from app.models.support import AgentConversationTurn
from app.repositories.conversation_repo import ConversationRepository
from app.services.audit_service import log_audit

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ConversationTurnOut(BaseModel):
    id: uuid.UUID
    session_id: str
    role: str
    agent_type: str | None = None
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionMemoryOut(BaseModel):
    session_id: str
    turn_count: int
    turns: list[ConversationTurnOut]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/memory/{session_id}", response_model=SessionMemoryOut)
async def get_session_memory(
    session_id: str,
    limit: int = 50,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionMemoryOut:
    """Retrieve conversation history for a session."""
    organization_id = uuid.UUID(user.organization_id)
    repo = ConversationRepository(session)
    turns = await repo.history(organization_id, session_id, limit=min(limit, 200))
    return SessionMemoryOut(
        session_id=session_id,
        turn_count=len(turns),
        turns=[ConversationTurnOut.model_validate(t) for t in turns],
    )


@router.delete("/memory/{session_id}")
async def clear_session_memory(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete all conversation turns for a session (e.g. to start fresh)."""
    organization_id = uuid.UUID(user.organization_id)
    result = await session.execute(
        delete(AgentConversationTurn).where(
            AgentConversationTurn.organization_id == organization_id,
            AgentConversationTurn.session_id == session_id,
        )
    )
    await log_audit(
        session, organization_id, user.user_id, "ai_agents.memory.clear",
        {"session_id": session_id, "deleted_turns": result.rowcount},
    )
    await session.commit()
    return {"ok": True, "deleted_turns": result.rowcount}


@router.get("/memory", response_model=list[str])
async def list_active_sessions(
    limit: int = 100,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[str]:
    """List distinct active session IDs for this organization."""
    from sqlalchemy import select, distinct, func
    organization_id = uuid.UUID(user.organization_id)
    rows = (await session.execute(
        select(distinct(AgentConversationTurn.session_id))
        .where(AgentConversationTurn.organization_id == organization_id)
        .order_by(AgentConversationTurn.session_id)
        .limit(min(limit, 500))
    )).scalars().all()
    return list(rows)
