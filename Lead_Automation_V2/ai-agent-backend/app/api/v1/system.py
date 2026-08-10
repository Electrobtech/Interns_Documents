"""GET /ai-agents/status — Overview dashboard KPIs: agent health, knowledge
base size, recent runs, pending handoffs, provider health, and audit trail."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.database.tenant_scope import get_scoped_session
from app.llm.factory import get_llm_provider
from app.repositories.handoff_repo import HandoffRepository
from app.repositories.knowledge_repo import KnowledgeRepository
from app.repositories.marketing_repo import MarketingRepository
from app.repositories.provider_log_repo import ProviderLogRepository
from app.repositories.sales_repo import SalesRepository
from app.repositories.support_repo import SupportRepository

router = APIRouter()

_RANGE_TO_DAYS = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}


@router.get("/status")
async def status(
    range: str = Query(default="7d"),
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_scoped_session),
) -> dict:
    """Dashboard summary — single call returns everything the overview card
    needs: agents, knowledge base, run totals, handoffs, and provider health."""
    organization_id = uuid.UUID(user.organization_id)
    days = _RANGE_TO_DAYS.get(range, 7)
    org_str = str(organization_id)

    knowledge_repo = KnowledgeRepository(session)
    marketing_repo = MarketingRepository(session)
    sales_repo = SalesRepository(session)
    support_repo = SupportRepository(session)

    # Chunk counts per agent scope
    marketing_chunks = await knowledge_repo.chunk_count_for_org(organization_id, "marketing")
    sales_chunks = await knowledge_repo.chunk_count_for_org(organization_id, "sales")
    support_chunks = await knowledge_repo.chunk_count_for_org(organization_id, "support")

    # Recent runs (for activity feed)
    recent_marketing = await marketing_repo.recent_runs(organization_id, limit=5)
    recent_sales = await sales_repo.recent_runs(organization_id, limit=5)
    recent_support = await support_repo.recent_runs(organization_id, limit=5)

    # Run totals for the requested window
    run_totals = (await session.execute(
        text("""
            SELECT
              (SELECT COUNT(*) FROM marketing_agent_runs
                WHERE organization_id = :org AND created_at >= now() - (:days || ' days')::interval) AS marketing,
              (SELECT COUNT(*) FROM sales_agent_runs
                WHERE organization_id = :org AND created_at >= now() - (:days || ' days')::interval) AS sales,
              (SELECT COUNT(*) FROM support_agent_runs
                WHERE organization_id = :org AND created_at >= now() - (:days || ' days')::interval) AS support
        """),
        {"org": org_str, "days": str(days)},
    )).mappings().one()

    # Escalation count
    escalations = (await session.execute(
        text("""
            SELECT COUNT(*) FROM support_agent_runs
             WHERE organization_id = :org
               AND created_at >= now() - (:days || ' days')::interval
               AND (output->>'escalation_needed')::boolean IS TRUE
        """),
        {"org": org_str, "days": str(days)},
    )).scalar_one()

    # Pending handoffs
    pending_handoffs = await HandoffRepository(session).pending_count(organization_id)

    # Provider health + quick stats
    provider = get_llm_provider()
    llm_healthy = await provider.health_check()
    provider_stats = await ProviderLogRepository(session).stats(days=days, organization_id=organization_id)

    # Knowledge source counts
    all_sources = await knowledge_repo.list_sources(organization_id)
    sources_by_status: dict[str, int] = {}
    for s in all_sources:
        sources_by_status[s.status] = sources_by_status.get(s.status, 0) + 1

    # Recent audit trail (last 10 entries)
    audit_rows = (await session.execute(
        text("""
            SELECT action, user_id, meta, created_at
              FROM audit_logs
             WHERE organization_id = :org
             ORDER BY created_at DESC
             LIMIT 10
        """),
        {"org": org_str},
    )).mappings().all()
    audit_trail = [
        {
            "action": r["action"],
            "user_id": r["user_id"],
            "meta": r["meta"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in audit_rows
    ]

    return {
        "range": range,
        "agents": [
            {"type": "marketing", "status": "active", "chunk_count": marketing_chunks},
            {"type": "sales", "status": "active", "chunk_count": sales_chunks},
            {"type": "support", "status": "active", "chunk_count": support_chunks},
        ],
        "knowledge_base": {
            "total_chunks": marketing_chunks + sales_chunks + support_chunks,
            "total_sources": len(all_sources),
            "sources_by_status": sources_by_status,
        },
        "run_totals": {
            "marketing": int(run_totals["marketing"]),
            "sales": int(run_totals["sales"]),
            "support": int(run_totals["support"]),
            "all": int(run_totals["marketing"]) + int(run_totals["sales"]) + int(run_totals["support"]),
            "support_escalations": int(escalations),
        },
        "handoffs": {
            "pending": pending_handoffs,
        },
        "provider": {
            "healthy": llm_healthy,
            "stats_summary": provider_stats.get("by_provider", []),
        },
        "activity": {
            "recent_marketing_runs": len(recent_marketing),
            "recent_sales_runs": len(recent_sales),
            "recent_support_runs": len(recent_support),
        },
        "audit_trail": audit_trail,
    }
