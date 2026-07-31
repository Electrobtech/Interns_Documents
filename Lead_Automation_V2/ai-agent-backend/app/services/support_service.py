from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.support_agent import SYSTEM_PROMPT, build_user_prompt, validate_shape
from app.knowledge.retriever import KnowledgeRetriever
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.repositories.conversation_repo import ConversationRepository
from app.repositories.handoff_repo import HandoffRepository
from app.repositories.support_repo import SupportRepository
from app.schemas.support import SupportRunIn, SupportRunOut
from app.services.service_client import format_customer_context, get_customer_context
from app.services.webhook_service import WebhookService

logger = logging.getLogger(__name__)


class SupportService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = SupportRepository(session)
        self._conversations = ConversationRepository(session)

    async def run(self, organization_id: uuid.UUID, body: SupportRunIn) -> SupportRunOut:
        retriever = KnowledgeRetriever(self._session)
        chunks, low_confidence = await retriever.retrieve(
            organization_id, "support", body.brief, top_k=6
        )
        context = retriever.format_context(chunks)

        # The customer's own record, when the caller knows who they are.
        # Best-effort: a failed lookup must not fail the support run, so the
        # agent simply runs without account context as it did before.
        account_context = None
        if body.contact_id:
            account_context = format_customer_context(
                await get_customer_context(organization_id, body.contact_id)
            )

        history_text = None
        if body.session_id:
            turns = await self._conversations.history(organization_id, body.session_id)
            history_text = ConversationRepository.format_history(turns)

        messages = [
            ChatMessage(role="system", content=SYSTEM_PROMPT),
            ChatMessage(
                role="user",
                content=build_user_prompt(
                    body.brief, context, body.customer_name, body.channel, history_text,
                    account_context,
                ),
            ),
        ]

        provider = get_llm_provider()
        response = await provider.agenerate(
            messages, temperature=0.4, max_tokens=1200, json_mode=True
        )

        try:
            data = json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("support_agent_json_parse_failed, wrapping raw text")
            data = {"suggested_reply": response.content.strip()}

        data = validate_shape(data)

        if low_confidence and not account_context:
            # Knowledge base couldn't answer confidently and there was no
            # account record either — force the safe path. With account data
            # present the agent may legitimately have answered from it, so a
            # weak document match alone is not grounds for escalation.
            data["escalation_needed"] = True
            data["human_handoff"] = True
            if not data.get("human_handoff_note"):
                data["human_handoff_note"] = (
                    "Knowledge base had no confident answer for this question."
                )

        # Questions needing live operational data (order status, invoices,
        # usage counters) are not answerable by this agent at all — route them
        # to a human rather than let a vague reply reach the customer.
        if data.get("data_lookup_needed"):
            data["escalation_needed"] = True
            data["human_handoff"] = True
            if not data.get("human_handoff_note"):
                data["human_handoff_note"] = (
                    "Needs an account/order data lookup the Support Agent cannot perform."
                )

        source_ids = sorted({c.knowledge_source_id for c in chunks})
        await self._repo.save_run(organization_id, body.brief, data, source_ids)

        # Create a HandoffRequest when the agent requests human escalation.
        if data.get("human_handoff"):
            await HandoffRepository(self._session).create(
                organization_id=organization_id,
                agent_type="support",
                original_brief=body.brief,
                agent_output=data,
                customer_name=body.customer_name,
                channel=body.channel,
                session_id=body.session_id,
            )

        if body.session_id:
            await self._conversations.append(
                organization_id, body.session_id, "user", body.brief
            )
            await self._conversations.append(
                organization_id, body.session_id, "agent",
                data.get("suggested_reply", ""), agent_type="support",
            )

        await self._session.commit()

        await WebhookService(self._session).dispatch(
            organization_id,
            "run.completed",
            {"agent_type": "support", "brief": body.brief, "output": data},
        )

        return SupportRunOut(**data, knowledge_sources_used=source_ids)
