from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.sales_handoff_agent import SYSTEM_PROMPT, build_user_prompt, validate_shape
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.repositories.handoff_repo import HandoffRepository
from app.repositories.sales_handoff_repo import SalesHandoffRepository
from app.schemas.marketing_extras import SalesHandoffOut
from app.services._llm_helper import generate_logged

logger = logging.getLogger(__name__)


class SalesHandoffService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = SalesHandoffRepository(session)
        self._handoff_repo = HandoffRepository(session)

    async def generate(
        self, organization_id: uuid.UUID, campaign_id: uuid.UUID | None, note: str | None,
    ) -> SalesHandoffOut:
        # Real numbers first — computed in SQL, not by the LLM.
        campaign_data = await self._repo.campaign_conversion_summary(organization_id, campaign_id)

        messages = [
            ChatMessage(role="system", content=SYSTEM_PROMPT),
            ChatMessage(role="user", content=build_user_prompt(campaign_data, note)),
        ]
        response = await generate_logged(
            get_llm_provider(), messages,
            agent_type="marketing", organization_id=organization_id, session=self._session,
            max_tokens=600,
        )

        try:
            data = json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("sales_handoff_agent_json_parse_failed, wrapping raw text")
            data = {}
        data = validate_shape(data)

        handoff = await self._handoff_repo.create(
            organization_id=organization_id,
            agent_type="marketing",
            original_brief=note or "Marketing → Sales handoff (campaign conversion review)",
            agent_output={**data, "campaign_data": campaign_data},
        )
        await self._session.commit()

        return SalesHandoffOut(handoff_id=handoff.id, campaign_data=campaign_data, **data)
