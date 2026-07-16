"""Shared conversation memory — every orchestrated turn is appended here,
so any agent (or a later turn handled by a different agent) sees the full
session history. This is the 'shared memory' layer of Phase 4."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.support import AgentConversationTurn


class ConversationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def append(
        self, organization_id: uuid.UUID, session_id: str, role: str, content: str, agent_type: str | None = None,
    ) -> None:
        self._session.add(AgentConversationTurn(
            organization_id=organization_id, session_id=session_id, role=role,
            agent_type=agent_type, content=content,
        ))

    async def history(self, organization_id: uuid.UUID, session_id: str, limit: int = 12) -> list[AgentConversationTurn]:
        stmt = (
            select(AgentConversationTurn)
            .where(
                AgentConversationTurn.organization_id == organization_id,
                AgentConversationTurn.session_id == session_id,
            )
            .order_by(AgentConversationTurn.created_at.desc())
            .limit(limit)
        )
        rows = list((await self._session.execute(stmt)).scalars().all())
        return list(reversed(rows))

    @staticmethod
    def format_history(turns: list[AgentConversationTurn]) -> str | None:
        if not turns:
            return None
        lines = []
        for t in turns:
            who = f"agent({t.agent_type})" if t.role == "agent" else "customer"
            lines.append(f"{who}: {t.content}")
        return "\n".join(lines)
