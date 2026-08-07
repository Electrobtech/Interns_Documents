"""Audiences — /ai-agents/marketing/audiences.

Previously list + create only, living inside campaigns.py because the only
consumer was the campaign wizard's audience-picker step. That made the tab
operable as a one-way list: an audience could be created but never corrected,
retargeted, or removed.

The delete guard is the substantive part. `MarketingCampaign.audience_id` is
`ON DELETE SET NULL`, so without a check, deleting an audience silently
un-targets every campaign pointing at it — a live campaign would keep running
against nobody. Refusing the delete and naming the campaigns is the honest
behaviour; the database's cascade rule is a last resort, not a policy.

An audience stores a *rule*, not a member list — contact rows live in the Node
CRM. `size` is therefore always a cached estimate carrying the timestamp of
when it was computed, and the UI shows that age rather than implying live data.
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

from ...models.marketing import MarketingAudience, MarketingCampaign
from ...schemas.campaigns import (
    AudienceCampaignRef,
    AudienceCreate,
    AudienceOut,
    AudienceSizeEstimate,
    AudienceUpdate,
)

router = APIRouter(prefix="/ai-agents/marketing", tags=["marketing-audiences"])

# A campaign in any of these states is still going to use its audience, so the
# audience cannot be deleted out from under it. Completed and archived
# campaigns are historical and safe to orphan.
BLOCKING_CAMPAIGN_STATUSES = (
    "draft", "pending_review", "approved", "scheduled", "running", "paused",
)


@router.get("/audiences", response_model=list[AudienceOut])
async def list_audiences(
    search: str | None = Query(default=None, max_length=200),
    audience_type: str | None = Query(default=None),
    limit: int = Query(default=100, le=200),
    db: AsyncSession = Depends(get_session),
) -> list[AudienceOut]:
    ctx = current_tenant()
    stmt = (
        select(MarketingAudience)
        .where(MarketingAudience.org_id == ctx.org_id, MarketingAudience.deleted_at.is_(None))
        .order_by(MarketingAudience.created_at.desc())
        .limit(limit)
    )
    if search:
        stmt = stmt.where(MarketingAudience.name.ilike(f"%{search}%"))
    if audience_type:
        stmt = stmt.where(MarketingAudience.audience_type == audience_type)

    rows = (await db.execute(stmt)).scalars().all()
    counts = await _campaign_counts(db, ctx.org_id, [a.id for a in rows])
    return [_out(a, campaign_count=counts.get(a.id, 0)) for a in rows]


@router.post("/audiences", response_model=AudienceOut, status_code=201)
async def create_audience(
    body: AudienceCreate, db: AsyncSession = Depends(get_session)
) -> AudienceOut:
    ctx = current_tenant()
    a = MarketingAudience(
        org_id=ctx.org_id, created_by=ctx.user_id,
        name=body.name, description=body.description,
        audience_type=body.audience_type, filters=body.filters, tags=body.tags,
    )
    db.add(a)
    await db.flush()
    return _out(a, campaign_count=0)


@router.get("/audiences/{audience_id}", response_model=AudienceOut)
async def get_audience(
    audience_id: uuid.UUID, db: AsyncSession = Depends(get_session)
) -> AudienceOut:
    ctx = current_tenant()
    a = await _get_owned(db, audience_id)
    counts = await _campaign_counts(db, ctx.org_id, [a.id])
    return _out(a, campaign_count=counts.get(a.id, 0))


@router.put("/audiences/{audience_id}", response_model=AudienceOut)
async def update_audience(
    audience_id: uuid.UUID, body: AudienceUpdate, db: AsyncSession = Depends(get_session)
) -> AudienceOut:
    ctx = current_tenant()
    a = await _get_owned(db, audience_id)

    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(a, field, value)
    a.updated_by = ctx.user_id

    # Editing the rule invalidates the cached size — the old number describes a
    # different audience. Null both together so the UI shows "not yet
    # estimated" rather than a stale count with a misleadingly recent age.
    if "filters" in body.model_fields_set:
        a.size = None
        a.size_computed_at = None

    await db.flush()
    counts = await _campaign_counts(db, ctx.org_id, [a.id])
    return _out(a, campaign_count=counts.get(a.id, 0))


@router.delete("/audiences/{audience_id}", status_code=204, response_class=Response)
async def delete_audience(
    audience_id: uuid.UUID, db: AsyncSession = Depends(get_session)
) -> Response:
    ctx = current_tenant()
    a = await _get_owned(db, audience_id)

    blocking = (
        await db.execute(
            select(MarketingCampaign.name, MarketingCampaign.status)
            .where(
                MarketingCampaign.org_id == ctx.org_id,
                MarketingCampaign.audience_id == audience_id,
                MarketingCampaign.deleted_at.is_(None),
                MarketingCampaign.status.in_(BLOCKING_CAMPAIGN_STATUSES),
            )
            .limit(5)
        )
    ).all()

    if blocking:
        names = ", ".join(f"{r.name} ({r.status})" for r in blocking)
        raise ConflictError(
            f"This audience is still targeted by {len(blocking)} campaign(s): "
            f"{names}. Repoint or archive them before deleting it."
        )

    a.deleted_at = datetime.now(timezone.utc)
    a.updated_by = ctx.user_id
    await db.flush()
    return Response(status_code=204)


@router.get("/audiences/{audience_id}/campaigns", response_model=list[AudienceCampaignRef])
async def audience_campaigns(
    audience_id: uuid.UUID, db: AsyncSession = Depends(get_session)
) -> list[AudienceCampaignRef]:
    ctx = current_tenant()
    await _get_owned(db, audience_id)
    rows = (
        await db.execute(
            select(MarketingCampaign)
            .where(
                MarketingCampaign.org_id == ctx.org_id,
                MarketingCampaign.audience_id == audience_id,
                MarketingCampaign.deleted_at.is_(None),
            )
            .order_by(MarketingCampaign.created_at.desc())
        )
    ).scalars().all()
    return [AudienceCampaignRef.model_validate(c) for c in rows]


@router.post("/audiences/{audience_id}/estimate-size", response_model=AudienceOut)
async def record_size_estimate(
    audience_id: uuid.UUID,
    body: AudienceSizeEstimate,
    db: AsyncSession = Depends(get_session),
) -> AudienceOut:
    """Records a size estimate against the audience.

    This route stores a figure; it does not compute one. Orbq holds targeting
    rules, not contact rows, so the count has to come from whatever can
    actually evaluate the rule against the CRM. Keeping the write separate
    means the stored number always has a known origin and a timestamp, instead
    of a plausible figure appearing with no way to tell how it was derived.
    """
    ctx = current_tenant()
    a = await _get_owned(db, audience_id)
    a.size = body.size
    a.size_computed_at = datetime.now(timezone.utc)
    a.updated_by = ctx.user_id
    await db.flush()
    counts = await _campaign_counts(db, ctx.org_id, [a.id])
    return _out(a, campaign_count=counts.get(a.id, 0))


# ─── helpers ──────────────────────────────────────────────────────────────

def _out(a: MarketingAudience, *, campaign_count: int) -> AudienceOut:
    return AudienceOut(
        id=a.id, name=a.name, description=a.description,
        audience_type=a.audience_type, filters=a.filters, tags=a.tags,
        size=a.size, size_computed_at=a.size_computed_at,
        source_audience_id=a.source_audience_id, ai_generated=a.ai_generated,
        created_at=a.created_at, updated_at=a.updated_at,
        campaign_count=campaign_count,
    )


async def _campaign_counts(
    db: AsyncSession, org_id: uuid.UUID, audience_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """One grouped query for the whole page rather than a count per row."""
    if not audience_ids:
        return {}
    rows = (
        await db.execute(
            select(MarketingCampaign.audience_id, func.count())
            .where(
                MarketingCampaign.org_id == org_id,
                MarketingCampaign.audience_id.in_(audience_ids),
                MarketingCampaign.deleted_at.is_(None),
            )
            .group_by(MarketingCampaign.audience_id)
        )
    ).all()
    return {aid: count for aid, count in rows}


async def _get_owned(db: AsyncSession, audience_id: uuid.UUID) -> MarketingAudience:
    ctx = current_tenant()
    stmt = select(MarketingAudience).where(
        MarketingAudience.id == audience_id,
        MarketingAudience.org_id == ctx.org_id,
        MarketingAudience.deleted_at.is_(None),
    )
    a = (await db.execute(stmt)).scalar_one_or_none()
    if a is None:
        raise NotFoundError(f"Audience {audience_id} not found")
    return a
