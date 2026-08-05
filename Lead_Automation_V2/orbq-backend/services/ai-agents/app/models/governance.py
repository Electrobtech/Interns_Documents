"""Approvals + audit — Phase 19 (§24.1).

The polymorphic-approvable design matters: governance stores a
content-addressed *snapshot* of whatever is being approved and never
dereferences the id into another service's schema. Adding a twelfth approvable
type is an enum value, not a migration.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from orbq_core.db.base import OrbqTable

# The approval state machine (§24.1).
APPROVAL_STATUSES = (
    "draft", "pending", "changes_requested", "approved",
    "rejected", "escalated", "expired", "executed", "rolled_back",
)

# Legal transitions. Anything not listed is rejected by the service, so an
# invalid state change is impossible rather than merely discouraged.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"pending"},
    "pending": {"approved", "rejected", "changes_requested", "escalated", "expired"},
    "changes_requested": {"pending", "rejected", "expired"},
    "escalated": {"pending", "approved", "rejected", "expired"},
    "approved": {"executed", "rolled_back"},
    "executed": {"rolled_back"},
    "rejected": set(),   # terminal
    "expired": set(),    # terminal
    "rolled_back": set(),
}

# Action types that may NEVER be auto-approved by a confidence rule, regardless
# of org configuration. An auto-approval rule with a badly calibrated confidence
# score is exactly how "the AI sent 4,000 wrong messages" happens.
AUTO_APPROVAL_DENYLIST = frozenset({
    "campaign.publish",
    "content.publish",
    "support.reply",
    "lead.handoff",
})


class ApprovalRequest(OrbqTable):
    __tablename__ = "approval_requests"

    workspace: Mapped[str] = mapped_column(String(16), nullable=False)
    execution_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    approvable_type: Mapped[str] = mapped_column(String(40), nullable=False)
    approvable_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    origin_service: Mapped[str] = mapped_column(String(40), nullable=False)

    summary: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")

    current_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    required_levels: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    requested_by: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    decided_by: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_comment: Mapped[str | None] = mapped_column(Text)

    confidence: Mapped[float | None] = mapped_column(Float)
    auto_approved_by_rule: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    reversible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    events: Mapped[list["ApprovalEvent"]] = relationship(
        back_populates="approval", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        CheckConstraint(f"status IN {APPROVAL_STATUSES}", name="approval_requests_status_valid"),
        # Requester ≠ approver, enforced by the DATABASE (§12.3). An agent
        # service with a bug or a stolen token still cannot self-approve.
        CheckConstraint(
            "decided_by IS NULL OR decided_by <> requested_by",
            name="approval_requests_no_self_approval",
        ),
        Index("ix_approval_requests_org_status", "org_id", "status", "created_at"),
        Index("ix_approval_requests_org_assignee", "org_id", "assigned_to", "status"),
    )

    @staticmethod
    def hash_content(content: dict) -> str:
        """Content addressing — makes version diffing and dedup generic across
        every approvable type."""
        return hashlib.sha256(
            json.dumps(content, sort_keys=True, separators=(",", ":"), default=str).encode()
        ).hexdigest()

    @property
    def is_terminal(self) -> bool:
        return self.status in {"rejected", "expired", "rolled_back"}

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in ALLOWED_TRANSITIONS.get(self.status, set())


class ApprovalEvent(OrbqTable):
    """Append-only transition history. Every decision is auditable."""

    __tablename__ = "approval_events"

    approval_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("approval_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_status: Mapped[str | None] = mapped_column(String(24))
    to_status: Mapped[str] = mapped_column(String(24), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    comment: Mapped[str | None] = mapped_column(Text)

    approval: Mapped[ApprovalRequest] = relationship(back_populates="events")

    __table_args__ = (Index("ix_approval_events_approval", "approval_id", "created_at"),)


class AuditLog(OrbqTable):
    """Append-only. No application-level UPDATE or DELETE grant (§18.5)."""

    __tablename__ = "audit_logs"

    actor_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False, default="user")
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(40), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    before: Mapped[dict | None] = mapped_column(JSONB)
    after: Mapped[dict | None] = mapped_column(JSONB)
    reason: Mapped[str | None] = mapped_column(Text)
    trace_id: Mapped[str | None] = mapped_column(String(64))

    __table_args__ = (
        Index("ix_audit_logs_org_created", "org_id", "created_at"),
        Index("ix_audit_logs_org_resource", "org_id", "resource_type", "resource_id"),
    )
