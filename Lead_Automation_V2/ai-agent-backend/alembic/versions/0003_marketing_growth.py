"""Marketing Agent growth expansion — AEO (Answer Engine Optimization) runs
and Click-to-WhatsApp ad packages. (Anti-Ban pre-flight and Cold Lead Revival
Radar are computed live and need no tables.)

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-23
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Same idempotent-by-table pattern as 0001/0002 — skip a table individually
    # if it already exists, so re-running never crash-loops.
    inspector = sa.inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())

    if "aeo_optimizations" not in existing_tables:
        op.create_table(
            "aeo_optimizations",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("input_text", sa.Text, nullable=False),
            sa.Column("output", postgresql.JSONB, nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_aeo_optimizations_org_created", "aeo_optimizations", ["organization_id", "created_at"])

    if "ctwa_ad_packages" not in existing_tables:
        op.create_table(
            "ctwa_ad_packages",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("offer_brief", sa.Text, nullable=False),
            sa.Column("output", postgresql.JSONB, nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_ctwa_ad_packages_org_created", "ctwa_ad_packages", ["organization_id", "created_at"])


def downgrade() -> None:
    op.drop_table("ctwa_ad_packages")
    op.drop_table("aeo_optimizations")
