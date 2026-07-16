"""Human handoff API — records, lists, and manages agent-to-human escalation
requests. Agents set human_handoff=true in their JSON output; this module
provides the management surface for human agents to claim and resolve them."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser, get_current_user
from app.database.session import get_session
from app.repositories.handoff_repo import HandoffRepository
from app.services.audit_service import log_audit
from app.services.webhook_service import WebhookService

router = APIRouter()

_VALID_STATUSES = ("pending", "assigned", "resolved", "rejected")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class HandoffOut(BaseModel):
    id: uuid.UUID
    agent_type: str
    original_brief: str
    agent_output: dict[str, Any]
    customer_name: str | None = None
    channel: str | None = None
    session_id: str | None = None
    status: str
    resolution_note: str | None = None
    assigned_to: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HandoffStatusUpdate(BaseModel):
    status: Literal["assigned", "resolved", "rejected"]
    resolution_note: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/handoff", response_model=list[HandoffOut])
async def list_handoffs(
    status: str | None = None,
    agent_type: str | None = None,
    limit: int = 50,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[HandoffOut]:
    """List human handoff requests for the organization. Filter by status
    (pending | assigned | resolved | rejected) and/or agent_type."""
    if status and status not in _VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(_VALID_STATUSES)}",
        )
    organization_id = uuid.UUID(user.organization_id)
    rows = await HandoffRepository(session).list_for_org(
        organization_id, status=status, agent_type=agent_type, limit=min(limit, 200)
    )
    return [HandoffOut.model_validate(r) for r in rows]


@router.get("/handoff/{handoff_id}", response_model=HandoffOut)
async def get_handoff(
    handoff_id: uuid.UUID,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> HandoffOut:
    organization_id = uuid.UUID(user.organization_id)
    row = await HandoffRepository(session).get(organization_id, handoff_id)
    if not row:
        raise HTTPException(status_code=404, detail="Handoff request not found")
    return HandoffOut.model_validate(row)


@router.patch("/handoff/{handoff_id}", response_model=HandoffOut)
async def update_handoff_status(
    handoff_id: uuid.UUID,
    body: HandoffStatusUpdate,
    user: AuthUser = Depends(require_permission("ai_agents:manage")),
    session: AsyncSession = Depends(get_session),
) -> HandoffOut:
    """Claim, resolve, or reject a handoff request."""
    organization_id = uuid.UUID(user.organization_id)
    repo = HandoffRepository(session)

    assigned_to = user.user_id if body.status == "assigned" else None
    updated = await repo.update_status(
        organization_id, handoff_id,
        status=body.status,
        assigned_to=assigned_to,
        resolution_note=body.resolution_note,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Handoff request not found")

    # Build the response before commit — expire_on_commit would otherwise
    # expire `updated`'s attributes, forcing a lazy (sync-context) reload
    # inside model_validate() and raising MissingGreenlet.
    result = HandoffOut.model_validate(updated)

    await log_audit(
        session, organization_id, user.user_id, f"ai_agents.handoff.{body.status}",
        {"handoff_id": str(handoff_id), "note": body.resolution_note},
    )

    # Fire webhook for handoff status changes.
    await WebhookService(session).dispatch(
        organization_id,
        "handoff.status_changed",
        {"handoff_id": str(handoff_id), "status": body.status, "agent_type": updated.agent_type},
    )

    await session.commit()
    return result
