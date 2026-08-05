"""Campaigns + Audiences API — the real backend behind the Campaigns tab.

Mounted under /ai-agents/marketing/*, not the bare /campaigns the Node gateway
already claims for campaign-service — this avoids colliding with that route
even though campaign-service isn't currently functional (Orbq owns the full
marketing lifecycle now: plan, audience, content, schedule, and delivery).

Status changes go through their own endpoint rather than a generic PATCH, so
CAMPAIGN_TRANSITIONS is consulted on every change — there is no path that lets
a client jump straight from draft to running.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.errors import ConflictError, NotFoundError, ValidationError
from orbq_core.tenancy import current_tenant

from ...models.marketing import (
    CAMPAIGN_TRANSITIONS,
    CampaignItem,
    CampaignStatusHistory,
    MarketingAudience,
    MarketingCampaign,
)
from ...schemas.campaigns import (
    AudienceCreate,
    AudienceOut,
    CampaignCreate,
    CampaignDetailOut,
    CampaignListOut,
    CampaignOut,
    CampaignUpdate,
    StatusChangeRequest,
    StatusHistoryOut,
)

router = APIRouter(prefix="/ai-agents/marketing", tags=["marketing-campaigns"])


def _campaign_out(c: MarketingCampaign, *, item_count: int = 0) -> CampaignOut:
    """Never touches `c.items`. Async SQLAlchemy has no implicit lazy load —
    a relationship access outside an explicit `await` crashes with
    MissingGreenlet, and an expired-but-present attribute makes a naive
    `"items" in c.__dict__` check lie about whether it's safe to read. Callers
    that need the count pass it in from an explicit query instead.
    """
    return CampaignOut(
        id=c.id, name=c.name, description=c.description, objective=c.objective,
        platforms=c.platforms, status=c.status, tags=c.tags,
        budget_type=c.budget_type, budget_amount=c.budget_amount,
        currency=c.currency, bid_strategy=c.bid_strategy,
        start_date=c.start_date, end_date=c.end_date, timezone=c.timezone,
        audience_id=c.audience_id, ai_generated=c.ai_generated,
        ai_execution_id=c.ai_execution_id,
        ai_confidence=float(c.ai_confidence) if c.ai_confidence is not None else None,
        external_campaign_id=c.external_campaign_id, published_at=c.published_at,
        tracking=c.tracking, item_count=item_count,
        created_at=c.created_at, updated_at=c.updated_at, created_by=c.created_by,
    )


async def _load_items(db: AsyncSession, org_id: uuid.UUID, campaign_id: uuid.UUID) -> list[CampaignItem]:
    """Explicit query, not relationship access — see _campaign_out's docstring."""
    stmt = (
        select(CampaignItem)
        .where(CampaignItem.org_id == org_id, CampaignItem.campaign_id == campaign_id)
        .order_by(CampaignItem.sequence)
    )
    return list((await db.execute(stmt)).scalars().all())


def _item_out(i: CampaignItem) -> dict:
    return {
        "id": i.id, "sequence": i.sequence, "channel": i.channel,
        "day_offset": i.day_offset, "subject": i.subject,
        "message_body": i.message_body, "call_to_action": i.call_to_action,
        "audience_filter": i.audience_filter, "created_at": i.created_at,
    }


# ---------------------------------------------------------------------------
# Campaigns
# ---------------------------------------------------------------------------


@router.get("/campaigns", response_model=CampaignListOut)
async def list_campaigns(
    status_filter: list[str] | None = Query(default=None, alias="status"),
    objective: list[str] | None = Query(default=None),
    platform: list[str] | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    sort: str = Query(default="-created_at"),
    db: AsyncSession = Depends(get_session),
) -> CampaignListOut:
    """List with the filter/search/sort/pagination shape the spec calls for.

    `status`/`objective`/`platform` accept repeated query params
    (?status=draft&status=running) — an OR within the field, ANDed across
    fields, matching the filter panel's semantics.
    """
    ctx = current_tenant()
    stmt = select(MarketingCampaign).where(
        MarketingCampaign.org_id == ctx.org_id,
        MarketingCampaign.deleted_at.is_(None),
    )
    count_stmt = select(func.count()).select_from(MarketingCampaign).where(
        MarketingCampaign.org_id == ctx.org_id,
        MarketingCampaign.deleted_at.is_(None),
    )

    if status_filter:
        stmt = stmt.where(MarketingCampaign.status.in_(status_filter))
        count_stmt = count_stmt.where(MarketingCampaign.status.in_(status_filter))
    if objective:
        stmt = stmt.where(MarketingCampaign.objective.in_(objective))
        count_stmt = count_stmt.where(MarketingCampaign.objective.in_(objective))
    if platform:
        # array overlap: campaign matches if ANY selected platform is in its list
        stmt = stmt.where(MarketingCampaign.platforms.overlap(platform))
        count_stmt = count_stmt.where(MarketingCampaign.platforms.overlap(platform))
    if search:
        # ILIKE against name + description. The migration also builds a
        # search_tsv GIN index for a full-text upgrade path, but that column
        # isn't mapped on the ORM model yet, so this stays substring-based
        # until it is.
        pattern = f"%{search}%"
        clause = or_(
            MarketingCampaign.name.ilike(pattern),
            MarketingCampaign.description.ilike(pattern),
        )
        stmt = stmt.where(clause)
        count_stmt = count_stmt.where(clause)

    sort_col = sort.lstrip("-")
    sort_map = {
        "created_at": MarketingCampaign.created_at,
        "updated_at": MarketingCampaign.updated_at,
        "name": MarketingCampaign.name,
        "budget_amount": MarketingCampaign.budget_amount,
        "start_date": MarketingCampaign.start_date,
    }
    col = sort_map.get(sort_col, MarketingCampaign.created_at)
    stmt = stmt.order_by(col.desc() if sort.startswith("-") else col.asc())
    stmt = stmt.offset((page - 1) * limit).limit(limit)

    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt)).scalars().all()

    # One grouped query for all item counts rather than N+1 per-campaign queries.
    counts: dict[uuid.UUID, int] = {}
    if rows:
        count_rows = (
            await db.execute(
                select(CampaignItem.campaign_id, func.count())
                .where(CampaignItem.campaign_id.in_([c.id for c in rows]))
                .group_by(CampaignItem.campaign_id)
            )
        ).all()
        counts = dict(count_rows)

    return CampaignListOut(
        items=[_campaign_out(c, item_count=counts.get(c.id, 0)) for c in rows],
        total=total, page=page, limit=limit,
    )


@router.post("/campaigns", response_model=CampaignDetailOut, status_code=201)
async def create_campaign(
    body: CampaignCreate, db: AsyncSession = Depends(get_session)
) -> CampaignDetailOut:
    ctx = current_tenant()

    if body.audience_id:
        audience = await db.get(MarketingAudience, body.audience_id)
        if audience is None or audience.org_id != ctx.org_id:
            raise ValidationError("audience_id does not refer to an existing audience")

    campaign = MarketingCampaign(
        org_id=ctx.org_id,
        created_by=ctx.user_id,
        name=body.name,
        description=body.description,
        objective=body.objective,
        platforms=body.platforms,
        tags=body.tags,
        budget_type=body.budget_type,
        budget_amount=body.budget_amount,
        currency=body.currency,
        bid_strategy=body.bid_strategy,
        start_date=body.start_date,
        end_date=body.end_date,
        timezone=body.timezone,
        audience_id=body.audience_id,
        tracking=body.tracking,
    )
    db.add(campaign)
    await db.flush()  # need campaign.id before attaching items

    for item in body.items:
        db.add(
            CampaignItem(
                org_id=ctx.org_id,
                created_by=ctx.user_id,
                campaign_id=campaign.id,
                sequence=item.sequence,
                channel=item.channel,
                day_offset=item.day_offset,
                subject=item.subject,
                message_body=item.message_body,
                call_to_action=item.call_to_action,
                audience_filter=item.audience_filter,
            )
        )

    db.add(
        CampaignStatusHistory(
            org_id=ctx.org_id, campaign_id=campaign.id,
            from_status=None, to_status="draft", actor_id=ctx.user_id,
            reason="Created",
        )
    )
    await db.flush()

    items = await _load_items(db, ctx.org_id, campaign.id)
    out = _campaign_out(campaign, item_count=len(items))
    return CampaignDetailOut(**out.model_dump(), items=[_item_out(i) for i in items])


@router.get("/campaigns/{campaign_id}", response_model=CampaignDetailOut)
async def get_campaign(
    campaign_id: uuid.UUID, db: AsyncSession = Depends(get_session)
) -> CampaignDetailOut:
    ctx = current_tenant()
    campaign = await _get_owned(db, campaign_id)
    items = await _load_items(db, ctx.org_id, campaign.id)
    out = _campaign_out(campaign, item_count=len(items))
    return CampaignDetailOut(**out.model_dump(), items=[_item_out(i) for i in items])


@router.put("/campaigns/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: uuid.UUID, body: CampaignUpdate, db: AsyncSession = Depends(get_session)
) -> CampaignOut:
    ctx = current_tenant()
    campaign = await _get_owned(db, campaign_id)

    # Editing a running/completed/archived campaign's targeting or budget
    # after the fact is how spend goes unaccountable — restrict to the
    # pre-flight states, same principle as the status machine itself.
    if campaign.status not in {"draft", "pending_review", "approved"}:
        raise ConflictError(
            f"Campaign is {campaign.status}; only draft/pending_review/approved "
            "campaigns can be edited. Pause it first, or duplicate it."
        )

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(campaign, field, value)
    campaign.updated_by = ctx.user_id

    await db.flush()
    items = await _load_items(db, ctx.org_id, campaign.id)
    return _campaign_out(campaign, item_count=len(items))


@router.delete("/campaigns/{campaign_id}", status_code=204, response_class=Response)
async def delete_campaign(
    campaign_id: uuid.UUID, db: AsyncSession = Depends(get_session)
) -> Response:
    """Soft delete. A published campaign's history must survive even after
    the marketer removes it from their list (§16.3)."""
    ctx = current_tenant()
    campaign = await _get_owned(db, campaign_id)
    campaign.deleted_at = datetime.now(timezone.utc)
    campaign.updated_by = ctx.user_id
    await db.flush()
    return Response(status_code=204)


@router.post("/campaigns/{campaign_id}/duplicate", response_model=CampaignDetailOut, status_code=201)
async def duplicate_campaign(
    campaign_id: uuid.UUID, db: AsyncSession = Depends(get_session)
) -> CampaignDetailOut:
    ctx = current_tenant()
    original = await _get_owned(db, campaign_id)

    copy = MarketingCampaign(
        org_id=ctx.org_id, created_by=ctx.user_id,
        name=await _unique_copy_name(db, ctx.org_id, original.name),
        description=original.description, objective=original.objective,
        platforms=list(original.platforms), tags=list(original.tags),
        budget_type=original.budget_type, budget_amount=original.budget_amount,
        currency=original.currency, bid_strategy=original.bid_strategy,
        timezone=original.timezone, audience_id=original.audience_id,
        tracking=dict(original.tracking),
        status="draft",  # a duplicate always restarts at draft, never inherits "running"
    )
    db.add(copy)
    await db.flush()

    original_items = await _load_items(db, ctx.org_id, original.id)
    for item in original_items:
        db.add(
            CampaignItem(
                org_id=ctx.org_id, created_by=ctx.user_id, campaign_id=copy.id,
                sequence=item.sequence, channel=item.channel, day_offset=item.day_offset,
                subject=item.subject, message_body=item.message_body,
                call_to_action=item.call_to_action, audience_filter=item.audience_filter,
                creative=dict(item.creative),
            )
        )
    db.add(
        CampaignStatusHistory(
            org_id=ctx.org_id, campaign_id=copy.id, from_status=None, to_status="draft",
            actor_id=ctx.user_id, reason=f"Duplicated from {original.id}",
        )
    )
    await db.flush()

    new_items = await _load_items(db, ctx.org_id, copy.id)
    out = _campaign_out(copy, item_count=len(new_items))
    return CampaignDetailOut(**out.model_dump(), items=[_item_out(i) for i in new_items])


@router.post("/campaigns/{campaign_id}/status", response_model=CampaignOut)
async def change_campaign_status(
    campaign_id: uuid.UUID, body: StatusChangeRequest, db: AsyncSession = Depends(get_session)
) -> CampaignOut:
    """The only path that moves a campaign between statuses.

    Backs Pause/Resume/Archive/Publish. CAMPAIGN_TRANSITIONS is consulted
    every time, so a client cannot jump straight from draft to running by
    calling this with an unexpected target — the same discipline as the
    approval engine's state machine.
    """
    ctx = current_tenant()
    campaign = await _get_owned(db, campaign_id)

    if body.to_status not in CAMPAIGN_TRANSITIONS.get(campaign.status, set()):
        raise ConflictError(
            f"Cannot move campaign from '{campaign.status}' to '{body.to_status}'. "
            f"Legal next states: {sorted(CAMPAIGN_TRANSITIONS.get(campaign.status, set())) or 'none (terminal)'}"
        )

    from_status = campaign.status
    campaign.status = body.to_status
    campaign.updated_by = ctx.user_id
    if body.to_status == "running" and campaign.published_at is None:
        campaign.published_at = datetime.now(timezone.utc)

    db.add(
        CampaignStatusHistory(
            org_id=ctx.org_id, campaign_id=campaign.id,
            from_status=from_status, to_status=body.to_status,
            actor_id=ctx.user_id, reason=body.reason,
        )
    )
    await db.flush()
    items = await _load_items(db, ctx.org_id, campaign.id)
    return _campaign_out(campaign, item_count=len(items))


@router.get("/campaigns/{campaign_id}/history", response_model=list[StatusHistoryOut])
async def campaign_status_history(
    campaign_id: uuid.UUID, db: AsyncSession = Depends(get_session)
) -> list[StatusHistoryOut]:
    ctx = current_tenant()
    await _get_owned(db, campaign_id)  # 404s if not visible to this org
    rows = (
        await db.execute(
            select(CampaignStatusHistory)
            .where(
                CampaignStatusHistory.org_id == ctx.org_id,
                CampaignStatusHistory.campaign_id == campaign_id,
            )
            .order_by(CampaignStatusHistory.created_at)
        )
    ).scalars().all()
    return [StatusHistoryOut.model_validate(r) for r in rows]


# ---------------------------------------------------------------------------
# Audiences — the picker the campaign wizard's audience step needs
# ---------------------------------------------------------------------------


@router.get("/audiences", response_model=list[AudienceOut])
async def list_audiences(
    search: str | None = Query(default=None, max_length=200),
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
    rows = (await db.execute(stmt)).scalars().all()
    return [AudienceOut.model_validate(a) for a in rows]


@router.post("/audiences", response_model=AudienceOut, status_code=201)
async def create_audience(
    body: AudienceCreate, db: AsyncSession = Depends(get_session)
) -> AudienceOut:
    ctx = current_tenant()
    audience = MarketingAudience(
        org_id=ctx.org_id, created_by=ctx.user_id,
        name=body.name, description=body.description,
        audience_type=body.audience_type, filters=body.filters, tags=body.tags,
    )
    db.add(audience)
    await db.flush()
    return AudienceOut.model_validate(audience)


# ---------------------------------------------------------------------------
# internals
# ---------------------------------------------------------------------------


async def _get_owned(db: AsyncSession, campaign_id: uuid.UUID) -> MarketingCampaign:
    ctx = current_tenant()
    stmt = (
        select(MarketingCampaign)
        .where(
            MarketingCampaign.id == campaign_id,
            MarketingCampaign.org_id == ctx.org_id,
            MarketingCampaign.deleted_at.is_(None),
        )
    )
    campaign = (await db.execute(stmt)).scalar_one_or_none()
    if campaign is None:
        raise NotFoundError(f"Campaign {campaign_id} not found")
    return campaign


async def _unique_copy_name(db: AsyncSession, org_id: uuid.UUID, base_name: str) -> str:
    """'Q4 Lead Gen' -> 'Q4 Lead Gen (Copy)' -> 'Q4 Lead Gen (Copy 2)' ..."""
    candidate = f"{base_name} (Copy)"
    n = 2
    while True:
        exists = (
            await db.execute(
                select(MarketingCampaign.id).where(
                    MarketingCampaign.org_id == org_id,
                    MarketingCampaign.name == candidate,
                    MarketingCampaign.deleted_at.is_(None),
                    MarketingCampaign.status != "archived",
                )
            )
        ).scalar_one_or_none()
        if exists is None:
            return candidate
        candidate = f"{base_name} (Copy {n})"
        n += 1
