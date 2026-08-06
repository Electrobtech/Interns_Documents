"""Reports — /ai-agents/marketing/reports.

A report is a stored, point-in-time JSON snapshot computed from Orbq's own
marketing tables (campaigns, broadcasts, delivery events, content, SEO/AEO,
competitors) — never fabricated. Where a report type implies data Orbq does
not own (lead/revenue attribution lives in the Node CRM — see the scope note
atop models/marketing.py), that field is `null` with an explanation, matching
the dashboard's honesty discipline rather than inventing a plausible number.

Generation is synchronous: these are indexed aggregates over one org's rows,
cheap enough that a background job + polling would be pure overhead.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.errors import NotFoundError
from orbq_core.tenancy import current_tenant

from ...models.marketing import (
    AEOProject,
    Broadcast,
    Competitor,
    CompetitorSnapshot,
    ContentDoc,
    DeliveryEvent,
    MarketingCampaign,
    Report,
    SEOKeyword,
    SEOProject,
)
from ...schemas.marketing_extras import ReportGenerate, ReportOut

router = APIRouter(prefix="/ai-agents/marketing/reports", tags=["marketing-reports"])


@router.get("", response_model=list[ReportOut])
async def list_reports(
    report_type: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_session),
) -> list[ReportOut]:
    ctx = current_tenant()
    stmt = (
        select(Report)
        .where(Report.org_id == ctx.org_id, Report.deleted_at.is_(None))
        .order_by(Report.created_at.desc())
        .limit(limit)
    )
    if report_type:
        stmt = stmt.where(Report.report_type == report_type)
    rows = (await db.execute(stmt)).scalars().all()
    return [ReportOut.model_validate(r) for r in rows]


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(report_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> ReportOut:
    return ReportOut.model_validate(await _get_owned(db, report_id))


@router.post("/generate", response_model=ReportOut, status_code=201)
async def generate_report(body: ReportGenerate, db: AsyncSession = Depends(get_session)) -> ReportOut:
    ctx = current_tenant()
    period_end = body.period_end or datetime.now(timezone.utc).date()
    period_start = body.period_start or (period_end - timedelta(days=30))

    data = await _compute_report_data(db, ctx.org_id, body.report_type, period_start, period_end)

    r = Report(
        org_id=ctx.org_id, created_by=ctx.user_id, name=body.name, report_type=body.report_type,
        period_start=period_start, period_end=period_end, status="completed", data=data,
    )
    db.add(r)
    await db.flush()
    return ReportOut.model_validate(r)


@router.delete("/{report_id}", status_code=204, response_class=Response)
async def delete_report(report_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> Response:
    ctx = current_tenant()
    r = await _get_owned(db, report_id)
    r.deleted_at = datetime.now(timezone.utc)
    r.updated_by = ctx.user_id
    await db.flush()
    return Response(status_code=204)


async def _get_owned(db: AsyncSession, report_id: uuid.UUID) -> Report:
    ctx = current_tenant()
    stmt = select(Report).where(
        Report.id == report_id, Report.org_id == ctx.org_id, Report.deleted_at.is_(None)
    )
    r = (await db.execute(stmt)).scalar_one_or_none()
    if r is None:
        raise NotFoundError(f"Report {report_id} not found")
    return r


# ─── Snapshot computation ──────────────────────────────────────────────────

_NEEDS_CAMPAIGNS = {"campaign_performance", "monthly_summary", "roi_analysis", "executive_summary"}
_NEEDS_CONTENT = {"monthly_summary", "executive_summary"}
_NEEDS_ROI = {"roi_analysis", "executive_summary"}
_NEEDS_LEADS = {"lead_report", "executive_summary"}
_NEEDS_SEO = {"seo", "executive_summary"}
_NEEDS_AEO = {"aeo", "executive_summary"}
_NEEDS_COMPETITOR = {"competitor", "executive_summary"}


async def _compute_report_data(
    db: AsyncSession, org_id: uuid.UUID, report_type: str, period_start: date, period_end: date,
) -> dict:
    start_dt = datetime.combine(period_start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(period_end, time.max, tzinfo=timezone.utc)

    data: dict = {"period": {"start": period_start.isoformat(), "end": period_end.isoformat()}}

    if report_type in _NEEDS_CAMPAIGNS:
        data["campaigns"] = await _campaign_summary(db, org_id, start_dt, end_dt)
        data["broadcasts"] = await _broadcast_summary(db, org_id, start_dt, end_dt)
        data["delivery_funnel"] = await _delivery_funnel(db, org_id, start_dt, end_dt)
    if report_type in _NEEDS_CONTENT:
        data["content"] = await _content_summary(db, org_id, start_dt, end_dt)
    if report_type in _NEEDS_ROI:
        data["roi"] = {
            "total_budget_allocated": data.get("campaigns", {}).get("total_budget"),
            "revenue_attributed": None,
            "note": (
                "Revenue attribution is not available — it requires order/deal "
                "data from the CRM, which Orbq's marketing schema does not own."
            ),
        }
    if report_type in _NEEDS_LEADS:
        data["leads"] = {
            "processed": None,
            "note": (
                "Lead/contact data lives in the Node CRM, not in Orbq. Connect "
                "that integration to populate this section."
            ),
        }
    if report_type in _NEEDS_SEO:
        data["seo"] = await _seo_summary(db, org_id)
    if report_type in _NEEDS_AEO:
        data["aeo"] = await _aeo_summary(db, org_id)
    if report_type in _NEEDS_COMPETITOR:
        data["competitor"] = await _competitor_summary(db, org_id)

    return data


async def _campaign_summary(db: AsyncSession, org_id: uuid.UUID, start_dt: datetime, end_dt: datetime) -> dict:
    stmt = (
        select(
            MarketingCampaign.status,
            func.count().label("n"),
            func.sum(MarketingCampaign.budget_amount).label("budget"),
        )
        .where(
            MarketingCampaign.org_id == org_id, MarketingCampaign.deleted_at.is_(None),
            MarketingCampaign.created_at >= start_dt, MarketingCampaign.created_at <= end_dt,
        )
        .group_by(MarketingCampaign.status)
    )
    rows = (await db.execute(stmt)).all()
    by_status = {r.status: r.n for r in rows}
    total_budget = sum((r.budget or 0) for r in rows)
    return {
        "total": sum(by_status.values()),
        "by_status": by_status,
        "total_budget": float(total_budget),
    }


async def _broadcast_summary(db: AsyncSession, org_id: uuid.UUID, start_dt: datetime, end_dt: datetime) -> dict:
    stmt = (
        select(Broadcast.status, func.count().label("n"))
        .where(
            Broadcast.org_id == org_id, Broadcast.deleted_at.is_(None),
            Broadcast.created_at >= start_dt, Broadcast.created_at <= end_dt,
        )
        .group_by(Broadcast.status)
    )
    by_status = {r.status: r.n for r in (await db.execute(stmt)).all()}
    return {"total": sum(by_status.values()), "by_status": by_status}


async def _delivery_funnel(db: AsyncSession, org_id: uuid.UUID, start_dt: datetime, end_dt: datetime) -> dict:
    stmt = (
        select(DeliveryEvent.event_type, func.count().label("n"))
        .where(
            DeliveryEvent.org_id == org_id, DeliveryEvent.deleted_at.is_(None),
            DeliveryEvent.occurred_at >= start_dt, DeliveryEvent.occurred_at <= end_dt,
        )
        .group_by(DeliveryEvent.event_type)
    )
    return {r.event_type: r.n for r in (await db.execute(stmt)).all()}


async def _content_summary(db: AsyncSession, org_id: uuid.UUID, start_dt: datetime, end_dt: datetime) -> dict:
    stmt = (
        select(ContentDoc.content_type, func.count().label("n"))
        .where(
            ContentDoc.org_id == org_id, ContentDoc.deleted_at.is_(None),
            ContentDoc.created_at >= start_dt, ContentDoc.created_at <= end_dt,
        )
        .group_by(ContentDoc.content_type)
    )
    by_type = {r.content_type: r.n for r in (await db.execute(stmt)).all()}
    return {"total": sum(by_type.values()), "by_type": by_type}


async def _seo_summary(db: AsyncSession, org_id: uuid.UUID) -> dict:
    projects = (await db.execute(
        select(func.count()).where(SEOProject.org_id == org_id, SEOProject.deleted_at.is_(None))
    )).scalar_one()
    keywords = (await db.execute(
        select(func.count()).where(SEOKeyword.org_id == org_id, SEOKeyword.deleted_at.is_(None))
    )).scalar_one()
    avg_score = (await db.execute(
        select(func.avg(SEOProject.latest_score)).where(
            SEOProject.org_id == org_id, SEOProject.deleted_at.is_(None), SEOProject.latest_score.is_not(None)
        )
    )).scalar_one()
    return {
        "projects": projects,
        "keywords_tracked": keywords,
        "avg_score": round(float(avg_score), 1) if avg_score is not None else None,
    }


async def _aeo_summary(db: AsyncSession, org_id: uuid.UUID) -> dict:
    projects = (await db.execute(
        select(func.count()).where(AEOProject.org_id == org_id, AEOProject.deleted_at.is_(None))
    )).scalar_one()
    avg_visibility = (await db.execute(
        select(func.avg(AEOProject.visibility_estimate)).where(
            AEOProject.org_id == org_id, AEOProject.deleted_at.is_(None),
            AEOProject.visibility_estimate.is_not(None),
        )
    )).scalar_one()
    return {
        "projects": projects,
        "avg_visibility_estimate": round(float(avg_visibility), 1) if avg_visibility is not None else None,
    }


async def _competitor_summary(db: AsyncSession, org_id: uuid.UUID) -> dict:
    competitors = (await db.execute(
        select(func.count()).where(Competitor.org_id == org_id, Competitor.deleted_at.is_(None))
    )).scalar_one()
    snapshots = (await db.execute(
        select(func.count()).where(CompetitorSnapshot.org_id == org_id, CompetitorSnapshot.deleted_at.is_(None))
    )).scalar_one()
    return {"competitors_tracked": competitors, "snapshots_taken": snapshots}
