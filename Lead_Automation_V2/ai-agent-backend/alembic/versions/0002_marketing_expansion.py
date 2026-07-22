"""Marketing Agent expansion — persona/ICP, SEO briefs, campaign plans,
competitor reports.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-18
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Same idempotent-by-table pattern as 0001 — skip a table individually if
    # it already exists, so re-running never crash-loops.
    inspector = sa.inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())

    if "icp_personas" not in existing_tables:
        op.create_table(
            "icp_personas",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("name", sa.String, nullable=False),
            sa.Column("output", postgresql.JSONB, nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_icp_personas_org_created", "icp_personas", ["organization_id", "created_at"])

    if "seo_content_briefs" not in existing_tables:
        op.create_table(
            "seo_content_briefs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("topic", sa.String, nullable=False),
            sa.Column("output", postgresql.JSONB, nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_seo_briefs_org_created", "seo_content_briefs", ["organization_id", "created_at"])

    if "campaign_plans" not in existing_tables:
        op.create_table(
            "campaign_plans",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("name", sa.String, nullable=False),
            sa.Column("goal", sa.Text, nullable=True),
            sa.Column("timeframe", sa.String, nullable=True),
            sa.Column("output", postgresql.JSONB, nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_campaign_plans_org_created", "campaign_plans", ["organization_id", "created_at"])

    if "competitor_reports" not in existing_tables:
        op.create_table(
            "competitor_reports",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("subject", sa.String, nullable=False),
            sa.Column("output", postgresql.JSONB, nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_competitor_reports_org_created", "competitor_reports", ["organization_id", "created_at"])


def downgrade() -> None:
    op.drop_table("competitor_reports")
    op.drop_table("campaign_plans")
    op.drop_table("seo_content_briefs")
    op.drop_table("icp_personas")
