"""Initial schema for orbq-ai-agents.

Phase 3. Creates the agent, knowledge, memory, governance, and workflow tables,
then enables Row-Level Security on every one of them (§17.2 layer 3).

Defensive about pgvector: if the extension is unavailable the vector columns
degrade to TEXT and retrieval falls back to keyword-only. That is a real
deployment scenario (managed Postgres without the extension), and failing the
whole migration over it would be worse than degrading.

Revision ID: 0001
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Tables that carry org_id and therefore MUST have an RLS policy. The CI check
# in orbq_core.db.session.TENANT_TABLES_AUDIT_SQL fails the build if any table
# with an org_id column is missing from this list.
TENANT_TABLES = [
    "agent_sessions",
    "agent_executions",
    "capability_invocations",
    "quota_ledger",
    "knowledge_sources",
    "knowledge_chunks",
    "memory_records",
    "session_summaries",
    "approval_requests",
    "approval_events",
    "audit_logs",
    "workflow_definitions",
    "workflow_runs",
    "workflow_steps",
    "event_log",
    "outbox",
]


def _has_pgvector(conn) -> bool:
    return bool(
        conn.execute(
            sa.text("SELECT 1 FROM pg_available_extensions WHERE name = 'vector'")
        ).scalar()
    )


def upgrade() -> None:
    conn = op.get_bind()
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    pgvector = _has_pgvector(conn)
    if pgvector:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        from pgvector.sqlalchemy import Vector

        embedding_type = Vector(768)
    else:
        # Degrade rather than fail. Hybrid search drops to ts_rank only.
        embedding_type = sa.Text()

    uuid_pk = sa.Column(
        "id", postgresql.UUID(as_uuid=True), primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )

    def audit_columns() -> list[sa.Column]:
        """The §16.3 conventions, applied to every table without exception."""
        return [
            sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.text("now()")),
            sa.Column("created_by", postgresql.UUID(as_uuid=True)),
            sa.Column("updated_by", postgresql.UUID(as_uuid=True)),
            sa.Column("deleted_at", sa.DateTime(timezone=True)),
        ]

    # ---------------- Agent execution ----------------

    op.create_table(
        "agent_sessions", uuid_pk, *audit_columns(),
        sa.Column("workspace", sa.String(16), nullable=False),
        sa.Column("title", sa.String(300)),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("turn_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_activity_at", sa.DateTime(timezone=True)),
        sa.Column("session_metadata", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.CheckConstraint("workspace IN ('marketing','sales','support')",
                           name="agent_sessions_workspace_valid"),
        sa.CheckConstraint("status IN ('open','closed')", name="agent_sessions_status_valid"),
    )
    op.create_index("ix_agent_sessions_org_workspace_activity", "agent_sessions",
                    ["org_id", "workspace", "last_activity_at"])

    op.create_table(
        "agent_executions", uuid_pk, *audit_columns(),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workspace", sa.String(16), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("request_message", sa.Text, nullable=False),
        sa.Column("request_context", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("output", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("summary", sa.Text),
        sa.Column("reasoning", sa.Text),
        sa.Column("confidence", sa.Float),
        sa.Column("capabilities_used", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("knowledge_used", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("alternatives", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("degraded_inputs", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("business_impact", sa.Text),
        sa.Column("tokens_in", sa.Integer, nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer, nullable=False, server_default="0"),
        sa.Column("credits", sa.Integer, nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column("llm_calls", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error_detail", sa.Text),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "status IN ('pending','running','succeeded','partial','pending_approval','failed')",
            name="agent_executions_status_valid"),
        sa.CheckConstraint("confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
                           name="agent_executions_confidence_range"),
    )
    op.create_index("ix_agent_executions_org_workspace_created", "agent_executions",
                    ["org_id", "workspace", "created_at"])
    op.create_index("ix_agent_executions_org_status", "agent_executions", ["org_id", "status"])
    op.create_index("ix_agent_executions_session", "agent_executions",
                    ["session_id", "created_at"])

    op.create_table(
        "capability_invocations", uuid_pk, *audit_columns(),
        sa.Column("execution_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("agent_executions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("capability", sa.String(64), nullable=False),
        sa.Column("workspace", sa.String(16), nullable=False),
        sa.Column("stage", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("output", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("reasoning", sa.Text),
        sa.Column("confidence", sa.Float),
        sa.Column("citations", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("tokens_in", sa.Integer, nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer, nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column("prompt_version", sa.String(32)),
        sa.Column("model", sa.String(64)),
        sa.Column("error_detail", sa.Text),
    )
    op.create_index("ix_capability_invocations_org_capability", "capability_invocations",
                    ["org_id", "capability", "created_at"])
    op.create_index("ix_capability_invocations_execution", "capability_invocations",
                    ["execution_id", "stage"])

    op.create_table(
        "quota_ledger", uuid_pk, *audit_columns(),
        sa.Column("execution_id", postgresql.UUID(as_uuid=True)),
        sa.Column("period", sa.String(7), nullable=False),
        sa.Column("credits", sa.Integer, nullable=False),
        sa.Column("tokens_in", sa.Integer, nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer, nullable=False, server_default="0"),
        sa.Column("reason", sa.String(64), nullable=False, server_default="execution"),
    )
    op.create_index("ix_quota_ledger_org_period", "quota_ledger", ["org_id", "period"])

    # ---------------- Knowledge / RAG ----------------

    op.create_table(
        "knowledge_sources", uuid_pk, *audit_columns(),
        sa.Column("workspace", sa.String(16), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("source_type", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("chunk_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("byte_size", sa.Integer, nullable=False, server_default="0"),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("supersedes_id", postgresql.UUID(as_uuid=True)),
        sa.Column("error_detail", sa.Text),
        sa.Column("source_metadata", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("raw_document_ref", sa.String(200)),
        sa.CheckConstraint(
            "source_type IN ('pdf','docx','xlsx','csv','txt','md','note','web')",
            name="knowledge_sources_type_valid"),
        sa.CheckConstraint("status IN ('pending','processing','ready','failed')",
                           name="knowledge_sources_status_valid"),
    )
    op.create_index("ix_knowledge_sources_org_workspace_status", "knowledge_sources",
                    ["org_id", "workspace", "status"])
    # Only one ACTIVE version per logical source.
    op.create_index("uq_knowledge_sources_org_active_name", "knowledge_sources",
                    ["org_id", "workspace", "name"], unique=True,
                    postgresql_where=sa.text("is_active AND deleted_at IS NULL"))

    op.create_table(
        "knowledge_chunks", uuid_pk, *audit_columns(),
        sa.Column("knowledge_source_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("knowledge_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workspace", sa.String(16), nullable=False),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("heading_path", sa.Text),
        sa.Column("embedding", embedding_type),
        sa.Column("embedding_model", sa.String(64), nullable=False,
                  server_default="nomic-embed-text"),
        sa.Column("content_tsv", postgresql.TSVECTOR,
                  sa.Computed("to_tsvector('english', content)", persisted=True)),
        sa.Column("chunk_metadata", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_knowledge_chunks_org_workspace", "knowledge_chunks",
                    ["org_id", "workspace"])
    op.create_index("ix_knowledge_chunks_source", "knowledge_chunks",
                    ["knowledge_source_id", "chunk_index"])
    op.create_index("ix_knowledge_chunks_tsv", "knowledge_chunks", ["content_tsv"],
                    postgresql_using="gin")
    if pgvector:
        op.execute(
            "CREATE INDEX ix_knowledge_chunks_embedding_hnsw ON knowledge_chunks "
            "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
        )

    # ---------------- AI memory ----------------

    op.create_table(
        "memory_records", uuid_pk, *audit_columns(),
        sa.Column("workspace", sa.String(16)),
        sa.Column("kind", sa.String(16), nullable=False, server_default="fact"),
        sa.Column("subject_type", sa.String(20), nullable=False, server_default="org"),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True)),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("embedding", embedding_type),
        sa.Column("confidence", sa.Float, nullable=False, server_default="0.7"),
        sa.Column("importance", sa.Float, nullable=False, server_default="0.5"),
        sa.Column("access_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("superseded_by", postgresql.UUID(as_uuid=True)),
        sa.Column("source_execution_id", postgresql.UUID(as_uuid=True)),
        sa.Column("memory_metadata", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.CheckConstraint(
            "kind IN ('fact','preference','constraint','outcome','correction','summary')",
            name="memory_records_kind_valid"),
        sa.CheckConstraint(
            "subject_type IN ('contact','company','campaign','conversation','lead','org')",
            name="memory_records_subject_valid"),
    )
    op.create_index("ix_memory_records_org_subject", "memory_records",
                    ["org_id", "subject_type", "subject_id"])
    op.create_index("ix_memory_records_org_workspace_kind", "memory_records",
                    ["org_id", "workspace", "kind"])
    if pgvector:
        op.execute(
            "CREATE INDEX ix_memory_records_embedding_hnsw ON memory_records "
            "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
        )

    op.create_table(
        "session_summaries", uuid_pk, *audit_columns(),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace", sa.String(16), nullable=False),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column("key_facts", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'[]'::jsonb")),
        sa.Column("turn_count", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_session_summaries_org_session", "session_summaries",
                    ["org_id", "session_id"], unique=True)

    # ---------------- Governance: approvals + audit ----------------

    op.create_table(
        "approval_requests", uuid_pk, *audit_columns(),
        sa.Column("workspace", sa.String(16), nullable=False),
        sa.Column("execution_id", postgresql.UUID(as_uuid=True)),
        sa.Column("action_type", sa.String(64), nullable=False),
        # Polymorphic approvable: governance stores a content-addressed snapshot
        # and never dereferences the id into another service's schema (§24.1).
        sa.Column("approvable_type", sa.String(40), nullable=False),
        sa.Column("approvable_id", postgresql.UUID(as_uuid=True)),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("content", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("origin_service", sa.String(40), nullable=False),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("current_level", sa.Integer, nullable=False, server_default="1"),
        sa.Column("required_levels", sa.Integer, nullable=False, server_default="1"),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True)),
        sa.Column("decided_by", postgresql.UUID(as_uuid=True)),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("decision_comment", sa.Text),
        sa.Column("confidence", sa.Float),
        sa.Column("auto_approved_by_rule", postgresql.UUID(as_uuid=True)),
        sa.Column("reversible", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "status IN ('draft','pending','changes_requested','approved','rejected',"
            "'escalated','expired','executed','rolled_back')",
            name="approval_requests_status_valid"),
        # The requester-≠-approver invariant (§12.3), enforced by the database
        # rather than trusted to application code.
        sa.CheckConstraint(
            "decided_by IS NULL OR decided_by <> requested_by",
            name="approval_requests_no_self_approval"),
    )
    op.create_index("ix_approval_requests_org_status", "approval_requests",
                    ["org_id", "status", "created_at"])
    op.create_index("ix_approval_requests_org_assignee", "approval_requests",
                    ["org_id", "assigned_to", "status"])

    op.create_table(
        "approval_events", uuid_pk, *audit_columns(),
        sa.Column("approval_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("approval_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_status", sa.String(24)),
        sa.Column("to_status", sa.String(24), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True)),
        sa.Column("level", sa.Integer, nullable=False, server_default="1"),
        sa.Column("comment", sa.Text),
    )
    op.create_index("ix_approval_events_approval", "approval_events",
                    ["approval_id", "created_at"])

    op.create_table(
        "audit_logs", uuid_pk, *audit_columns(),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True)),
        sa.Column("actor_type", sa.String(16), nullable=False, server_default="user"),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("resource_type", sa.String(40), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True)),
        sa.Column("before", postgresql.JSONB),
        sa.Column("after", postgresql.JSONB),
        sa.Column("reason", sa.Text),
        sa.Column("trace_id", sa.String(64)),
    )
    op.create_index("ix_audit_logs_org_created", "audit_logs", ["org_id", "created_at"])
    op.create_index("ix_audit_logs_org_resource", "audit_logs",
                    ["org_id", "resource_type", "resource_id"])

    # ---------------- Workflow ----------------

    op.create_table(
        "workflow_definitions", uuid_pk, *audit_columns(),
        sa.Column("key", sa.String(80), nullable=False),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("workspace", sa.String(16)),
        # Workflows are DATA, not code, so the executor can be swapped later
        # (ADR-006) without rewriting the processes.
        sa.Column("definition", postgresql.JSONB, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
    )
    op.create_index("uq_workflow_definitions_org_key_version", "workflow_definitions",
                    ["org_id", "key", "version"], unique=True)

    op.create_table(
        "workflow_runs", uuid_pk, *audit_columns(),
        sa.Column("definition_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("workflow_definitions.id"), nullable=False),
        sa.Column("workspace", sa.String(16)),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("context", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("entity_type", sa.String(40)),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("current_step", sa.Integer, nullable=False, server_default="0"),
        sa.Column("idempotency_key", sa.String(128)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("resume_at", sa.DateTime(timezone=True)),
        sa.Column("error_detail", sa.Text),
        sa.CheckConstraint(
            "status IN ('pending','running','waiting_approval','waiting_delay',"
            "'succeeded','failed','timed_out','compensating','compensated','cancelled')",
            name="workflow_runs_status_valid"),
    )
    op.create_index("ix_workflow_runs_org_status", "workflow_runs",
                    ["org_id", "status", "resume_at"])
    # Prevents duplicate runs on the same entity (§12.2).
    op.create_index("uq_workflow_runs_idempotency", "workflow_runs",
                    ["org_id", "idempotency_key"], unique=True,
                    postgresql_where=sa.text("idempotency_key IS NOT NULL"))

    op.create_table(
        "workflow_steps", uuid_pk, *audit_columns(),
        sa.Column("run_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_index", sa.Integer, nullable=False),
        sa.Column("step_key", sa.String(80), nullable=False),
        sa.Column("step_type", sa.String(24), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer, nullable=False, server_default="3"),
        sa.Column("input", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("output", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("compensation", postgresql.JSONB),
        sa.Column("compensated_at", sa.DateTime(timezone=True)),
        sa.Column("error_detail", sa.Text),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_workflow_steps_run", "workflow_steps", ["run_id", "step_index"])

    # ---------------- Events: append-only log + transactional outbox ----------

    op.create_table(
        "event_log", uuid_pk, *audit_columns(),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("aggregate_type", sa.String(40), nullable=False),
        sa.Column("aggregate_id", postgresql.UUID(as_uuid=True)),
        sa.Column("payload", postgresql.JSONB, nullable=False),
        sa.Column("trace_id", sa.String(64)),
    )
    op.create_index("ix_event_log_org_type_created", "event_log",
                    ["org_id", "event_type", "created_at"])

    op.create_table(
        "outbox", uuid_pk, *audit_columns(),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("payload", postgresql.JSONB, nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text),
        sa.Column("trace_id", sa.String(64)),
    )
    # Partial index: the relay only ever scans unpublished rows, so indexing the
    # published ones would be pure write cost.
    op.create_index("ix_outbox_unpublished", "outbox", ["created_at"],
                    postgresql_where=sa.text("published_at IS NULL"))

    op.create_table(
        "consumed_events",
        sa.Column("consumer", sa.String(80), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

    # ---------------- Row-Level Security (§17.2 layer 3) ----------------
    #
    # FORCE matters: without it the table owner (which migrations and often the
    # app user are) bypasses the policy entirely, making RLS decorative.
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_tenant_isolation ON {table} "
            "USING (org_id = current_setting('app.current_org_id', true)::uuid) "
            "WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)"
        )


def downgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table}")

    for table in (
        "consumed_events", "outbox", "event_log",
        "workflow_steps", "workflow_runs", "workflow_definitions",
        "audit_logs", "approval_events", "approval_requests",
        "session_summaries", "memory_records",
        "knowledge_chunks", "knowledge_sources",
        "quota_ledger", "capability_invocations", "agent_executions", "agent_sessions",
    ):
        op.drop_table(table)
