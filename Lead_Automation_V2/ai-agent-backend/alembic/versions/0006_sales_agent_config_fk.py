"""sales_agent_config — add missing FK to organizations.

Closes half of a gap found live this session: `sales_agent_config` had a
primary key but zero foreign-key constraints at all — `organization_id`
was an unconstrained UUID column, so a bad or deleted org id could sit in
this table forever with nothing enforcing referential integrity (unlike
every other org-scoped table, e.g. `leads.organization_id`, which cascades
on org delete). `tests/test_sales_config.py::test_sales_agent_config_has_no_fk_to_organizations`
was written as a regression guard for the gap and should now be flipped to
assert the FK exists.

This does NOT add row-level security to the table. `sales_agent_config`
(and every other ai-agent-backend table from migrations 0001-0005) is only
ever queried by this service's own DATABASE_URL role, which is the
Postgres superuser/owner role (see docker-compose.yml / infra/db/00-app-role.sh)
with no per-request `SET LOCAL app.current_org` tenant-scoping layer
analogous to shared/src/db.js's withTenantScope in the Node services.
Force-enabling RLS here without that layer would be cosmetic — the
superuser role bypasses RLS unconditionally, so the policy would never
actually run. See docs/MULTI_TENANT_RLS.md for the full picture and why
this is tracked as a separate, platform-wide follow-up rather than solved
per-table.

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-07
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_FK_NAME = "sales_agent_config_organization_id_fkey"


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing_fks = {fk["name"] for fk in inspector.get_foreign_keys("sales_agent_config")}

    if _FK_NAME not in existing_fks:
        # Defensive: drop any sales_agent_config row whose organization_id
        # doesn't exist in organizations, so the ADD CONSTRAINT below can't
        # fail on real (if unlikely) orphaned data in an existing deployment.
        op.execute(
            "DELETE FROM sales_agent_config s "
            "WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = s.organization_id)"
        )
        op.create_foreign_key(
            _FK_NAME,
            "sales_agent_config",
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing_fks = {fk["name"] for fk in inspector.get_foreign_keys("sales_agent_config")}
    if _FK_NAME in existing_fks:
        op.drop_constraint(_FK_NAME, "sales_agent_config", type_="foreignkey")
