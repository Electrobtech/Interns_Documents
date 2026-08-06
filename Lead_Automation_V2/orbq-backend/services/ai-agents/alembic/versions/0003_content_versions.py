"""Content version history + claim verification tracking.

`ContentDoc.version` was already incremented on every save with nowhere to look
up what a prior version said. This adds the table that makes the counter mean
something, plus `claims_verified` so a human's sign-off on an ungrounded claim
is recorded rather than assumed.

Both are additive: no existing column changes, so this is safe on a populated
table.

Revision ID: 0003
Revises: 0002
"""
from __future__ import annotations

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

NEW_TABLES = ["marketing_content_versions"]


def upgrade() -> None:
    from orbq_core.db.base import Base
    from app.models import marketing  # noqa: F401  (registers the mappers)

    bind = op.get_bind()
    tables = [Base.metadata.tables[t] for t in NEW_TABLES]
    Base.metadata.create_all(bind=bind, tables=tables, checkfirst=True)

    for table in NEW_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table}")
        op.execute(
            f"CREATE POLICY {table}_tenant_isolation ON {table} "
            "USING (org_id = current_setting('app.current_org_id', true)::uuid) "
            "WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)"
        )

    # Existing rows get an empty list, not NULL — the API treats this column as
    # always-a-list, and a NULL would need a special case at every read site.
    op.execute(
        "ALTER TABLE marketing_content "
        "ADD COLUMN IF NOT EXISTS claims_verified jsonb NOT NULL DEFAULT '[]'::jsonb"
    )

    # Backfill a v1 snapshot for content that predates versioning, so the
    # history view is never empty for a document that has one.
    op.execute(
        """
        INSERT INTO marketing_content_versions
            (id, org_id, content_id, version, title, body, variants,
             change_note, created_at, updated_at, created_by)
        SELECT gen_random_uuid(), c.org_id, c.id, 1, c.title, c.body, c.variants,
               'Backfilled from the current document when versioning was added',
               c.created_at, c.created_at, c.created_by
        FROM marketing_content c
        WHERE c.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM marketing_content_versions v WHERE v.content_id = c.id
          )
        """
    )


def downgrade() -> None:
    for table in NEW_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table}")
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    op.execute("ALTER TABLE marketing_content DROP COLUMN IF EXISTS claims_verified")
