"""Prompt-to-Workflow service — compiles a natural-language automation request
into a Trigger/Condition/Action node graph for the visual canvas builder.

Stateless (nothing persisted): the canvas holds the draft graph client-side until
the user chooses to save it as a playbook, so an exploratory prompt doesn't
litter the database."""
from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import workflow_agent
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_provider
from app.schemas.workflow import PromptToNodesOut
from app.services._llm_helper import generate_logged

logger = logging.getLogger(__name__)


class WorkflowService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def prompt_to_nodes(self, organization_id: uuid.UUID, prompt: str) -> PromptToNodesOut:
        messages = [
            ChatMessage(role="system", content=workflow_agent.SYSTEM_PROMPT),
            ChatMessage(role="user", content=workflow_agent.build_user_prompt(prompt)),
        ]
        response = await generate_logged(
            get_llm_provider(), messages,
            agent_type="marketing", organization_id=organization_id, session=self._session,
            # Compiling a spec into a graph should be deterministic, not creative.
            temperature=0.1, max_tokens=1600,
        )

        try:
            data = json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("workflow_agent_json_parse_failed")
            data = {}

        data = workflow_agent.validate_shape(data)
        # No DB write, but commit so generate_logged's provider-usage row persists.
        await self._session.commit()
        return PromptToNodesOut(**data)
