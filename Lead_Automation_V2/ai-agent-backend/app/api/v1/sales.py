"""POST /ai-agents/sales/run — Sales Agent, grounded via RAG."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.database.session import get_session
from app.repositories.sales_repo import SalesRepository
from app.schemas.sales import FitScoreIn, FitScoreOut, SalesRunIn, SalesRunOut, SalesRunSummary
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
# Weights sum to 100 so the returned score reads directly as a percentage.
# Company size and budget dominate because they gate whether a deal is winnable
# at all; channel is a smaller signal about intent and reachability.
_ORG_SIZE_POINTS = {"small": 15, "medium": 30, "enterprise": 40}
_BUDGET_POINTS = {"low": 10, "medium": 25, "high": 40}
_CHANNEL_POINTS = {"email": 10, "whatsapp": 20, "linkedin": 20}

_ORG_SIZE_LABEL = {"small": "1-50 employees", "medium": "50-500 employees", "enterprise": "500+ employees"}
_BUDGET_LABEL = {"low": "under $5k", "medium": "$5k-$20k", "high": "$20k+"}


@router.post("/sales/fit-score", response_model=FitScoreOut)
async def score_lead_fit(
    body: FitScoreIn,
    user: AuthUser = Depends(get_current_user),
) -> FitScoreOut:
    """Scores a lead against the ICP from structured attributes.

    Deliberately rule-based rather than an LLM call: the Fit Scorer panel
    re-scores on every pill change, so this must be instant and give the same
    answer for the same inputs. The narrative Sales Agent (/sales/run) stays
    the place for free-text reasoning.
    """
    org = (body.org_size or "").lower()
    budget = (body.budget or "").lower()
    channel = (body.channel or "").lower()

    org_pts = _ORG_SIZE_POINTS.get(org, 0)
    budget_pts = _BUDGET_POINTS.get(budget, 0)
    channel_pts = _CHANNEL_POINTS.get(channel, 0)
    score = org_pts + budget_pts + channel_pts

    factors = [
        {"label": "Company size", "value": _ORG_SIZE_LABEL.get(org, "unknown"), "points": org_pts, "max": 40},
        {"label": "Budget", "value": _BUDGET_LABEL.get(budget, "unknown"), "points": budget_pts, "max": 40},
        {"label": "Channel", "value": channel or "unknown", "points": channel_pts, "max": 20},
    ]

    if score >= 75:
        tier = "hot"
        reason = "Strong budget and company size — this fits the ICP squarely."
        action = "Route to a senior rep today and offer a same-week demo slot."
    elif score >= 45:
        tier = "warm"
        reason = "A real opportunity, but one of budget or company size is limiting."
        action = "Qualify the weaker signal before booking a demo — confirm budget owner and timeline."
    else:
        tier = "cold"
        reason = "Below the ICP threshold on both budget and company size."
        action = "Keep on a nurture sequence; revisit if budget or headcount changes."

    # No audit row: this writes nothing and is a pure function of its inputs.
    return FitScoreOut(
        score=score, tier=tier, tier_reason=reason, factors=factors, recommended_action=action,
    )
