from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.marketing_agent import SYSTEM_PROMPT, build_user_prompt, validate_shape
from app.knowledge.retriever import KnowledgeRetriever
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.repositories.handoff_repo import HandoffRepository
from app.repositories.marketing_repo import MarketingRepository
from app.schemas.marketing import MarketingRunOut
from app.services.webhook_service import WebhookService

logger = logging.getLogger(__name__)


class MarketingService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = MarketingRepository(session)

    async def run(self, organization_id: uuid.UUID, brief: str) -> MarketingRunOut:
        retriever = KnowledgeRetriever(self._session)
        chunks, low_confidence = await retriever.retrieve(
            organization_id, "marketing", brief, top_k=6
        )
        context = retriever.format_context(chunks)

        messages = [
            ChatMessage(role="system", content=SYSTEM_PROMPT),
            ChatMessage(role="user", content=build_user_prompt(brief, context)),
        ]

        provider = get_llm_provider()
        response = await provider.agenerate(
            messages, temperature=0.5, max_tokens=1800, json_mode=True
        )

        try:
            data = json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("marketing_agent_json_parse_failed, wrapping raw text")
            data = {"campaign_summary": response.content.strip()}

        data = validate_shape(data)

        if low_confidence and not data.get("follow_up_questions"):
            data["follow_up_questions"] = [
                "Could you share more detail or upload relevant documents? "
                "I didn't find strong matches in the knowledge base for this brief."
            ]

        source_ids = sorted({c.knowledge_source_id for c in chunks})
        await self._repo.save_run(organization_id, brief, data, source_ids)

        # Create a HandoffRequest when the marketing agent flags a human handoff.
        if data.get("human_handoff"):
            await HandoffRepository(self._session).create(
                organization_id=organization_id,
                agent_type="marketing",
                original_brief=brief,
                agent_output=data,
            )

        await self._session.commit()

        await WebhookService(self._session).dispatch(
            organization_id,
            "run.completed",
            {"agent_type": "marketing", "brief": brief, "output": data},
        )

        return MarketingRunOut(**data, knowledge_sources_used=source_ids)
