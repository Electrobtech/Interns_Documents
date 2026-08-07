"""GET /ai-agents/analytics — real run counts per agent per day, handoff
counts, human_handoff breakdown, and provider usage breakdown.
All metrics come directly from DB tables — no fabricated numbers."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.database.session import get_session
from app.repositories.provider_log_repo import ProviderLogRepository

router = APIRouter()

_RANGE_TO_DAYS = {"24h": 1, "7d": 7, "30d": 30, "90d": 90, "all": 36_500}


@router.get("/analytics")
async def analytics(
    range: str = Query(default="7d"),
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Full analytics payload:
    - run totals + daily series per agent type
    - human_handoff counts per agent
    - support escalation count
    - handoff request status breakdown
    - provider usage breakdown (from provider_usage_logs)
    """
    days = _RANGE_TO_DAYS.get(range, 7)
    org = str(uuid.UUID(user.organization_id))
    org_id = uuid.UUID(user.organization_id)

    # ----- Daily run series -----
    rows = (await session.execute(
        text("""
            SELECT agent_type, day::date::text AS date, count
              FROM (
                SELECT 'marketing' AS agent_type, date_trunc('day', created_at) AS day, COUNT(*) AS count
                  FROM marketing_agent_runs
                 WHERE organization_id = :org AND created_at >= now() - (:days || ' days')::interval
                 GROUP BY 2
                UNION ALL
                SELECT 'sales', date_trunc('day', created_at), COUNT(*)
                  FROM sales_agent_runs
                 WHERE organization_id = :org AND created_at >= now() - (:days || ' days')::interval
                 GROUP BY 2
                UNION ALL
                SELECT 'support', date_trunc('day', created_at), COUNT(*)
                  FROM support_agent_runs
                 WHERE organization_id = :org AND created_at >= now() - (:days || ' days')::interval
                 GROUP BY 2
              ) t
             ORDER BY day
        """),
        {"org": org, "days": str(days)},
    )).mappings().all()

    totals: dict[str, int] = {"marketing": 0, "sales": 0, "support": 0}
    series: list[dict] = []
    for r in rows:
        totals[r["agent_type"]] = totals.get(r["agent_type"], 0) + int(r["count"])
        series.append({"agentType": r["agent_type"], "date": r["date"], "count": int(r["count"])})

    # ----- Escalations -----
    escalations = (await session.execute(
        text("""
            SELECT COUNT(*) FROM support_agent_runs
             WHERE organization_id = :org
               AND created_at >= now() - (:days || ' days')::interval
               AND (output->>'escalation_needed')::boolean IS TRUE
        """),
        {"org": org, "days": str(days)},
    )).scalar_one()

    # ----- Human handoff counts per agent -----
    handoff_rows = (await session.execute(
        text("""
            SELECT 'marketing' AS agent_type,
                   SUM(CASE WHEN (output->>'human_handoff')::boolean IS TRUE THEN 1 ELSE 0 END) AS handoff_count
              FROM marketing_agent_runs
             WHERE organization_id = :org AND created_at >= now() - (:days || ' days')::interval
            UNION ALL
            SELECT 'sales',
                   SUM(CASE WHEN (output->>'human_handoff')::boolean IS TRUE THEN 1 ELSE 0 END)
              FROM sales_agent_runs
             WHERE organization_id = :org AND created_at >= now() - (:days || ' days')::interval
            UNION ALL
            SELECT 'support',
                   SUM(CASE WHEN (output->>'human_handoff')::boolean IS TRUE THEN 1 ELSE 0 END)
              FROM support_agent_runs
             WHERE organization_id = :org AND created_at >= now() - (:days || ' days')::interval
        """),
        {"org": org, "days": str(days)},
    )).mappings().all()

    human_handoff_counts = {r["agent_type"]: int(r["handoff_count"] or 0) for r in handoff_rows}

    # ----- Handoff request status breakdown -----
    handoff_status_rows = (await session.execute(
        text("""
            SELECT status, COUNT(*) AS cnt
              FROM handoff_requests
             WHERE organization_id = :org
               AND created_at >= now() - (:days || ' days')::interval
             GROUP BY status
        """),
        {"org": org, "days": str(days)},
    )).mappings().all()

    handoff_by_status = {r["status"]: int(r["cnt"]) for r in handoff_status_rows}

    # ----- Provider usage breakdown -----
    provider_stats = await ProviderLogRepository(session).stats(days=days, organization_id=org_id)

    return {
        "range": range,
        "totals": {
            **totals,
            "allRuns": sum(totals.values()),
            "supportEscalations": int(escalations),
        },
        "series": series,
        "humanHandoffCounts": human_handoff_counts,
        "handoffRequests": {
            "byStatus": handoff_by_status,
            "total": sum(handoff_by_status.values()),
        },
        "providerUsage": {
            "byProvider": provider_stats.get("by_provider", []),
            "byAgent": provider_stats.get("by_agent", []),
        },
    }
