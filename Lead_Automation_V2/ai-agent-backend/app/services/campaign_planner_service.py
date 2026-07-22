from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.campaign_planner_agent import SYSTEM_PROMPT, build_user_prompt, validate_shape
from app.knowledge.retriever import KnowledgeRetriever
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.repositories.marketing_extras_repo import CampaignPlanRepository
from app.schemas.marketing_extras import CampaignPlanOut
from app.services._llm_helper import generate_logged
from app.services.service_client import create_campaign

logger = logging.getLogger(__name__)


class CampaignPlannerService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = CampaignPlanRepository(session)

    async def generate(
        self, organization_id: uuid.UUID, name: str, goal: str, timeframe: str,
        channels: list[str], persona: str | None,
    ) -> CampaignPlanOut:
        retriever = KnowledgeRetriever(self._session)
        chunks, _ = await retriever.retrieve(organization_id, "marketing", goal, top_k=6)
        context = retriever.format_context(chunks)

        messages = [
            ChatMessage(role="system", content=SYSTEM_PROMPT),
            ChatMessage(role="user", content=build_user_prompt(goal, timeframe, channels, persona, context)),
        ]

        response = await generate_logged(
            get_llm_provider(), messages,
            agent_type="marketing", organization_id=organization_id, session=self._session,
        )

        try:
            data = json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("campaign_planner_agent_json_parse_failed, wrapping raw text")
            data = {}
        data = validate_shape(data)

        source_ids = sorted({c.knowledge_source_id for c in chunks})
        row = await self._repo.save(
            organization_id, name, goal, timeframe, {**data, "knowledge_sources_used": source_ids},
        )
        await self._session.commit()

        return CampaignPlanOut(
            id=row.id, name=name, goal=goal, timeframe=timeframe,
            plan_summary=data["plan_summary"], items=data["items"],
            knowledge_sources_used=source_ids, created_at=row.created_at,
        )

    async def list_recent(self, organization_id: uuid.UUID):
        return await self._repo.recent(organization_id)

    async def convert_item(
        self, organization_id: uuid.UUID, plan_id: uuid.UUID, item_index: int,
        channel_type: str, message_body: str,
    ) -> dict:
        plan = await self._repo.get(organization_id, plan_id)
        if not plan:
            raise ValueError("plan not found")
        items = plan.output.get("items", [])
        if item_index < 0 or item_index >= len(items):
            raise ValueError("item index out of range")
        item = items[item_index]
        name = f"{plan.name} — {item.get('topic', 'Untitled')}"[:120]
        return await create_campaign(
            organization_id, name=name, type_="broadcast",
            channel_type=channel_type, message_body=message_body, status="draft",
        )
