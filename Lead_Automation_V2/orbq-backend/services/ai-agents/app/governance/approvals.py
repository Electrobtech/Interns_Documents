"""Approval engine — Phase 19.

The rule this enforces: a capability that produces a customer-visible side
effect cannot execute it. It emits a *proposed action*; this service gates it.

Everything here fails closed. If the state machine is unsure, the answer is no.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from orbq_core.tenancy import current_tenant

from ..models.governance import (
    AUTO_APPROVAL_DENYLIST,
    ApprovalEvent,
    ApprovalRequest,
    AuditLog,
)

log = structlog.get_logger()

DEFAULT_TTL_HOURS = 72

# Which role may decide which action. Approval authority is deliberately
# separate from execution permission — being able to run an agent is not the
# same as being able to authorize what it proposes.
ACTION_ROLE_REQUIREMENTS: dict[str, set[str]] = {
    "campaign.publish": {"admin", "manager"},
    "content.publish": {"admin", "manager"},
    "lead.handoff": {"admin", "manager"},
    "support.reply": {"admin", "manager", "agent"},
    "support.escalate": {"admin", "manager", "agent"},
}

# Maps an action type to the approvable it represents, for the UI.
ACTION_APPROVABLE_TYPE: dict[str, str] = {
    "campaign.publish": "campaign",
    "content.publish": "content",
    "lead.handoff": "lead",
    "support.reply": "support_reply",
    "support.escalate": "escalation",
}


class ApprovalService:
    def __init__(self, session: AsyncSession) -> None:
        self.db = session

    # -- creation ------------------------------------------------------------

    async def create_from_proposal(
        self,
        *,
        proposal: dict,
        workspace: str,
        execution_id: uuid.UUID,
        confidence: float | None,
        origin_service: str,
    ) -> ApprovalRequest:
        """Turn a capability's `proposed_action` into a gated request."""
        ctx = current_tenant()

        action_type = proposal.get("action_type")
        if not action_type:
            raise ValidationError("proposed_action is missing action_type")

        content = proposal.get("payload", {})
        request = ApprovalRequest(
            org_id=ctx.org_id,
            created_by=ctx.user_id,
            workspace=workspace,
            execution_id=execution_id,
            action_type=action_type,
            approvable_type=ACTION_APPROVABLE_TYPE.get(action_type, "generic"),
            content=content,
            content_hash=ApprovalRequest.hash_content(content),
            origin_service=origin_service,
            summary=proposal.get("summary", action_type)[:2000],
            status="pending",
            requested_by=ctx.user_id,
            confidence=confidence,
            reversible=bool(proposal.get("reversible", True)),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=DEFAULT_TTL_HOURS),
        )
        self.db.add(request)
        await self.db.flush()

        await self._record(request, None, "pending", comment="Proposed by agent")
        await self._audit("approval.requested", request)

        log.info(
            "approval_created",
            approval_id=str(request.id),
            action_type=action_type,
            workspace=workspace,
            confidence=confidence,
        )
        return request

    # -- decisions -----------------------------------------------------------

    async def decide(
        self,
        approval_id: uuid.UUID,
        *,
        decision: str,
        comment: str | None = None,
    ) -> ApprovalRequest:
        """Approve / reject / request changes.

        Three independent guards, because this is the control that stands
        between an AI proposal and a real customer:
          1. the state machine (illegal transitions refused)
          2. requester ≠ approver (also a DB constraint)
          3. role authority for this action type
        """
        ctx = current_tenant()
        request = await self._get(approval_id)

        target = {
            "approve": "approved",
            "reject": "rejected",
            "request_changes": "changes_requested",
        }.get(decision)
        if target is None:
            raise ValidationError(
                "decision must be one of: approve, reject, request_changes"
            )

        if request.is_terminal:
            raise ConflictError(
                f"Approval is already {request.status} and cannot be changed"
            )
        if not request.can_transition_to(target):
            raise ConflictError(f"Cannot go from {request.status} to {target}")

        if request.expires_at and request.expires_at < datetime.now(timezone.utc):
            await self._transition(request, "expired", comment="TTL elapsed")
            raise ConflictError("This approval request has expired")

        # Self-approval check in the application too, so the error is a clear
        # 403 rather than an opaque database constraint violation.
        if target == "approved" and request.requested_by == ctx.user_id:
            raise ForbiddenError(
                "You cannot approve a request you created. Approval requires a "
                "second person."
            )

        allowed_roles = ACTION_ROLE_REQUIREMENTS.get(request.action_type)
        if allowed_roles and ctx.role not in allowed_roles:
            raise ForbiddenError(
                f"Role '{ctx.role}' cannot approve '{request.action_type}'. "
                f"Requires one of: {', '.join(sorted(allowed_roles))}"
            )

        # Multi-level: approving at level n < N advances rather than completes.
        if target == "approved" and request.current_level < request.required_levels:
            request.current_level += 1
            await self._record(
                request, "pending", "pending", comment=f"Level {request.current_level - 1} approved"
            )
            await self.db.flush()
            return request

        before = request.status
        request.decided_by = ctx.user_id
        request.decided_at = datetime.now(timezone.utc)
        request.decision_comment = comment
        await self._transition(request, target, comment=comment)
        await self._audit(f"approval.{decision}", request, before=before)

        log.info(
            "approval_decided",
            approval_id=str(request.id),
            decision=decision,
            actor=str(ctx.user_id),
        )
        return request

    async def mark_executed(self, approval_id: uuid.UUID) -> ApprovalRequest:
        request = await self._get(approval_id)
        if request.status != "approved":
            raise ConflictError(
                f"Only an approved request can be executed (currently {request.status})"
            )
        await self._transition(request, "executed", comment="Side effect performed")
        await self._audit("approval.executed", request)
        return request

    async def rollback(self, approval_id: uuid.UUID, *, reason: str) -> ApprovalRequest:
        request = await self._get(approval_id)
        if not request.can_transition_to("rolled_back"):
            raise ConflictError(f"Cannot roll back from {request.status}")
        if not request.reversible:
            raise ConflictError(
                "This action was recorded as irreversible; it cannot be rolled "
                "back automatically. Handle it manually and record the outcome."
            )
        await self._transition(request, "rolled_back", comment=reason)
        await self._audit("approval.rolled_back", request, reason=reason)
        return request

    # -- auto-approval (§24.1) ----------------------------------------------

    def can_auto_approve(self, action_type: str, confidence: float | None) -> bool:
        """Deliberately conservative.

        High-risk actions can never auto-approve however confident the model
        claims to be — a confidence score is a convenience for low-risk drafts,
        never a substitute for authorization on something irreversible.
        """
        if action_type in AUTO_APPROVAL_DENYLIST:
            return False
        if confidence is None:
            return False
        return confidence >= 0.9

    # -- queries -------------------------------------------------------------

    async def list_pending(
        self, *, workspace: str | None = None, limit: int = 50
    ) -> list[ApprovalRequest]:
        ctx = current_tenant()
        stmt = (
            select(ApprovalRequest)
            .where(
                ApprovalRequest.org_id == ctx.org_id,
                ApprovalRequest.deleted_at.is_(None),
                ApprovalRequest.status.in_(("pending", "changes_requested", "escalated")),
            )
            .order_by(ApprovalRequest.created_at.desc())
            .limit(limit)
        )
        if workspace:
            stmt = stmt.where(ApprovalRequest.workspace == workspace)
        return list((await self.db.execute(stmt)).scalars().all())

    async def expire_stale(self) -> int:
        """Sweeper. TTL is also checked on decide(), so an expired request can
        never be approved just because this job is behind."""
        ctx = current_tenant()
        now = datetime.now(timezone.utc)
        stale = (
            await self.db.execute(
                select(ApprovalRequest).where(
                    ApprovalRequest.org_id == ctx.org_id,
                    ApprovalRequest.status.in_(("pending", "changes_requested", "escalated")),
                    ApprovalRequest.expires_at < now,
                )
            )
        ).scalars().all()
        for request in stale:
            await self._transition(request, "expired", comment="TTL elapsed")
        return len(stale)

    # -- internals -----------------------------------------------------------

    async def _get(self, approval_id: uuid.UUID) -> ApprovalRequest:
        ctx = current_tenant()
        request = (
            await self.db.execute(
                select(ApprovalRequest).where(
                    ApprovalRequest.id == approval_id,
                    ApprovalRequest.org_id == ctx.org_id,
                    ApprovalRequest.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if request is None:
            raise NotFoundError(f"Approval {approval_id} not found")
        return request

    async def _transition(
        self, request: ApprovalRequest, to_status: str, *, comment: str | None
    ) -> None:
        from_status = request.status
        request.status = to_status
        await self._record(request, from_status, to_status, comment=comment)
        await self.db.flush()

    async def _record(
        self, request: ApprovalRequest, from_status: str | None, to_status: str, *, comment: str | None
    ) -> None:
        ctx = current_tenant()
        self.db.add(
            ApprovalEvent(
                org_id=ctx.org_id,
                approval_id=request.id,
                from_status=from_status,
                to_status=to_status,
                actor_id=ctx.user_id,
                level=request.current_level,
                comment=comment,
            )
        )

    async def _audit(
        self, action: str, request: ApprovalRequest, *, before: str | None = None, reason: str | None = None
    ) -> None:
        ctx = current_tenant()
        self.db.add(
            AuditLog(
                org_id=ctx.org_id,
                actor_id=ctx.user_id,
                actor_type="user",
                action=action,
                resource_type="approval_request",
                resource_id=request.id,
                before={"status": before} if before else None,
                after={"status": request.status},
                reason=reason,
            )
        )
