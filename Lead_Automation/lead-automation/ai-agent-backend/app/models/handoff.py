"""HandoffRequest — records every human-handoff event produced by any agent,
with status lifecycle: pending -> assigned -> resolved | rejected."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

_VALID_STATUSES = ("pending", "assigned", "resolved", "rejected")


class HandoffRequest(Base):
    __tablename__ = "handoff_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Which agent triggered the handoff
    agent_type: Mapped[str] = mapped_column(String(64), nullable=False)

    # The original customer/user message that triggered handoff
    original_brief: Mapped[str] = mapped_column(Text, nullable=False)

    # The full agent output that set human_handoff=true
    agent_output: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Customer context
    customer_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    channel: Mapped[str | None] = mapped_column(String(64), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(256), nullable=True)

    # Lifecycle
    # pending | assigned | resolved | rejected
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")

    # Internal note added when status changes
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The user_id of the human who claimed/resolved the handoff
    assigned_to: Mapped[str | None] = mapped_column(String(256), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
