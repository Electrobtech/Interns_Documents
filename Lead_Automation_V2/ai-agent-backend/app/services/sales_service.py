from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.sales_agent import SYSTEM_PROMPT, build_user_prompt, validate_shape
from app.knowledge.retriever import KnowledgeRetriever
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.repositories.handoff_repo import HandoffRepository
from app.repositories.sales_repo import SalesRepository
from app.schemas.sales import SalesRunIn, SalesRunOut
from app.services.webhook_service import WebhookService

logger = logging.getLogger(__name__)


class SalesService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = SalesRepository(session)

    async def run(self, organization_id: uuid.UUID, body: SalesRunIn) -> SalesRunOut:
        retriever = KnowledgeRetriever(self._session)
        chunks, low_confidence = await retriever.retrieve(
            organization_id, "sales", body.brief, top_k=6
        )
        context = retriever.format_context(chunks)

        messages = [
            ChatMessage(role="system", content=SYSTEM_PROMPT),
            ChatMessage(
                role="user",
                content=build_user_prompt(
                    body.brief, context, body.lead_name, body.company,
                    body.existing_score, body.stage,
                ),
            ),
        ]

        provider = get_llm_provider()
        response = await provider.agenerate(
            messages, temperature=0.5, max_tokens=1200, json_mode=True
        )

        try:
            data = json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("sales_agent_json_parse_failed, wrapping raw text")
            data = {"recommended_sales_action": response.content.strip()}

        data = validate_shape(data)

        if low_confidence and not data.get("follow_up_questions"):
            data["follow_up_questions"] = [
                "Could you share more detail or upload relevant sales/product documents? "
                "I didn't find strong matches in the knowledge base for this brief."
            ]

        source_ids = sorted({c.knowledge_source_id for c in chunks})
        await self._repo.save_run(organization_id, body.brief, data, source_ids)

        # Create a HandoffRequest when the sales agent flags a human handoff.
        if data.get("human_handoff"):
            await HandoffRepository(self._session).create(
                organization_id=organization_id,
                agent_type="sales",
                original_brief=body.brief,
                agent_output=data,
                customer_name=body.lead_name,
            )

        await self._session.commit()

        await WebhookService(self._session).dispatch(
            organization_id,
            "run.completed",
            {"agent_type": "sales", "brief": body.brief, "output": data},
        )

        return SalesRunOut(**data, knowledge_sources_used=source_ids)
