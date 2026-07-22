from __future__ import annotations

import json
import logging
import uuid
from collections import Counter

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.persona_agent import SYSTEM_PROMPT, build_user_prompt, validate_shape
from app.knowledge.retriever import KnowledgeRetriever
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.repositories.marketing_extras_repo import PersonaRepository
from app.schemas.marketing_extras import PersonaOut
from app.services._llm_helper import generate_logged
from app.services.service_client import get_contacts

logger = logging.getLogger(__name__)


def _summarize_contact_sources(contacts: list[dict]) -> str | None:
    if not contacts:
        return None
    counts = Counter(c.get("source") or "unknown" for c in contacts)
    total = sum(counts.values())
    lines = [f"- {source}: {count} contacts ({round(count / total * 100)}%)" for source, count in counts.most_common(8)]
    return f"Total contacts: {total}\n" + "\n".join(lines)


class PersonaService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = PersonaRepository(session)

    async def generate(self, organization_id: uuid.UUID, brief: str, name: str | None) -> PersonaOut:
        retriever = KnowledgeRetriever(self._session)
        chunks, _ = await retriever.retrieve(organization_id, "marketing", brief, top_k=6)
        context = retriever.format_context(chunks)

        contacts = await get_contacts(organization_id)
        distribution = _summarize_contact_sources(contacts) if contacts else None

        messages = [
            ChatMessage(role="system", content=SYSTEM_PROMPT),
            ChatMessage(role="user", content=build_user_prompt(brief, context, distribution)),
        ]

        response = await generate_logged(
            get_llm_provider(), messages,
            agent_type="marketing", organization_id=organization_id, session=self._session,
        )

        try:
            data = json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("persona_agent_json_parse_failed, wrapping raw text")
            data = {}
        data = validate_shape(data)

        source_ids = sorted({c.knowledge_source_id for c in chunks})
        save_name = name or (data["personas"][0]["name"] if data["personas"] else brief[:60])
        row = await self._repo.save(organization_id, save_name, {**data, "knowledge_sources_used": source_ids})
        await self._session.commit()

        return PersonaOut(
            id=row.id, name=save_name, personas=data["personas"],
            knowledge_sources_used=source_ids, created_at=row.created_at,
        )

    async def list_recent(self, organization_id: uuid.UUID):
        return await self._repo.recent(organization_id)

    async def delete(self, organization_id: uuid.UUID, persona_id: uuid.UUID) -> bool:
        ok = await self._repo.delete(organization_id, persona_id)
        if ok:
            await self._session.commit()
        return ok
