"""Broadcasts API — /ai-agents/marketing/broadcasts.

A broadcast can only move to `sending` if it has passed a policy check
(§18.4-style discipline, matching the anti_ban capability's whole purpose):
sending a message that would get the tenant's WhatsApp number banned is a
worse failure mode than a slightly annoying extra confirmation step.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.errors import ConflictError, NotFoundError
from orbq_core.tenancy import current_tenant

from ...models.marketing import Broadcast
from ...schemas.marketing_extras import (
    BROADCAST_TRANSITIONS,
    BroadcastCreate,
    BroadcastOut,
    BroadcastPolicyCheck,
    BroadcastStatusChange,
    BroadcastUpdate,
)

router = APIRouter(prefix="/ai-agents/marketing", tags=["marketing-broadcasts"])


def _out(b: Broadcast) -> BroadcastOut:
    return BroadcastOut.model_validate(b)


@router.get("/broadcasts", response_model=list[BroadcastOut])
async def list_broadcasts(
    status_filter: list[str] | None = Query(default=None, alias="status"),
    channel: list[str] | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=100, le=200),
    db: AsyncSession = Depends(get_session),
) -> list[BroadcastOut]:
    ctx = current_tenant()
    stmt = (
        select(Broadcast)
        .where(Broadcast.org_id == ctx.org_id, Broadcast.deleted_at.is_(None))
        .order_by(Broadcast.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(Broadcast.status.in_(status_filter))
    if channel:
        stmt = stmt.where(Broadcast.channel.in_(channel))
    if search:
        stmt = stmt.where(Broadcast.name.ilike(f"%{search}%"))
    rows = (await db.execute(stmt)).scalars().all()
    return [_out(b) for b in rows]


@router.post("/broadcasts", response_model=BroadcastOut, status_code=201)
async def create_broadcast(body: BroadcastCreate, db: AsyncSession = Depends(get_session)) -> BroadcastOut:
    ctx = current_tenant()
    b = Broadcast(
        org_id=ctx.org_id, created_by=ctx.user_id,
        name=body.name, channel=body.channel, audience_id=body.audience_id,
        template_id=body.template_id, subject=body.subject, body=body.body,
        content=body.content, scheduled_at=body.scheduled_at,
        status="scheduled" if body.scheduled_at else "draft",
    )
    db.add(b)
    await db.flush()
    return _out(b)


@router.get("/broadcasts/{broadcast_id}", response_model=BroadcastOut)
async def get_broadcast(broadcast_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> BroadcastOut:
    return _out(await _get_owned(db, broadcast_id))


@router.put("/broadcasts/{broadcast_id}", response_model=BroadcastOut)
async def update_broadcast(
    broadcast_id: uuid.UUID, body: BroadcastUpdate, db: AsyncSession = Depends(get_session)
) -> BroadcastOut:
    ctx = current_tenant()
    b = await _get_owned(db, broadcast_id)
    if b.status not in {"draft", "scheduled"}:
        raise ConflictError(f"Broadcast is {b.status}; only draft/scheduled broadcasts can be edited")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(b, field, value)
    b.updated_by = ctx.user_id
    # Editing the body invalidates any prior policy check — force a re-check
    # before it can send again, rather than trusting a stale verdict.
    if "body" in body.model_fields_set:
        b.policy_risk_level = None
        b.policy_checked_at = None
    await db.flush()
    return _out(b)


@router.delete("/broadcasts/{broadcast_id}", status_code=204, response_class=Response)
async def delete_broadcast(broadcast_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> Response:
    ctx = current_tenant()
    b = await _get_owned(db, broadcast_id)
    b.deleted_at = datetime.now(timezone.utc)
    b.updated_by = ctx.user_id
    await db.flush()
    return Response(status_code=204)


@router.post("/broadcasts/{broadcast_id}/policy-check", response_model=BroadcastOut)
async def record_policy_check(
    broadcast_id: uuid.UUID, body: BroadcastPolicyCheck, db: AsyncSession = Depends(get_session)
) -> BroadcastOut:
    """Persists the anti_ban capability's verdict. The frontend calls the
    `anti_ban` capability via the normal agent endpoint, then posts the result
    here so the gate below has something durable to check — a chat answer the
    marketer has to remember is not a gate."""
    ctx = current_tenant()
    b = await _get_owned(db, broadcast_id)
    b.policy_risk_level = body.risk_level
    b.policy_risk_score = body.risk_score
    b.policy_flags = body.flags
    b.policy_checked_at = datetime.now(timezone.utc)
    b.updated_by = ctx.user_id
    await db.flush()
    return _out(b)


@router.post("/broadcasts/{broadcast_id}/status", response_model=BroadcastOut)
async def change_broadcast_status(
    broadcast_id: uuid.UUID, body: BroadcastStatusChange, db: AsyncSession = Depends(get_session)
) -> BroadcastOut:
    ctx = current_tenant()
    b = await _get_owned(db, broadcast_id)

    if body.to_status not in BROADCAST_TRANSITIONS.get(b.status, set()):
        raise ConflictError(
            f"Cannot move broadcast from '{b.status}' to '{body.to_status}'. "
            f"Legal next states: {sorted(BROADCAST_TRANSITIONS.get(b.status, set())) or 'none (terminal)'}"
        )

    # The one hard business rule this endpoint enforces: no send without a
    # passing policy check. A broadcast can be *edited* freely without one,
    # but it cannot leave draft/scheduled toward sending without it.
    if body.to_status == "sending":
        if b.policy_risk_level is None:
            raise ConflictError(
                "This broadcast has not passed a policy check yet. Run the "
                "anti_ban capability and POST the result to /policy-check first."
            )
        if b.policy_risk_level in {"high", "critical"}:
            raise ConflictError(
                f"Policy check flagged this as {b.policy_risk_level} risk. "
                "Revise the message before sending."
            )

    b.status = body.to_status
    b.updated_by = ctx.user_id
    if body.to_status == "sent" and b.sent_at is None:
        b.sent_at = datetime.now(timezone.utc)
    await db.flush()
    return _out(b)


async def _get_owned(db: AsyncSession, broadcast_id: uuid.UUID) -> Broadcast:
    ctx = current_tenant()
    stmt = select(Broadcast).where(
        Broadcast.id == broadcast_id, Broadcast.org_id == ctx.org_id, Broadcast.deleted_at.is_(None)
    )
    b = (await db.execute(stmt)).scalar_one_or_none()
    if b is None:
        raise NotFoundError(f"Broadcast {broadcast_id} not found")
    return b
