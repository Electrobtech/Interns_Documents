"""AI memory tables — Phase 13 (§14).

Long-term, semantic, and entity memory live here. Short-term lives in Redis
(session-scoped, 24h TTL) and is deliberately not persisted: it is working
context, not knowledge.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import CheckConstraint, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from orbq_core.db.base import OrbqTable

from .knowledge import EMBEDDING_DIM

MEMORY_KINDS = ("fact", "preference", "constraint", "outcome", "correction", "summary")
SUBJECT_TYPES = ("contact", "company", "campaign", "conversation", "lead", "org")


class MemoryRecord(OrbqTable):
    """A durable thing the agent learned.

    Invariant (§7.3): scoped to (org, subject_type, subject_id); TTL enforced on
    retrieval rather than only by a sweeper, so an expired memory can never leak
    into a prompt just because the cleanup job is behind.
    """

    __tablename__ = "memory_records"

    workspace: Mapped[str | None] = mapped_column(String(16))
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="fact")

    subject_type: Mapped[str] = mapped_column(String(20), nullable=False, default="org")
    subject_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))

    # Confidence the fact is true, decayed as it ages without reinforcement.
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.7)
    importance: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    access_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # When a newer memory contradicts this one, the old row is superseded rather
    # than deleted — "what did the agent believe last month?" stays answerable.
    superseded_by: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    source_execution_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))
    memory_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    __table_args__ = (
        CheckConstraint(f"kind IN {MEMORY_KINDS}", name="memory_records_kind_valid"),
        CheckConstraint(
            f"subject_type IN {SUBJECT_TYPES}", name="memory_records_subject_valid"
        ),
        Index("ix_memory_records_org_subject", "org_id", "subject_type", "subject_id"),
        Index("ix_memory_records_org_workspace_kind", "org_id", "workspace", "kind"),
        Index(
            "ix_memory_records_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class SessionSummary(OrbqTable):
    """Consolidated summary of a finished session.

    Produced by the consolidation worker so a long conversation can be recalled
    without replaying every turn into the context window.
    """

    __tablename__ = "session_summaries"

    session_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    workspace: Mapped[str] = mapped_column(String(16), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_facts: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    turn_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("ix_session_summaries_org_session", "org_id", "session_id", unique=True),
    )
