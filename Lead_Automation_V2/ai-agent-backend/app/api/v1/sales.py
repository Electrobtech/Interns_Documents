"""POST /ai-agents/sales/run — Sales Agent, grounded via RAG."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser, get_current_user
from app.database.session import get_session
from app.ml.lead_scoring_model import predict_fit_score
from app.repositories.sales_repo import SalesRepository
from app.schemas.sales import (
    DraftFollowupIn,
    DraftFollowupOut,
    FitScoreIn,
    FitScoreOut,
    SalesAgentConfigIn,
    SalesAgentConfigOut,
    SalesAnalyticsOut,
    SalesExportOut,
    SalesForecastOut,
    SalesQueueOut,
    SalesRunIn,
    SalesRunOut,
    SalesRunSummary,
)
from app.services.audit_service import log_audit
from app.services.sales_service import SalesService

router = APIRouter()


@router.post("/sales/run", response_model=SalesRunOut)
async def run_sales_agent(
    body: SalesRunIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SalesRunOut:
    organization_id = uuid.UUID(user.organization_id)
    result = await SalesService(session).run(organization_id, body)
    await log_audit(session, organization_id, user.user_id, "ai_agents.sales.run", {"brief": body.brief[:200]})
    await session.commit()
    return result


@router.get("/sales/runs", response_model=list[SalesRunSummary])
async def list_sales_runs(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SalesRunSummary]:
    organization_id = uuid.UUID(user.organization_id)
    runs = await SalesRepository(session).recent_runs(organization_id)
    return [SalesRunSummary.model_validate(r) for r in runs]


# ── Lead fit scoring ────────────────────────────────────────────────────────
# Backed by a random forest (app/ml/lead_scoring_model.py) rather than an LLM
# call: the Fit Scorer panel re-scores on every pill change, so this has to be
# instant (model inference on 3 categorical inputs is sub-millisecond) and
# deterministic for the same inputs — an LLM call would be neither. The
# narrative Sales Agent (/sales/run) is the hybrid surface: it takes this same
# forest's score and has the LLM build the free-text reasoning around it.


@router.post("/sales/fit-score", response_model=FitScoreOut)
async def score_lead_fit(
    body: FitScoreIn,
    user: AuthUser = Depends(get_current_user),
) -> FitScoreOut:
    """Scores a lead against the ICP from structured attributes using the
    random forest lead scoring model.
    """
    result = predict_fit_score(body.org_size, body.budget, body.channel)
    # No audit row: this writes nothing and is a pure function of its inputs.
    return FitScoreOut(
        score=result["score"],
        tier=result["tier"],
        tier_reason=result["tier_reason"],
        factors=result["factors"],
        recommended_action=result["recommended_action"],
    )


# ── Config: deal-value field mapping + confidence signal weights ────────────
# Backs the "Set Up Deal Values" / "Wire Confidence Signal" CTAs that
# replaced the Overview tab's permanent placeholder text.

@router.get("/sales/config", response_model=SalesAgentConfigOut)
async def get_sales_config(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SalesAgentConfigOut:
    organization_id = uuid.UUID(user.organization_id)
    return await SalesService(session).get_config(organization_id)


@router.patch("/sales/config", response_model=SalesAgentConfigOut)
async def update_sales_config(
    body: SalesAgentConfigIn,
    user: AuthUser = Depends(require_permission("ai_agents:manage")),
    session: AsyncSession = Depends(get_session),
) -> SalesAgentConfigOut:
    organization_id = uuid.UUID(user.organization_id)
    # `exclude_unset` so a PATCH that only sends one field doesn't clear the
    # other back to a default — see SalesConfigRepository.upsert's Ellipsis
    # sentinel for why `...` (not sent) and `None`/[] (explicitly cleared)
    # must stay distinguishable.
    sent = body.model_dump(exclude_unset=True)
    result = await SalesService(session).update_config(
        organization_id,
        deal_value_field=sent.get("deal_value_field", ...),
        confidence_signals=body.confidence_signals if "confidence_signals" in sent else ...,
        min_hot_score=sent.get("min_hot_score", ...),
        max_followup_attempts=sent.get("max_followup_attempts", ...),
        require_approval=sent.get("require_approval", ...),
        followup_cadence_days=body.followup_cadence_days if "followup_cadence_days" in sent else ...,
        monthly_revenue_target=sent.get("monthly_revenue_target", ...),
    )
    await log_audit(
        session, organization_id, user.user_id, "ai_agents.sales.config_update",
        {"deal_value_field": body.deal_value_field, "confidence_signals_set": body.confidence_signals is not None,
         "settings_fields_set": [k for k in sent if k not in ("deal_value_field", "confidence_signals")]},
    )
    await session.commit()
    return result


@router.get("/sales/queue", response_model=SalesQueueOut)
async def get_sales_queue(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SalesQueueOut:
    """Real queued work (overdue/today follow-ups + pending handoffs) —
    backs the header badge and its click-to-expand drawer, replacing the
    hardcoded 'Running · 12 tasks queued' text."""
    organization_id = uuid.UUID(user.organization_id)
    return await SalesService(session).get_queue(organization_id)


@router.get("/sales/export", response_model=SalesExportOut)
async def export_sales_data(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SalesExportOut:
    """Export payload for the header's Export button. Returns JSON; the
    frontend renders it as a downloadable .json or .csv client-side."""
    organization_id = uuid.UUID(user.organization_id)
    result = await SalesService(session).get_export(organization_id)
    await log_audit(session, organization_id, user.user_id, "ai_agents.sales.export", {"lead_count": len(result.leads)})
    await session.commit()
    return result


# ── Forecasting & Analytics tabs ─────────────────────────────────────────────
# Both read-only, both computed live from real leads (contact-service) +
# this org's own config/runs — no writes, so no audit row, same as
# /sales/fit-score above.

@router.get("/sales/forecast", response_model=SalesForecastOut)
async def get_sales_forecast(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SalesForecastOut:
    """Pipeline value by stage, a heuristically weighted quarterly
    prediction, a real monthly-revenue trend, and target-vs-actual gap
    analysis against this org's configured monthly revenue target."""
    organization_id = uuid.UUID(user.organization_id)
    return await SalesService(session).get_forecast(organization_id)


@router.get("/sales/analytics", response_model=SalesAnalyticsOut)
async def get_sales_analytics(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SalesAnalyticsOut:
    """MTD closed deals, avg deal size, sales-cycle length, and agent
    productivity — all derived from real leads + sales_agent_runs, not
    hardcoded chart data."""
    organization_id = uuid.UUID(user.organization_id)
    return await SalesService(session).get_analytics(organization_id)


# ── Follow-up draft generation (Follow-ups tab) ──────────────────────────────

@router.post("/sales/draft-followup", response_model=DraftFollowupOut)
async def draft_followup(
    body: DraftFollowupIn,
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DraftFollowupOut:
    """Generates email/WhatsApp/call-script drafts for one lead, grounded in
    the org's sales knowledge base. Read-only — this never sends anything;
    the frontend's Approve & Send button calls the existing
    POST /conversations/:id/reply once a human signs off."""
    organization_id = uuid.UUID(user.organization_id)
    result = await SalesService(session).draft_followup(organization_id, body)
    await log_audit(session, organization_id, user.user_id, "ai_agents.sales.draft_followup", {
        "lead_id": body.lead_id, "lead_name": result.lead_name, "channel": body.channel,
    })
    await session.commit()
    return result
