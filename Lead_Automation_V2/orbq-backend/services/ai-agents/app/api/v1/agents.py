"""THE THREE PUBLIC AGENT ENDPOINTS.

Nothing else ships in this module. Every specialized capability (SEO, AEO,
persona, lead scoring, ticket classification, …) is reachable only through these
three, dispatched by the orchestrator.

`tests/test_public_surface.py` asserts the mounted route table equals an explicit
allowlist, so widening this surface requires editing that list in the same
commit — visible in review rather than accidental (§9.3).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_contracts.agent import AgentRequest, AgentResponse, Workspace
from orbq_core.db.session import get_session
from orbq_core.security import PERM_AI_USE
from orbq_core.tenancy import TenantContext, current_tenant

from ...deps import get_orchestrator
from ...models.agent import AgentExecution, AgentSession
from ...orchestration.orchestrator import Orchestrator

router = APIRouter(tags=["agents"])


async def _run(
    workspace: Workspace,
    request: AgentRequest,
    orchestrator: Orchestrator,
    ctx: TenantContext,
) -> AgentResponse:
    ctx.require_permission(PERM_AI_USE)
    return await orchestrator.execute(workspace, request)


@router.post("/agents/marketing", response_model=AgentResponse)
async def run_marketing_agent(
    request: AgentRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
) -> AgentResponse:
    """Marketing Agent. Internally may invoke campaign planning, SEO, AEO,
    persona, competitor intelligence, content generation, CTWA, and more."""
    return await _run(Workspace.MARKETING, request, orchestrator, current_tenant())


@router.post("/agents/sales", response_model=AgentResponse)
async def run_sales_agent(
    request: AgentRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
) -> AgentResponse:
    """Sales Agent. Internally may invoke lead scoring, buying intent, CRM
    analysis, forecasting, pipeline analysis, and handoff."""
    return await _run(Workspace.SALES, request, orchestrator, current_tenant())


@router.post("/agents/support", response_model=AgentResponse)
async def run_support_agent(
    request: AgentRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
) -> AgentResponse:
    """Support Agent. Internally may invoke ticket classification, suggested
    replies, CSAT risk, escalation, and SLA monitoring."""
    return await _run(Workspace.SUPPORT, request, orchestrator, current_tenant())


# ---------------------------------------------------------------------------
# Session + explainability reads. Not capability endpoints — these expose
# already-computed state that the UI needs (§9.1).
# ---------------------------------------------------------------------------

router_sessions = APIRouter(tags=["sessions"])


@router_sessions.get("/sessions")
async def list_sessions(
    workspace: str | None = Query(default=None),
    limit: int = Query(default=25, le=100),
    db: AsyncSession = Depends(get_session),
) -> list[dict]:
    ctx = current_tenant()
    stmt = (
        select(AgentSession)
        .where(AgentSession.org_id == ctx.org_id, AgentSession.deleted_at.is_(None))
        .order_by(desc(AgentSession.last_activity_at))
        .limit(limit)
    )
    if workspace:
        stmt = stmt.where(AgentSession.workspace == workspace)

    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": str(s.id),
            "workspace": s.workspace,
            "title": s.title,
            "status": s.status,
            "turn_count": s.turn_count,
            "last_activity_at": s.last_activity_at.isoformat() if s.last_activity_at else None,
            "created_at": s.created_at.isoformat(),
        }
        for s in rows
    ]


@router_sessions.get("/sessions/{session_id}/executions")
async def list_session_executions(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
) -> list[dict]:
    """The explainability drill-down (§15).

    Returns the full decision trace: what it concluded, why, how sure, what it
    read, what else it considered, and which inputs were degraded.
    """
    ctx = current_tenant()
    stmt = (
        select(AgentExecution)
        .where(
            AgentExecution.org_id == ctx.org_id,
            AgentExecution.session_id == session_id,
            AgentExecution.deleted_at.is_(None),
        )
        .order_by(AgentExecution.created_at)
    )
    executions = (await db.execute(stmt)).scalars().all()

    return [
        {
            "id": str(e.id),
            "workspace": e.workspace,
            "status": e.status,
            "request_message": e.request_message,
            "output": e.output,
            "explanation": {
                "summary": e.summary,
                "reasoning": e.reasoning,
                "confidence": e.confidence,
                "capabilities_used": e.capabilities_used,
                "knowledge_used": e.knowledge_used,
                "alternatives": e.alternatives,
                "degraded_inputs": e.degraded_inputs,
                "business_impact": e.business_impact,
            },
            "usage": {
                "tokens_in": e.tokens_in,
                "tokens_out": e.tokens_out,
                "credits": e.credits,
                "duration_ms": e.duration_ms,
                "llm_calls": e.llm_calls,
            },
            "capabilities": [
                {
                    "capability": inv.capability,
                    "stage": inv.stage,
                    "status": inv.status,
                    "confidence": inv.confidence,
                    "duration_ms": inv.duration_ms,
                    "model": inv.model,
                    "prompt_version": inv.prompt_version,
                    "reasoning": inv.reasoning,
                    "error": inv.error_detail,
                }
                for inv in sorted(e.invocations, key=lambda i: (i.stage, i.created_at))
            ],
            "error_detail": e.error_detail,
            "created_at": e.created_at.isoformat(),
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
        }
        for e in executions
    ]
