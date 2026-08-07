"""sales_agent_config — Settings tab fields + revenue target for gap analysis.

Adds the four fields the Sales Agent Settings tab actually needs to persist
(SalesWorkspace.jsx's Lead Scoring / Follow-up Automation sections, which
used to render fixed values with no backing state) plus a monthly revenue
target so the Forecasting tab can show a real target-vs-actual gap instead
of a hardcoded "$120K".

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-06
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing_columns = {c["name"] for c in inspector.get_columns("sales_agent_config")}

    if "min_hot_score" not in existing_columns:
        op.add_column(
            "sales_agent_config",
            sa.Column("min_hot_score", sa.Integer, nullable=False, server_default="75"),
        )
    if "max_followup_attempts" not in existing_columns:
        op.add_column(
            "sales_agent_config",
            sa.Column("max_followup_attempts", sa.Integer, nullable=False, server_default="5"),
        )
    if "require_approval" not in existing_columns:
        op.add_column(
            "sales_agent_config",
            sa.Column("require_approval", sa.Boolean, nullable=False, server_default="true"),
        )
    if "followup_cadence_days" not in existing_columns:
        # INT[] of day-offsets, e.g. {1,3,7,14} — "Day 1, 3, 7, 14" in the UI.
        # Stored as a real array (not CSV text) so it round-trips through
        # Postgres unambiguously and the frontend can render/edit it as a
        # list without a parsing step.
        op.add_column(
            "sales_agent_config",
            sa.Column(
                "followup_cadence_days",
                postgresql.ARRAY(sa.Integer),
                nullable=False,
                server_default="{1,3,7,14}",
            ),
        )
    if "monthly_revenue_target" not in existing_columns:
        # NUMERIC, not FLOAT: this is money, same reasoning as leads.deal_value
        # elsewhere in this codebase. NULL = "no target set yet" — the
        # Forecasting tab's gap-analysis card shows its own CTA rather than
        # inventing a target, same pattern as deal_value_field/pipeline_value.
        op.add_column(
            "sales_agent_config",
            sa.Column("monthly_revenue_target", sa.Numeric(14, 2), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("sales_agent_config", "monthly_revenue_target")
    op.drop_column("sales_agent_config", "followup_cadence_days")
    op.drop_column("sales_agent_config", "require_approval")
    op.drop_column("sales_agent_config", "max_followup_attempts")
    op.drop_column("sales_agent_config", "min_hot_score")
