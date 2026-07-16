"""ProviderUsageLog — one row per LLM call, recording which provider was
actually used, token counts, latency, and whether a fallback was invoked."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ProviderUsageLog(Base):
    __tablename__ = "provider_usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # "groq" | "ollama" | "fallback"
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    # e.g. "llama-3.3-70b-versatile" or "qwen3:8b"
    model: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    # "generate" | "embed"
    operation: Mapped[str] = mapped_column(String(32), nullable=False, default="generate")
    # Which agent triggered this call: "marketing" | "sales" | "support" | "orchestrator" | "system"
    agent_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Did the primary fail and we fell back?
    fallback_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Wall-clock latency in milliseconds
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Token usage where available (Groq returns these; Ollama does not always)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # HTTP status or "ok" / "error"
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ok")
    error_message: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
