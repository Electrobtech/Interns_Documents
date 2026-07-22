from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.competitor_agent import SYSTEM_PROMPT, build_user_prompt, validate_shape
from app.knowledge.retriever import KnowledgeRetriever
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.repositories.marketing_extras_repo import CompetitorReportRepository
from app.schemas.marketing_extras import CompetitorIntelOut
from app.services._llm_helper import generate_logged

logger = logging.getLogger(__name__)


class CompetitorService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = CompetitorReportRepository(session)

    async def generate(self, organization_id: uuid.UUID, subject: str) -> CompetitorIntelOut:
        retriever = KnowledgeRetriever(self._session)
        chunks, _ = await retriever.retrieve(organization_id, "marketing", subject, top_k=6)
        context = retriever.format_context(chunks)

        messages = [
            ChatMessage(role="system", content=SYSTEM_PROMPT),
            ChatMessage(role="user", content=build_user_prompt(subject, context)),
        ]

        response = await generate_logged(
            get_llm_provider(), messages,
            agent_type="marketing", organization_id=organization_id, session=self._session,
        )

        try:
            data = json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("competitor_agent_json_parse_failed, wrapping raw text")
            data = {}
        data = validate_shape(data)

        source_ids = sorted({c.knowledge_source_id for c in chunks})
        row = await self._repo.save(organization_id, subject, {**data, "knowledge_sources_used": source_ids})
        await self._session.commit()

        return CompetitorIntelOut(id=row.id, subject=subject, created_at=row.created_at, **data, knowledge_sources_used=source_ids)

    async def list_recent(self, organization_id: uuid.UUID):
        return await self._repo.recent(organization_id)
