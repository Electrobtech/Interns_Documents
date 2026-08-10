"""Marketing domain schema — campaigns, audiences, broadcasts, delivery,
content, assets, calendar, reports, SEO/AEO/competitor persistence.

19 tables. Generated from app/models/marketing.py's SQLAlchemy metadata rather
than hand-written DDL, so schema and ORM cannot drift apart.

Revision ID: 0002
Revises: 0001
"""
from __future__ import annotations

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

MARKETING_TABLES = [
    "marketing_audiences",
    "marketing_campaigns",
    "marketing_campaign_items",
    "marketing_campaign_status_history",
    "marketing_campaign_recipients",
    "marketing_broadcasts",
    "marketing_broadcast_recipients",
    "marketing_delivery_events",
    "marketing_content",
    "marketing_templates",
    "marketing_asset_folders",
    "marketing_assets",
    "marketing_calendar_events",
    "marketing_reports",
    "marketing_seo_projects",
    "marketing_seo_keywords",
    "marketing_aeo_projects",
    "marketing_competitors",
    "marketing_competitor_snapshots",
]

SEARCH_INDEXES = {
    "marketing_campaigns": "coalesce(name,'') || ' ' || coalesce(description,'')",
    "marketing_content": "coalesce(title,'') || ' ' || coalesce(body,'')",
    "marketing_broadcasts": "coalesce(name,'') || ' ' || coalesce(body,'')",
    "marketing_audiences": "coalesce(name,'') || ' ' || coalesce(description,'')",
    "marketing_assets": "coalesce(name,'')",
    "marketing_templates": "coalesce(name,'') || ' ' || coalesce(body,'')",
}


def upgrade() -> None:
    from orbq_core.db.base import Base
    from app.models import marketing  # noqa: F401  (registers the mappers)

    bind = op.get_bind()
    # checkfirst + only this migration's tables: create_all() would otherwise
    # try to touch every table already made by 0001.
    tables = [Base.metadata.tables[t] for t in MARKETING_TABLES]
    Base.metadata.create_all(bind=bind, tables=tables, checkfirst=True)

    # RLS on every tenant table — same layer-3 discipline as 0001 (§17.2).
    for table in MARKETING_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table}")
        op.execute(
            f"CREATE POLICY {table}_tenant_isolation ON {table} "
            "USING (org_id = current_setting('app.current_org_id', true)::uuid) "
            "WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)"
        )

    for table, expr in SEARCH_INDEXES.items():
        op.execute(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS search_tsv tsvector "
            f"GENERATED ALWAYS AS (to_tsvector('english', {expr})) STORED"
        )
        op.execute(
            f"CREATE INDEX IF NOT EXISTS ix_{table}_search "
            f"ON {table} USING gin (search_tsv)"
        )


def downgrade() -> None:
    for table in MARKETING_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table}")
    for table in reversed(MARKETING_TABLES):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
