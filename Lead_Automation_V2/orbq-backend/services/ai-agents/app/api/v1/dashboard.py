"""Dashboard + analytics reads backing the AI Operations Center UI.

These replace the hardcoded `const AGENTS = [...]` in the frontend's
AIDashboard.jsx. Every number here is computed from agent_executions and
capability_invocations — nothing is fabricated.

Where the UI shows a metric Orbq cannot yet compute (revenue influenced, leads
processed), the field is returned as null rather than a plausible-looking
number, and the frontend renders an em-dash. A dashboard that invents figures is
worse than one that admits a gap.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Float, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.tenancy import current_tenant

from ...models.agent import AgentExecution, CapabilityInvocation
from ...models.knowledge import KnowledgeSource

router = APIRouter(tags=["dashboard"])

WORKSPACES = ("marketing", "sales", "support")

# Capabilities surfaced per workspace in the UI's agent cards.
WORKSPACE_CAPABILITIES = {
    "marketing": ["Campaign Planner", "SEO / AEO Optimizer", "Content Generator", "Competitor Intel"],
    "sales": ["Lead Scoring", "Buying Intent", "Pipeline Analysis", "Follow-up Generator"],
    "support": ["Ticket Classification", "Suggested Replies", "CSAT Risk", "SLA Monitor"],
}

WORKSPACE_META = {
    "marketing": {"name": "Marketing Agent", "icon": "📣", "color": "#7C3AED", "bgColor": "#F5F3FF"},
    "sales": {"name": "Sales Agent", "icon": "📈", "color": "#0284C7", "bgColor": "#F0F9FF"},
    "support": {"name": "Support Agent", "icon": "🎧", "color": "#059669", "bgColor": "#F0FDF4"},
}


def _humanize(delta: timedelta) -> str:
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return f"{seconds} sec ago"
    if seconds < 3600:
        return f"{seconds // 60} min ago"
    if seconds < 86400:
        return f"{seconds // 3600}h ago"
    return f"{seconds // 86400}d ago"


def _duration(ms: float | None) -> str:
    if not ms:
        return "—"
    total = int(ms // 1000)
    if total < 60:
        return f"{total}s"
    return f"{total // 60}m {total % 60:02d}s"


@router.get("/ai-agents/status")
async def agent_status(db: AsyncSession = Depends(get_session)) -> dict:
    """Per-agent status cards + org-wide KPI strip for the AI Operations Center."""
    ctx = current_tenant()
    now = datetime.now(timezone.utc)
    day_start = now - timedelta(days=1)

    # One grouped query rather than three round-trips per workspace.
    stmt = (
        select(
            AgentExecution.workspace,
            func.count().label("total"),
            func.count(case((AgentExecution.status == "running", 1))).label("running"),
            func.count(
                case((AgentExecution.status.in_(("succeeded", "partial")), 1))
            ).label("completed"),
            func.count(case((AgentExecution.status == "failed", 1))).label("failed"),
            func.count(
                case((AgentExecution.status == "pending_approval", 1))
            ).label("pending_approval"),
            func.avg(cast(AgentExecution.confidence, Float)).label("avg_confidence"),
            func.avg(cast(AgentExecution.duration_ms, Float)).label("avg_runtime_ms"),
            func.max(AgentExecution.created_at).label("last_activity"),
            func.sum(AgentExecution.credits).label("credits"),
        )
        .where(
            AgentExecution.org_id == ctx.org_id,
            AgentExecution.deleted_at.is_(None),
            AgentExecution.created_at >= day_start,
        )
        .group_by(AgentExecution.workspace)
    )
    by_workspace = {r.workspace: r for r in (await db.execute(stmt)).all()}

    # Most recent request per workspace — the UI's "current task" line.
    recent_stmt = (
        select(AgentExecution.workspace, AgentExecution.request_message, AgentExecution.status)
        .where(
            AgentExecution.org_id == ctx.org_id,
            AgentExecution.deleted_at.is_(None),
        )
        .order_by(AgentExecution.created_at.desc())
        .limit(30)
    )
    latest: dict[str, str] = {}
    for row in (await db.execute(recent_stmt)).all():
        latest.setdefault(row.workspace, row.request_message)

    sources_stmt = (
        select(KnowledgeSource.workspace, func.count())
        .where(
            KnowledgeSource.org_id == ctx.org_id,
            KnowledgeSource.deleted_at.is_(None),
            KnowledgeSource.is_active.is_(True),
        )
        .group_by(KnowledgeSource.workspace)
    )
    sources = dict((await db.execute(sources_stmt)).all())

    agents = []
    for ws in WORKSPACES:
        row = by_workspace.get(ws)
        meta = WORKSPACE_META[ws]
        last_activity = row.last_activity if row else None
        confidence = row.avg_confidence if row and row.avg_confidence is not None else None

        agents.append(
            {
                "id": ws,
                "name": meta["name"],
                "icon": meta["icon"],
                "color": meta["color"],
                "bgColor": meta["bgColor"],
                # "active" only if something actually ran in the last 24h — the
                # UI should not claim an agent is live when it is idle.
                "status": "active" if row and row.total else "idle",
                "currentTask": latest.get(ws) or "No recent activity",
                "confidence": round(confidence * 100) if confidence is not None else None,
                "queue": row.running if row else 0,
                "completed": row.completed if row else 0,
                "pending": row.pending_approval if row else 0,
                "failed": row.failed if row else 0,
                "avgRuntime": _duration(row.avg_runtime_ms if row else None),
                "knowledgeUsed": f"{sources.get(ws, 0)} sources",
                "lastActivity": _humanize(now - last_activity) if last_activity else "never",
                "capabilities": WORKSPACE_CAPABILITIES[ws],
            }
        )

    totals = list(by_workspace.values())
    confidences = [r.avg_confidence for r in totals if r.avg_confidence is not None]

    return {
        "agents": agents,
        "summary": {
            "agentsActive": sum(1 for a in agents if a["status"] == "active"),
            "tasksToday": sum(r.total for r in totals),
            "completedToday": sum(r.completed for r in totals),
            "activeTasks": sum(r.running for r in totals),
            "pendingApprovals": sum(r.pending_approval for r in totals),
            "avgConfidence": round(sum(confidences) / len(confidences) * 100) if confidences else None,
            "knowledgeSources": sum(sources.values()),
            "creditsToday": sum(r.credits or 0 for r in totals),
            # Not yet computable in the AI layer — these come from the Node
            # platform's CRM/campaign data (ADR-001). Null, not invented.
            "humanEscalations": None,
            "leadsProcessed": None,
            "revenueInfluenced": None,
            "connectedChannels": None,
        },
        "generatedAt": now.isoformat(),
    }


@router.get("/ai-agents/runs")
async def agent_runs(
    workspace: str = Query(pattern="^(marketing|sales|support)$"),
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Recent executions for one agent — the per-workspace activity feed.

    Deliberately a summary projection, not the full trace: the Agent Brain Log
    needs a scannable list. The full decision trace is one level deeper, at
    GET /sessions/{id}/executions.
    """
    ctx = current_tenant()
    stmt = (
        select(AgentExecution)
        .where(
            AgentExecution.org_id == ctx.org_id,
            AgentExecution.workspace == workspace,
            AgentExecution.deleted_at.is_(None),
        )
        .order_by(AgentExecution.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()

    return [
        {
            "id": str(e.id),
            "session_id": str(e.session_id),
            "workspace": e.workspace,
            "status": e.status,
            "request": e.request_message,
            "summary": e.summary,
            "confidence": e.confidence,
            "capabilities_used": e.capabilities_used,
            "duration_ms": e.duration_ms,
            "credits": e.credits,
            "degraded": bool(e.degraded_inputs),
            "error": e.error_detail,
            "created_at": e.created_at.isoformat(),
        }
        for e in rows
    ]


@router.get("/ai-agents/analytics")
async def agent_analytics(
    range: str = Query(default="7d", pattern="^(24h|7d|30d|90d)$"),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Run counts and confidence per agent per day, for the analytics charts."""
    ctx = current_tenant()
    days = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}[range]
    since = datetime.now(timezone.utc) - timedelta(days=days)

    bucket = func.date_trunc("hour" if range == "24h" else "day", AgentExecution.created_at)
    stmt = (
        select(
            bucket.label("bucket"),
            AgentExecution.workspace,
            func.count().label("runs"),
            func.count(case((AgentExecution.status == "failed", 1))).label("failed"),
            func.avg(cast(AgentExecution.confidence, Float)).label("confidence"),
            func.sum(AgentExecution.tokens_in + AgentExecution.tokens_out).label("tokens"),
        )
        .where(
            AgentExecution.org_id == ctx.org_id,
            AgentExecution.deleted_at.is_(None),
            AgentExecution.created_at >= since,
        )
        .group_by(bucket, AgentExecution.workspace)
        .order_by(bucket)
    )

    series: dict[str, list[dict]] = {ws: [] for ws in WORKSPACES}
    for row in (await db.execute(stmt)).all():
        series.setdefault(row.workspace, []).append(
            {
                "t": row.bucket.isoformat(),
                "runs": row.runs,
                "failed": row.failed,
                "confidence": round(row.confidence, 3) if row.confidence is not None else None,
                "tokens": int(row.tokens or 0),
            }
        )

    # Capability leaderboard — which capabilities actually get used, and how
    # well they perform. This is the §21.4 AI-quality signal, not vanity stats.
    cap_stmt = (
        select(
            CapabilityInvocation.capability,
            CapabilityInvocation.workspace,
            func.count().label("invocations"),
            func.avg(cast(CapabilityInvocation.confidence, Float)).label("confidence"),
            func.avg(cast(CapabilityInvocation.duration_ms, Float)).label("avg_ms"),
            func.count(case((CapabilityInvocation.status == "failed", 1))).label("failures"),
        )
        .where(
            CapabilityInvocation.org_id == ctx.org_id,
            CapabilityInvocation.deleted_at.is_(None),
            CapabilityInvocation.created_at >= since,
        )
        .group_by(CapabilityInvocation.capability, CapabilityInvocation.workspace)
        .order_by(func.count().desc())
        .limit(25)
    )

    capabilities = [
        {
            "capability": r.capability,
            "workspace": r.workspace,
            "invocations": r.invocations,
            "confidence": round(r.confidence, 3) if r.confidence is not None else None,
            "avgDurationMs": round(r.avg_ms) if r.avg_ms else 0,
            "failures": r.failures,
            "failureRate": round(r.failures / r.invocations, 3) if r.invocations else 0.0,
        }
        for r in (await db.execute(cap_stmt)).all()
    ]

    return {"range": range, "series": series, "capabilities": capabilities}
