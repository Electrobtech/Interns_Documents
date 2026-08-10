"""Marketing Hub dashboard — GET /ai-agents/marketing/dashboard.

Replaces the client-side composition in `MarketingDashboard.jsx`, which called
`useBroadcasts()` + `useContent()` + `useReports()` and derived its KPIs in the
component. That meant three round trips before the first number rendered, and
it coupled the Dashboard's correctness to which other tabs had been visited.

This is a read aggregation only — no new tables. Every count is a
`COUNT(*) WHERE org_id = ... AND status = ...` against an index whose leading
column is already `org_id`, so the whole payload is index-covered.

Not to be confused with `/ai-agents/status` in dashboard.py, which reports
*agent capability usage* (runs, tokens, confidence) across all three
workspaces and backs the Analytics tab. This one reports marketing objects.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.tenancy import current_tenant

from ...models.governance import ApprovalRequest
from ...models.marketing import (
    Broadcast,
    CampaignStatusHistory,
    ContentDoc,
    MarketingCampaign,
    Report,
)

router = APIRouter(prefix="/ai-agents/marketing", tags=["marketing-dashboard"])

RECENT_ACTIVITY_LIMIT = 12


@router.get("/dashboard")
async def marketing_dashboard(db: AsyncSession = Depends(get_session)) -> dict:
    ctx = current_tenant()
    org_id = ctx.org_id

    # Sequential rather than gathered: these share one AsyncSession, and a
    # session is not safe for concurrent statements. Each is an index-covered
    # count, so the round trips are cheap; correctness beats a false parallel.
    campaigns = await _status_counts(db, MarketingCampaign, org_id)
    broadcasts = await _status_counts(db, Broadcast, org_id)
    content = await _content_counts(db, org_id)
    approvals = await _approval_counts(db, org_id)
    reports_total = await _count(db, Report, org_id)
    activity = await _recent_activity(db, org_id)

    return {
        "campaigns": {
            "total": sum(campaigns.values()),
            "active": campaigns.get("running", 0),
            "scheduled": campaigns.get("scheduled", 0),
            "paused": campaigns.get("paused", 0),
            "draft": campaigns.get("draft", 0),
            "pending_review": campaigns.get("pending_review", 0),
            "by_status": campaigns,
        },
        "broadcasts": {
            "total": sum(broadcasts.values()),
            "scheduled": broadcasts.get("scheduled", 0),
            "sending": broadcasts.get("sending", 0),
            "sent": broadcasts.get("sent", 0),
            "draft": broadcasts.get("draft", 0),
            "by_status": broadcasts,
        },
        "content": content,
        "approvals": approvals,
        "reports": {"total": reports_total},
        "recent_activity": activity,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def _status_counts(db: AsyncSession, model, org_id: uuid.UUID) -> dict[str, int]:
    rows = (
        await db.execute(
            select(model.status, func.count())
            .where(model.org_id == org_id, model.deleted_at.is_(None))
            .group_by(model.status)
        )
    ).all()
    return {status: count for status, count in rows}


async def _count(db: AsyncSession, model, org_id: uuid.UUID) -> int:
    return (
        await db.execute(
            select(func.count()).where(model.org_id == org_id, model.deleted_at.is_(None))
        )
    ).scalar_one()


async def _content_counts(db: AsyncSession, org_id: uuid.UUID) -> dict:
    """`pending_approval` joins against the governance table rather than
    reading a denormalised status column — ContentDoc.approval_id is the only
    link, and the decision lives on ApprovalRequest."""
    total = await _count(db, ContentDoc, org_id)

    pending = (
        await db.execute(
            select(func.count())
            .select_from(ContentDoc)
            .join(ApprovalRequest, ApprovalRequest.id == ContentDoc.approval_id)
            .where(
                ContentDoc.org_id == org_id,
                ContentDoc.deleted_at.is_(None),
                ApprovalRequest.status == "pending",
            )
        )
    ).scalar_one()

    ai_generated = (
        await db.execute(
            select(func.count()).where(
                ContentDoc.org_id == org_id,
                ContentDoc.deleted_at.is_(None),
                ContentDoc.ai_generated.is_(True),
            )
        )
    ).scalar_one()

    return {"total": total, "pending_approval": pending, "ai_generated": ai_generated}


async def _approval_counts(db: AsyncSession, org_id: uuid.UUID) -> dict:
    """Marketing-scoped only. A marketer should not see a support reply
    waiting in their queue."""
    rows = (
        await db.execute(
            select(ApprovalRequest.status, func.count())
            .where(
                ApprovalRequest.org_id == org_id,
                ApprovalRequest.deleted_at.is_(None),
                ApprovalRequest.workspace == "marketing",
            )
            .group_by(ApprovalRequest.status)
        )
    ).all()
    by_status = {status: count for status, count in rows}
    return {
        "pending_count": by_status.get("pending", 0),
        "escalated_count": by_status.get("escalated", 0),
        "by_status": by_status,
    }


async def _recent_activity(db: AsyncSession, org_id: uuid.UUID) -> list[dict]:
    """Merged feed from three sources. Each query takes its own limit, then the
    merge re-sorts and truncates — taking N from each and keeping the newest N
    overall is correct regardless of how the sources interleave.

    DeliveryEvent is deliberately excluded: at send volume it would drown the
    other two, and per-recipient delivery belongs on a campaign's own detail
    view, not an org-wide activity feed.
    """
    status_rows = (
        await db.execute(
            select(
                CampaignStatusHistory.created_at,
                CampaignStatusHistory.campaign_id,
                CampaignStatusHistory.from_status,
                CampaignStatusHistory.to_status,
                MarketingCampaign.name,
            )
            .join(MarketingCampaign, MarketingCampaign.id == CampaignStatusHistory.campaign_id)
            .where(CampaignStatusHistory.org_id == org_id)
            .order_by(CampaignStatusHistory.created_at.desc())
            .limit(RECENT_ACTIVITY_LIMIT)
        )
    ).all()

    report_rows = (
        await db.execute(
            select(Report.created_at, Report.id, Report.name, Report.report_type)
            .where(Report.org_id == org_id, Report.deleted_at.is_(None))
            .order_by(Report.created_at.desc())
            .limit(RECENT_ACTIVITY_LIMIT)
        )
    ).all()

    broadcast_rows = (
        await db.execute(
            select(Broadcast.created_at, Broadcast.id, Broadcast.name, Broadcast.status)
            .where(Broadcast.org_id == org_id, Broadcast.deleted_at.is_(None))
            .order_by(Broadcast.created_at.desc())
            .limit(RECENT_ACTIVITY_LIMIT)
        )
    ).all()

    merged: list[dict] = []

    for r in status_rows:
        merged.append({
            "kind": "campaign_status",
            "at": r.created_at,
            "entity_id": str(r.campaign_id),
            "title": r.name,
            "detail": f"{r.from_status or 'created'} → {r.to_status}",
        })
    for r in report_rows:
        merged.append({
            "kind": "report",
            "at": r.created_at,
            "entity_id": str(r.id),
            "title": r.name,
            "detail": f"{r.report_type} report generated",
        })
    for r in broadcast_rows:
        merged.append({
            "kind": "broadcast",
            "at": r.created_at,
            "entity_id": str(r.id),
            "title": r.name,
            "detail": f"broadcast {r.status}",
        })

    merged.sort(key=lambda x: x["at"], reverse=True)
    return [
        {**item, "at": item["at"].isoformat()}
        for item in merged[:RECENT_ACTIVITY_LIMIT]
    ]
