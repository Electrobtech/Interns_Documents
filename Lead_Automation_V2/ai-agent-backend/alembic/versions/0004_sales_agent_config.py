"""sales_agent_config — deal-value field mapping + confidence signal weights.

Backs the Sales Agent dashboard's "Set Up Deal Values" and "Wire Confidence
Signal" CTAs (SalesWorkspace.jsx) and the dynamic Pipeline Value / AI
Confidence metric calculation in SalesService._compute_metrics.

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-06
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())

    if "sales_agent_config" not in existing_tables:
        op.create_table(
            "sales_agent_config",
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("deal_value_field", sa.String(64), nullable=True),
            sa.Column("confidence_signal_config", postgresql.JSONB, nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )


def downgrade() -> None:
    op.drop_table("sales_agent_config")
