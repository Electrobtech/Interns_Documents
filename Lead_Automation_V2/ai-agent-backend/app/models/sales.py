from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, ARRAY, Boolean, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SalesAgentRun(Base):
    __tablename__ = "sales_agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    brief: Mapped[str] = mapped_column(Text, nullable=False)
    output: Mapped[dict] = mapped_column(JSON, nullable=False)
    knowledge_sources_used: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SalesAgentConfig(Base):
    """One row per organization. Backs the two Sales Agent dashboard CTAs
    that used to be permanent placeholders — "Set Up Deal Values" and "Wire
    Confidence Signal" (SalesWorkspace.jsx) — plus the aggregation that
    turns them into real numbers on the Pipeline Value / AI Confidence
    metric cards (see SalesService._compute_metrics).

    Deliberately NOT keyed by a synthetic id-only PK with a separate unique
    constraint: organization_id IS the natural key (one config per org), so
    it's the primary key directly — the same shape as an upsert-by-org table
    should have, and it makes "get or default" a single simple lookup.
    """

    __tablename__ = "sales_agent_config"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)

    # Which real leads.* column (see contact-service GET /leads/fields) to
    # sum for Pipeline Value. NULL means "not configured yet" — deliberately
    # distinct from an empty string, so the dashboard can keep showing the
    # honest "no deal-value field mapped yet" state rather than silently
    # summing a field that was never chosen.
    deal_value_field: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # List[{"key": "lead_score_avg"|"knowledge_coverage"|"handoff_rate", "enabled": bool, "weight": float}]
    # stored as JSONB rather than a normalized child table: it's a small,
    # always-fetched-as-a-whole config blob with no independent query
    # pattern of its own, so a join buys nothing here.
    confidence_signal_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # ── Settings tab (SalesWorkspace.jsx "Lead Scoring" / "Follow-up
    # Automation" sections) — previously rendered fixed values with nothing
    # behind them. See migration 0005 for defaults.
    min_hot_score: Mapped[int] = mapped_column(Integer, nullable=False, default=75)
    max_followup_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    require_approval: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Day-offsets a follow-up should fire on relative to the lead entering
    # the sequence, e.g. [1, 3, 7, 14] == "Day 1, 3, 7, 14".
    followup_cadence_days: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False, default=lambda: [1, 3, 7, 14])

    # Forecasting tab gap analysis: target vs. actual closed revenue this
    # month. NULL means "not set" — kept distinct from 0, same reasoning as
    # deal_value_field above.
    monthly_revenue_target: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
