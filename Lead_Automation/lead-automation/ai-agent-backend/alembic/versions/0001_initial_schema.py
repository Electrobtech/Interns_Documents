"""Initial schema — all tables, pgvector extension, tsvector index.

Revision ID: 0001
Revises:
Create Date: 2026-07-16
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Extensions
    # ------------------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # ------------------------------------------------------------------
    # audit_logs  (shared table — also written to by Node services)
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL,
            user_id     TEXT NOT NULL,
            action      TEXT NOT NULL,
            meta        JSONB NOT NULL DEFAULT '{}',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_org_created ON audit_logs (organization_id, created_at DESC)")

    # ------------------------------------------------------------------
    # knowledge_sources
    # ------------------------------------------------------------------
    op.create_table(
        "knowledge_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_type", sa.String, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("source_type", sa.String, nullable=False),
        sa.Column("status", sa.String, nullable=False, server_default="processing"),
        sa.Column("chunk_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("error_detail", sa.Text, nullable=True),
        sa.Column("source_metadata", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_knowledge_sources_org_agent", "knowledge_sources", ["organization_id", "agent_type"])

    # ------------------------------------------------------------------
    # knowledge_chunks  (pgvector 768-dim — nomic-embed-text)
    # ------------------------------------------------------------------
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "knowledge_source_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("knowledge_sources.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("agent_type", sa.String, nullable=False),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("embedding", sa.Text, nullable=True),   # replaced with vector below
        sa.Column("metadata", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    # Replace the TEXT placeholder with the actual vector column.
    op.execute("ALTER TABLE knowledge_chunks DROP COLUMN embedding")
    op.execute("ALTER TABLE knowledge_chunks ADD COLUMN embedding vector(768)")

    # tsvector for keyword search (used by hybrid retrieval)
    op.execute("""
        ALTER TABLE knowledge_chunks
        ADD COLUMN content_tsv tsvector
            GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
    """)
    op.execute("CREATE INDEX ix_kc_org_agent ON knowledge_chunks (organization_id, agent_type)")
    op.execute("CREATE INDEX ix_kc_source ON knowledge_chunks (knowledge_source_id)")
    op.execute("CREATE INDEX ix_kc_content_tsv ON knowledge_chunks USING GIN (content_tsv)")
    # HNSW index for fast approximate nearest-neighbour search
    op.execute("""
        CREATE INDEX ix_kc_embedding_hnsw
        ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # ------------------------------------------------------------------
    # marketing_agent_runs
    # ------------------------------------------------------------------
    op.create_table(
        "marketing_agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("brief", sa.Text, nullable=False),
        sa.Column("output", postgresql.JSONB, nullable=False),
        sa.Column("knowledge_sources_used", postgresql.ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_marketing_runs_org_created", "marketing_agent_runs", ["organization_id", "created_at"])

    # ------------------------------------------------------------------
    # sales_agent_runs
    # ------------------------------------------------------------------
    op.create_table(
        "sales_agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("brief", sa.Text, nullable=False),
        sa.Column("output", postgresql.JSONB, nullable=False),
        sa.Column("knowledge_sources_used", postgresql.ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_sales_runs_org_created", "sales_agent_runs", ["organization_id", "created_at"])

    # ------------------------------------------------------------------
    # support_agent_runs
    # ------------------------------------------------------------------
    op.create_table(
        "support_agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("brief", sa.Text, nullable=False),
        sa.Column("output", postgresql.JSONB, nullable=False),
        sa.Column("knowledge_sources_used", postgresql.ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_support_runs_org_created", "support_agent_runs", ["organization_id", "created_at"])

    # ------------------------------------------------------------------
    # agent_conversations  (shared session memory)
    # ------------------------------------------------------------------
    op.create_table(
        "agent_conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", sa.String, nullable=False),
        sa.Column("role", sa.String, nullable=False),
        sa.Column("agent_type", sa.String, nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_agent_conversations_session", "agent_conversations", ["organization_id", "session_id", "created_at"])

    # ------------------------------------------------------------------
    # agent_webhooks
    # ------------------------------------------------------------------
    op.create_table(
        "agent_webhooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("events", postgresql.ARRAY(sa.String), nullable=False, server_default="""'{"run.completed"}'"""),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_agent_webhooks_org", "agent_webhooks", ["organization_id"])

    # ------------------------------------------------------------------
    # handoff_requests
    # ------------------------------------------------------------------
    op.create_table(
        "handoff_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_type", sa.String(64), nullable=False),
        sa.Column("original_brief", sa.Text, nullable=False),
        sa.Column("agent_output", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("customer_name", sa.String(256), nullable=True),
        sa.Column("channel", sa.String(64), nullable=True),
        sa.Column("session_id", sa.String(256), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("resolution_note", sa.Text, nullable=True),
        sa.Column("assigned_to", sa.String(256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_handoff_requests_org_status", "handoff_requests", ["organization_id", "status", "created_at"])

    # ------------------------------------------------------------------
    # provider_usage_logs
    # ------------------------------------------------------------------
    op.create_table(
        "provider_usage_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider", sa.String(64), nullable=False),
        sa.Column("model", sa.String(128), nullable=False, server_default=""),
        sa.Column("operation", sa.String(32), nullable=False, server_default="generate"),
        sa.Column("agent_type", sa.String(64), nullable=True),
        sa.Column("fallback_used", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("prompt_tokens", sa.Integer, nullable=True),
        sa.Column("completion_tokens", sa.Integer, nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="ok"),
        sa.Column("error_message", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_provider_logs_org_created", "provider_usage_logs", ["organization_id", "created_at"])
    op.create_index("ix_provider_logs_provider", "provider_usage_logs", ["provider", "created_at"])


def downgrade() -> None:
    op.drop_table("provider_usage_logs")
    op.drop_table("handoff_requests")
    op.drop_table("agent_webhooks")
    op.drop_table("agent_conversations")
    op.drop_table("support_agent_runs")
    op.drop_table("sales_agent_runs")
    op.drop_table("marketing_agent_runs")
    op.drop_table("knowledge_chunks")
    op.drop_table("knowledge_sources")
    op.execute("DROP TABLE IF EXISTS audit_logs")
