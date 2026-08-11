"""Sales Agent's finance tools: POST /ai-agents/sales/finance/propose parses
a natural-language command into a structured, unsaved proposal;
POST /ai-agents/sales/finance/confirm is the only endpoint that actually
writes to finance-service, and only after a human has reviewed the
proposal (mirrors marketing_planner.py's campaign-plan -> convert-item
two-step, and app/agents/sales_agent.py's "never take direct action,
only propose for a human to review" rule).

GET /ai-agents/sales/finance/summary is read-only and does NOT need the
propose/confirm gate — same reasoning service_client.py's other
best-effort GET fetches (get_contacts, get_leads, ...) already use.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.tenant_scope import get_scoped_session
from app.schemas.finance import (
    FinanceConfirmIn,
    FinanceProposeIn,
    FinanceProposeOut,
    FinanceSummaryOut,
)
from app.services import service_client
from app.services.audit_service import log_audit
from app.services.finance_command_parser import parse_finance_command

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/sales/finance/propose", response_model=FinanceProposeOut)
async def propose_finance_action(
    body: FinanceProposeIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_scoped_session),
) -> FinanceProposeOut:
    """Parses only — writes nothing. The frontend shows this back to the
    user (amount, category, a low-confidence warning if any) for one-tap
    confirm or edit-then-confirm before POST .../confirm is ever called."""
    organization_id = uuid.UUID(user.organization_id)
    proposal = parse_finance_command(body.text)
    await log_audit(session, organization_id, user.user_id, "ai_agents.sales.finance_propose", {"text": body.text[:200], "action": proposal.action})
    await session.commit()
    return FinanceProposeOut(**proposal.__dict__)


@router.post("/sales/finance/confirm")
async def confirm_finance_action(
    body: FinanceConfirmIn,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_scoped_session),
) -> dict:
    """Commits the (possibly human-edited) proposal to finance-service.
    This is the only route in the finance-agent flow that writes."""
    if body.action != "record_expense":
        raise HTTPException(status_code=400, detail="Only 'record_expense' can be confirmed here — course invoices are generated from the Invoices & Revenue tab's form (needs a validated student state for place-of-supply).")

    organization_id = uuid.UUID(user.organization_id)
    try:
        result = await service_client.record_expense(
            organization_id,
            category=body.category,
            amount=body.amount,
            description=body.description,
            payment_method=body.payment_method,
            reference_id=body.reference_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"finance-service call failed: {exc}") from exc

    await log_audit(session, organization_id, user.user_id, "ai_agents.sales.finance_confirm", {"category": body.category, "amount": body.amount})
    await session.commit()
    return result


@router.get("/sales/finance/summary", response_model=FinanceSummaryOut | None)
async def get_sales_finance_summary(
    user: AuthUser = Depends(_can_manage),
) -> dict | None:
    organization_id = uuid.UUID(user.organization_id)
    return await service_client.get_financial_summary(organization_id)
