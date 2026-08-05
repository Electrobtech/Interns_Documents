"""Agent Execution context — sessions, executions, capability invocations.

Phase 5 + 13. These are the tables behind the frontend's Agent Brain Log,
Task Queue, and confidence indicators.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from orbq_core.db.base import OrbqTable

WORKSPACES = ("marketing", "sales", "support")
EXECUTION_STATUSES = (
    "pending",
    "running",
    "succeeded",
    "partial",
    "pending_approval",
    "failed",
)


class AgentSession(OrbqTable):
    """A conversation with one agent workspace.

    Invariant (§7.3): one org + one workspace; rejects new turns once closed.
    """

    __tablename__ = "agent_sessions"

    workspace: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")
    turn_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    session_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    executions: Mapped[list["AgentExecution"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        CheckConstraint(
            f"workspace IN {WORKSPACES}", name="agent_sessions_workspace_valid"
        ),
        CheckConstraint(
            "status IN ('open','closed')", name="agent_sessions_status_valid"
        ),
        # org_id leads every index so TenantScopedRepository's queries can use it.
        Index("ix_agent_sessions_org_workspace_activity", "org_id", "workspace", "last_activity_at"),
    )


class AgentExecution(OrbqTable):
    """One agent run. Immutable once terminal.

    Carries the full explainability payload (§15) — this row is what
    GET /sessions/{id}/executions returns.
    """

    __tablename__ = "agent_executions"

    session_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("agent_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    workspace: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    request_message: Mapped[str] = mapped_column(Text, nullable=False)
    request_context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    output: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # ---- explainability (§15) ----
    summary: Mapped[str | None] = mapped_column(Text)
    reasoning: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Float)
    capabilities_used: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    knowledge_used: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    alternatives: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    degraded_inputs: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    business_impact: Mapped[str | None] = mapped_column(Text)

    # ---- usage ----
    tokens_in: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    llm_calls: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    error_detail: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    session: Mapped[AgentSession] = relationship(back_populates="executions")
    invocations: Mapped[list["CapabilityInvocation"]] = relationship(
        back_populates="execution", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        CheckConstraint(
            f"status IN {EXECUTION_STATUSES}", name="agent_executions_status_valid"
        ),
        CheckConstraint(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            name="agent_executions_confidence_range",
        ),
        Index("ix_agent_executions_org_workspace_created", "org_id", "workspace", "created_at"),
        Index("ix_agent_executions_org_status", "org_id", "status"),
        Index("ix_agent_executions_session", "session_id", "created_at"),
    )

    @property
    def is_terminal(self) -> bool:
        return self.status in {"succeeded", "partial", "failed"}


class CapabilityInvocation(OrbqTable):
    """One capability's contribution to an execution.

    Separate from the execution row because a single run invokes several
    capabilities and each needs its own confidence, latency, and prompt version
    for the quality metrics in §21.4.
    """

    __tablename__ = "capability_invocations"

    execution_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("agent_executions.id", ondelete="CASCADE"),
        nullable=False,
    )
    capability: Mapped[str] = mapped_column(String(64), nullable=False)
    workspace: Mapped[str] = mapped_column(String(16), nullable=False)
    stage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    output: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    reasoning: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Float)
    citations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    tokens_in: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    prompt_version: Mapped[str | None] = mapped_column(String(32))
    model: Mapped[str | None] = mapped_column(String(64))
    error_detail: Mapped[str | None] = mapped_column(Text)

    execution: Mapped[AgentExecution] = relationship(back_populates="invocations")

    __table_args__ = (
        Index("ix_capability_invocations_org_capability", "org_id", "capability", "created_at"),
        Index("ix_capability_invocations_execution", "execution_id", "stage"),
    )


class QuotaLedger(OrbqTable):
    """Per-org AI credit accounting (§17.3).

    Append-only: each execution writes a debit row. A running balance column
    would need locking on every write and would lose the audit trail that makes
    a disputed bill answerable.
    """

    __tablename__ = "quota_ledger"

    execution_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    period: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    tokens_in: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reason: Mapped[str] = mapped_column(String(64), nullable=False, default="execution")

    __table_args__ = (
        Index("ix_quota_ledger_org_period", "org_id", "period"),
    )
