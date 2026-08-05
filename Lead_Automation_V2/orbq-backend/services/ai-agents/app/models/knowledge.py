"""Knowledge / RAG tables — carried forward from ai-agent-backend (§11.1).

The vector column, the generated tsvector, and the HNSW + GIN index pair are
preserved exactly, because they are what make hybrid retrieval work. What is
added here is Phase 6: versioning columns and per-row embedding model tracking.
"""
from __future__ import annotations

import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    CheckConstraint,
    Computed,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from orbq_core.db.base import OrbqTable

# Changing this invalidates every stored vector for every tenant (§11.5).
# Treat it as part of the schema, not as configuration.
EMBEDDING_DIM = 768
DEFAULT_EMBEDDING_MODEL = "nomic-embed-text"

SOURCE_TYPES = ("pdf", "docx", "xlsx", "csv", "txt", "md", "note", "web")
SOURCE_STATUSES = ("pending", "processing", "ready", "failed")


class KnowledgeSource(OrbqTable):
    """An ingested document. Chunks are reachable only through their source."""

    __tablename__ = "knowledge_sources"

    workspace: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")

    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Phase 6 versioning: re-uploading bumps the version and deactivates the
    # prior one, so "what did the agent know on the day it said that?" stays
    # answerable for audit.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    supersedes_id: Mapped[uuid.UUID | None] = mapped_column(PGUUID(as_uuid=True))

    error_detail: Mapped[str | None] = mapped_column(Text)
    source_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Raw extracted text lives in MongoDB (ADR-004); this is the pointer.
    raw_document_ref: Mapped[str | None] = mapped_column(String(200))

    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(f"source_type IN {SOURCE_TYPES}", name="knowledge_sources_type_valid"),
        CheckConstraint(f"status IN {SOURCE_STATUSES}", name="knowledge_sources_status_valid"),
        Index("ix_knowledge_sources_org_workspace_status", "org_id", "workspace", "status"),
        # Only one active version per logical source per workspace.
        Index(
            "uq_knowledge_sources_org_active_name",
            "org_id",
            "workspace",
            "name",
            unique=True,
            postgresql_where=text("is_active AND deleted_at IS NULL"),
        ),
    )


class KnowledgeChunk(OrbqTable):
    """A retrievable passage with its embedding.

    Two indexes, because hybrid search runs two independent retrievals and
    fuses them with RRF (§11.2): HNSW for cosine similarity, GIN for keyword.
    """

    __tablename__ = "knowledge_chunks"

    knowledge_source_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("knowledge_sources.id", ondelete="CASCADE"),
        nullable=False,
    )
    workspace: Mapped[str] = mapped_column(String(16), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Breadcrumb of enclosing headings, produced by structure-aware chunking.
    # Prepended to the embedded text so a chunk carries its document context.
    heading_path: Mapped[str | None] = mapped_column(Text)

    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    # Per-row, so the model can be migrated tenant-by-tenant with dual-read
    # rather than a global stop-the-world re-embed (§11.5).
    embedding_model: Mapped[str] = mapped_column(
        String(64), nullable=False, default=DEFAULT_EMBEDDING_MODEL
    )

    content_tsv: Mapped[str] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('english', content)", persisted=True),
    )

    chunk_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    source: Mapped[KnowledgeSource] = relationship(back_populates="chunks")

    __table_args__ = (
        Index("ix_knowledge_chunks_org_workspace", "org_id", "workspace"),
        Index("ix_knowledge_chunks_source", "knowledge_source_id", "chunk_index"),
        Index(
            "ix_knowledge_chunks_tsv",
            "content_tsv",
            postgresql_using="gin",
        ),
        Index(
            "ix_knowledge_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )
