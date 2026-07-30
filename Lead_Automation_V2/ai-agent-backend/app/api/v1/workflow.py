"""Prompt-to-Workflow Canvas Builder — compiles a natural-language automation
request into a Trigger/Condition/Action node graph the visual builder renders."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.schemas.workflow import PromptToNodesIn, PromptToNodesOut
from app.services.audit_service import log_audit
from app.services.workflow_service import WorkflowService

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/workflow/prompt-to-nodes", response_model=PromptToNodesOut)
async def prompt_to_nodes(
    body: PromptToNodesIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> PromptToNodesOut:
    """Parses natural language ("When a LinkedIn lead form is submitted and budget
    > $10k, send a WhatsApp template") into executable workflow nodes + edges."""
    organization_id = uuid.UUID(user.organization_id)
    result = await WorkflowService(session).prompt_to_nodes(organization_id, body.prompt)
    await log_audit(
        session, organization_id, user.user_id,
        "ai_agents.workflow.prompt_to_nodes", {"prompt": body.prompt[:200]},
    )
    await session.commit()
    return result
