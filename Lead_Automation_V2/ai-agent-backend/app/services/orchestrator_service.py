"""Phase 4 — Orchestrator. One entry point (POST /ai-agents/orchestrate)
that classifies the inbound message's intent, routes it to the right
specialist agent, and threads shared conversation memory through the session
so agents see prior turns regardless of who handled them.

Intent detection is a cheap dedicated LLM call (single word out), so a
misroute costs one extra round-trip, not a wrong answer — the specialist
agents themselves stay grounded in their own knowledge scopes."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.repositories.conversation_repo import ConversationRepository
from app.schemas.marketing import MarketingRunOut
from app.schemas.sales import SalesRunIn, SalesRunOut
from app.schemas.support import SupportRunIn, SupportRunOut
from app.services.marketing_service import MarketingService
from app.services.sales_service import SalesService
from app.services.support_service import SupportService

logger = logging.getLogger(__name__)

_INTENT_PROMPT = """You are an intent router for a CRM's AI agents. Classify the message into
exactly one of these categories and respond with ONLY that single word:

- marketing: campaign creation, content generation, SEO/keywords, audience questions, promotions
- sales: lead qualification, pricing questions from a prospect, follow-ups, deals, buying signals
- support: existing-customer help, product questions, complaints, refunds, technical issues

Message:
{message}"""

_VALID_INTENTS = {"marketing", "sales", "support"}


class OrchestratorService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._conversations = ConversationRepository(session)

    async def detect_intent(self, message: str) -> str:
        provider = get_llm_provider()
        response = await provider.agenerate(
            [ChatMessage(role="user", content=_INTENT_PROMPT.format(message=message))],
            temperature=0.0, max_tokens=10,
        )
        intent = response.content.strip().lower().split()[0] if response.content.strip() else ""
        intent = intent.strip(".,!\"'")
        if intent not in _VALID_INTENTS:
            logger.warning("intent_router_unparseable output=%r, defaulting to support", response.content)
            return "support"
        return intent

    async def orchestrate(
        self, organization_id: uuid.UUID, message: str, session_id: str | None, customer_name: str | None, channel: str | None,
    ) -> dict[str, Any]:
        intent = await self.detect_intent(message)

        result: MarketingRunOut | SalesRunOut | SupportRunOut
        if intent == "marketing":
            result = await MarketingService(self._session).run(organization_id, message)
        elif intent == "sales":
            result = await SalesService(self._session).run(
                organization_id, SalesRunIn(brief=message, lead_name=customer_name)
            )
        else:
            # Support handles its own session memory append internally.
            return {
                "routed_to": "support",
                "result": (await SupportService(self._session).run(
                    organization_id,
                    SupportRunIn(brief=message, customer_name=customer_name, channel=channel, session_id=session_id),
                )).model_dump(),
            }

        # Marketing/Sales don't manage session memory themselves — record the turn here.
        if session_id:
            summary = getattr(result, "campaign_summary", None) or getattr(result, "recommended_sales_action", "")
            await self._conversations.append(organization_id, session_id, "user", message)
            await self._conversations.append(organization_id, session_id, "agent", summary or "", agent_type=intent)
            await self._session.commit()

        return {"routed_to": intent, "result": result.model_dump()}
