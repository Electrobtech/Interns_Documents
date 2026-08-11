"""Add sales_agent_config.product_targets — per-product monthly revenue
targets, closing the "Product-Section Breakdown & Product Targets" gap from
the Sales Agent capability review. Sibling to the existing org-wide
monthly_revenue_target column (0004_sales_agent_config), not a replacement
of it — see app/models/sales.py:SalesAgentConfig.product_targets for why
the two are kept independent rather than one deriving from the other.

Revision ID: 0008
Revises: 0007b
Create Date: 2026-08-08
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: Union[str, None] = "0007b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sales_agent_config",
        sa.Column(
            "product_targets",
            postgresql.JSONB,
            nullable=False,
            server_default="{}",
        ),
    )


def downgrade() -> None:
    op.drop_column("sales_agent_config", "product_targets")
