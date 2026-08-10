"""Approvals API — Phase 19.

Backs the Approve / Reject buttons in every workspace. These endpoints are the
only path from an AI proposal to a real customer-visible action.
"""
from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.tenancy import current_tenant

from ...governance.approvals import ApprovalService
from ...models.governance import ApprovalRequest

router = APIRouter(tags=["approvals"])


def get_approvals(db: AsyncSession = Depends(get_session)) -> ApprovalService:
    return ApprovalService(db)


class DecisionBody(BaseModel):
    decision: Literal["approve", "reject", "request_changes"]
    comment: str | None = Field(default=None, max_length=2000)


def _serialize(a: ApprovalRequest, *, include_content: bool = False) -> dict:
    ctx = current_tenant()
    payload = {
        "id": str(a.id),
        "workspace": a.workspace,
        "action_type": a.action_type,
        "approvable_type": a.approvable_type,
        "summary": a.summary,
        "status": a.status,
        "confidence": a.confidence,
        "reversible": a.reversible,
        "version": a.version,
        "current_level": a.current_level,
        "required_levels": a.required_levels,
        "requested_by": str(a.requested_by),
        "assigned_to": str(a.assigned_to) if a.assigned_to else None,
        "decided_by": str(a.decided_by) if a.decided_by else None,
        "decision_comment": a.decision_comment,
        "execution_id": str(a.execution_id) if a.execution_id else None,
        "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        "created_at": a.created_at.isoformat(),
        # Lets the UI disable the button instead of letting the user click and
        # then get a 403 — self-approval is blocked at three layers.
        "can_current_user_approve": a.requested_by != ctx.user_id,
    }
    if include_content:
        payload["content"] = a.content
        payload["events"] = [
            {
                "from": e.from_status,
                "to": e.to_status,
                "actor": str(e.actor_id) if e.actor_id else None,
                "comment": e.comment,
                "at": e.created_at.isoformat(),
            }
            for e in sorted(a.events, key=lambda x: x.created_at)
        ]
    return payload


@router.get("/ai-agents/approvals")
async def list_approvals(
    workspace: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Pending approval queue. Backs the 'Pending Approvals' panel."""
    ctx = current_tenant()
    stmt = (
        select(ApprovalRequest)
        .where(
            ApprovalRequest.org_id == ctx.org_id,
            ApprovalRequest.deleted_at.is_(None),
        )
        .order_by(ApprovalRequest.created_at.desc())
        .limit(limit)
    )
    if workspace:
        stmt = stmt.where(ApprovalRequest.workspace == workspace)
    if status_filter:
        stmt = stmt.where(ApprovalRequest.status == status_filter)
    else:
        stmt = stmt.where(
            ApprovalRequest.status.in_(("pending", "changes_requested", "escalated"))
        )

    rows = (await db.execute(stmt)).scalars().all()
    return [_serialize(a) for a in rows]


@router.get("/ai-agents/approvals/{approval_id}")
async def get_approval(
    approval_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Full detail including the proposed content and transition history."""
    ctx = current_tenant()
    a = (
        await db.execute(
            select(ApprovalRequest).where(
                ApprovalRequest.id == approval_id,
                ApprovalRequest.org_id == ctx.org_id,
                ApprovalRequest.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if a is None:
        from orbq_core.errors import NotFoundError

        raise NotFoundError(f"Approval {approval_id} not found")
    return _serialize(a, include_content=True)


@router.post("/ai-agents/approvals/{approval_id}/decide")
async def decide_approval(
    approval_id: uuid.UUID,
    body: DecisionBody,
    service: Annotated[ApprovalService, Depends(get_approvals)],
) -> dict:
    """Approve, reject, or request changes.

    Guarded by the state machine, the requester≠approver rule, and role
    authority for the action type. All three fail closed.
    """
    request = await service.decide(
        approval_id, decision=body.decision, comment=body.comment
    )
    return _serialize(request, include_content=True)


@router.post("/ai-agents/approvals/{approval_id}/rollback")
async def rollback_approval(
    approval_id: uuid.UUID,
    body: DecisionBody | None = None,
    service: Annotated[ApprovalService, Depends(get_approvals)] = None,  # type: ignore[assignment]
) -> dict:
    reason = (body.comment if body else None) or "Rolled back by operator"
    request = await service.rollback(approval_id, reason=reason)
    return _serialize(request, include_content=True)


@router.get("/ai-agents/approvals/stats/summary")
async def approval_stats(db: AsyncSession = Depends(get_session)) -> dict:
    """Approval analytics.

    Rejection rate is the single strongest AI-quality signal available (§21.4):
    humans rejecting proposals means the agent is producing work they don't
    trust, which no latency or uptime metric would reveal.
    """
    from sqlalchemy import case, func

    ctx = current_tenant()
    row = (
        await db.execute(
            select(
                func.count().label("total"),
                func.count(case((ApprovalRequest.status == "pending", 1))).label("pending"),
                func.count(case((ApprovalRequest.status == "approved", 1))).label("approved"),
                func.count(case((ApprovalRequest.status == "rejected", 1))).label("rejected"),
                func.count(case((ApprovalRequest.status == "expired", 1))).label("expired"),
                func.avg(ApprovalRequest.confidence).label("avg_confidence"),
            ).where(
                ApprovalRequest.org_id == ctx.org_id,
                ApprovalRequest.deleted_at.is_(None),
            )
        )
    ).one()

    decided = (row.approved or 0) + (row.rejected or 0)
    return {
        "total": row.total or 0,
        "pending": row.pending or 0,
        "approved": row.approved or 0,
        "rejected": row.rejected or 0,
        "expired": row.expired or 0,
        "approval_rate": round(row.approved / decided, 3) if decided else None,
        "rejection_rate": round(row.rejected / decided, 3) if decided else None,
        "avg_confidence": round(row.avg_confidence, 3) if row.avg_confidence else None,
    }
