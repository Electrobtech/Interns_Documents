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
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.errors import ConflictError, NotFoundError
from orbq_core.tenancy import current_tenant

from ...models.marketing import Broadcast, BroadcastRecipient
from ...schemas.campaigns import RecipientListOut, RecipientOut
from ...schemas.marketing_extras import (
    BROADCAST_TRANSITIONS,
    BroadcastCreate,
    BroadcastOut,
    BroadcastPolicyCheck,
    BroadcastStatusChange,
    BroadcastUpdate,
)

router = APIRouter(prefix="/ai-agents/marketing", tags=["marketing-broadcasts"])

# Editing any of these changes what a recipient would actually receive, so a
# policy verdict taken before the edit no longer describes the message. The
# gate in change_broadcast_status then refuses to send until it is re-checked.
POLICY_INVALIDATING_FIELDS = {"body", "content", "channel"}


def _out(b: Broadcast) -> BroadcastOut:
    return BroadcastOut.model_validate(b)


def _clear_policy_verdict(b: Broadcast) -> None:
    b.policy_risk_level = None
    b.policy_risk_score = None
    b.policy_flags = []
    b.policy_checked_at = None


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

    # Any edit to what actually gets sent invalidates the prior verdict, and
    # invalidation has to clear the *whole* verdict. Clearing only the level
    # while leaving a stale score and flag list behind would show the UI a
    # 12/100 "low risk" score for a message nobody has checked.
    if POLICY_INVALIDATING_FIELDS & body.model_fields_set:
        _clear_policy_verdict(b)

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


@router.get("/broadcasts/{broadcast_id}/recipients", response_model=RecipientListOut)
async def list_broadcast_recipients(
    broadcast_id: uuid.UUID,
    status_filter: list[str] | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=320),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_session),
) -> RecipientListOut:
    """Deliberately identical in shape to the Campaigns equivalent — the two
    recipient tables are structurally parallel, so the frontend renders both
    with one component rather than two that drift apart."""
    ctx = current_tenant()
    await _get_owned(db, broadcast_id)

    scope = (
        BroadcastRecipient.org_id == ctx.org_id,
        BroadcastRecipient.broadcast_id == broadcast_id,
        BroadcastRecipient.deleted_at.is_(None),
    )

    # Funnel counts over the unfiltered set, so filtering to one status does
    # not make the other counts disappear from the tab strip.
    counts = dict(
        (
            await db.execute(
                select(BroadcastRecipient.status, func.count())
                .where(*scope)
                .group_by(BroadcastRecipient.status)
            )
        ).all()
    )

    filtered = select(BroadcastRecipient).where(*scope)
    if status_filter:
        filtered = filtered.where(BroadcastRecipient.status.in_(status_filter))
    if search:
        term = f"%{search}%"
        filtered = filtered.where(
            or_(
                BroadcastRecipient.destination.ilike(term),
                BroadcastRecipient.display_name.ilike(term),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(filtered.subquery()))
    ).scalar_one()

    rows = (
        await db.execute(
            filtered.order_by(BroadcastRecipient.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).scalars().all()

    return RecipientListOut(
        items=[RecipientOut.model_validate(r) for r in rows],
        total=total, page=page, limit=limit, counts=counts,
    )


async def _get_owned(db: AsyncSession, broadcast_id: uuid.UUID) -> Broadcast:
    ctx = current_tenant()
    stmt = select(Broadcast).where(
        Broadcast.id == broadcast_id, Broadcast.org_id == ctx.org_id, Broadcast.deleted_at.is_(None)
    )
    b = (await db.execute(stmt)).scalar_one_or_none()
    if b is None:
        raise NotFoundError(f"Broadcast {broadcast_id} not found")
    return b
