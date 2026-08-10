"""Marketing Calendar — /ai-agents/marketing/calendar/events."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.errors import NotFoundError, ValidationError
from orbq_core.tenancy import current_tenant

from ...models.marketing import CalendarEvent
from ...schemas.marketing_extras import CalendarEventCreate, CalendarEventOut, CalendarEventUpdate

router = APIRouter(prefix="/ai-agents/marketing/calendar", tags=["marketing-calendar"])


@router.get("/events", response_model=list[CalendarEventOut])
async def list_events(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_session),
) -> list[CalendarEventOut]:
    """Range query, for a month/week grid. Without `start`/`end` returns
    upcoming events only — an unbounded calendar query is how a page load
    accidentally scans years of history."""
    ctx = current_tenant()
    stmt = (
        select(CalendarEvent)
        .where(CalendarEvent.org_id == ctx.org_id, CalendarEvent.deleted_at.is_(None))
        .order_by(CalendarEvent.start_at)
    )
    if start:
        # A recurring event that began before this range still has occurrences
        # inside it, so filtering purely on `start_at` would hide every repeat
        # after the first month. Recurring rows are returned regardless of how
        # far back they started; the client expands them across the range.
        stmt = stmt.where(
            or_(CalendarEvent.start_at >= start, CalendarEvent.recurrence_rule.is_not(None))
        )
    if end:
        # `end` still applies to everything: an event starting after the range
        # is out regardless of whether it repeats.
        stmt = stmt.where(CalendarEvent.start_at <= end)
    if not start and not end:
        stmt = stmt.where(CalendarEvent.start_at >= datetime.now(timezone.utc)).limit(200)
    rows = (await db.execute(stmt)).scalars().all()
    return [CalendarEventOut.model_validate(e) for e in rows]


@router.post("/events", response_model=CalendarEventOut, status_code=201)
async def create_event(body: CalendarEventCreate, db: AsyncSession = Depends(get_session)) -> CalendarEventOut:
    if body.end_at and body.end_at < body.start_at:
        raise ValidationError("end_at must not be before start_at")
    ctx = current_tenant()
    e = CalendarEvent(
        org_id=ctx.org_id, created_by=ctx.user_id, title=body.title, event_type=body.event_type,
        description=body.description, start_at=body.start_at, end_at=body.end_at, all_day=body.all_day,
        campaign_id=body.campaign_id, broadcast_id=body.broadcast_id, content_id=body.content_id,
        recurrence_rule=body.recurrence_rule, timezone=body.timezone,
    )
    db.add(e)
    await db.flush()
    return CalendarEventOut.model_validate(e)


@router.put("/events/{event_id}", response_model=CalendarEventOut)
async def update_event(
    event_id: uuid.UUID, body: CalendarEventUpdate, db: AsyncSession = Depends(get_session)
) -> CalendarEventOut:
    ctx = current_tenant()
    e = await _get_event(db, event_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(e, field, value)
    e.updated_by = ctx.user_id
    await db.flush()
    return CalendarEventOut.model_validate(e)


@router.delete("/events/{event_id}", status_code=204, response_class=Response)
async def delete_event(event_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> Response:
    ctx = current_tenant()
    e = await _get_event(db, event_id)
    e.deleted_at = datetime.now(timezone.utc)
    e.updated_by = ctx.user_id
    await db.flush()
    return Response(status_code=204)


async def _get_event(db: AsyncSession, event_id: uuid.UUID) -> CalendarEvent:
    ctx = current_tenant()
    stmt = select(CalendarEvent).where(
        CalendarEvent.id == event_id, CalendarEvent.org_id == ctx.org_id, CalendarEvent.deleted_at.is_(None)
    )
    e = (await db.execute(stmt)).scalar_one_or_none()
    if e is None:
        raise NotFoundError(f"Calendar event {event_id} not found")
    return e
