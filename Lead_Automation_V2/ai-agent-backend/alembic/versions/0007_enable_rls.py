"""Enable Row-Level Security on every ai-agent-backend table.

Closes docs/MULTI_TENANT_RLS.md §3.1, the platform-wide gap 0006's docstring
deliberately left open: ai-agent-backend's tables had no RLS, and adding it
without a tenant-scoping connection layer would have been cosmetic (the
service connected as `lead`, the table owner — RLS is never enforced
against a table's owner or a superuser, FORCE notwithstanding).

Both prerequisites from §3.1 are now in place:
  1. app/database/tenant_scope.py — a Python withTenantScope()/
     withSystemAccess() equivalent, wired into every route via
     get_scoped_session (see app/api/v1/*.py).
  2. This service's DATABASE_URL now points at `app_user`, the same
     non-superuser NOBYPASSRLS role every Node service already uses (see
     .env / docker-compose.yml) — NOT `lead`, the migration/owner role.
     `lead` still runs Alembic migrations, including this one; ownership of
     these tables is unchanged. Only the *runtime* DATABASE_URL moved.

Reuses app_current_org()/app_rls_bypass() from infra/db/rls.sql — those
functions already exist in this database (same Postgres instance, shared
schema) and are not redefined here. If this migration is ever run against
a fresh database where infra/db/rls.sql has not been applied yet, it will
fail loudly at the first ALTER TABLE ... FORCE ROW LEVEL SECURITY with a
clear "function app_current_org() does not exist" error rather than
silently skipping isolation — that's intentional; see the guard below.

Every table below carries its own `organization_id` column directly (see
alembic/versions/0001-0004), so all of them get the same policy shape as
infra/db/rls.sql's standard-tables loop, not the EXISTS-against-parent
variant. There is no ai-agent-backend equivalent of that variant to date
(e.g. knowledge_chunks has both organization_id AND a knowledge_source_id
FK — it's scoped on its own column, the FK is unrelated to RLS here).

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-07
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Every organization_id-scoped table this service's Alembic migrations own
# (0001-0006). Deliberately excludes nothing — see docs/MULTI_TENANT_RLS.md
# §3.1, which named this as a full-service gap, not a per-table one.
_TABLES = [
    "knowledge_sources",
    "knowledge_chunks",
    "marketing_agent_runs",
    "sales_agent_runs",
    "support_agent_runs",
    "agent_conversations",
    "agent_webhooks",
    "handoff_requests",
    "provider_usage_logs",
    "icp_personas",
    "seo_content_briefs",
    "campaign_plans",
    "competitor_reports",
    "aeo_optimizations",
    "ctwa_ad_packages",
    "sales_agent_config",
]


def upgrade() -> None:
    bind = op.get_bind()

    # Fail loudly rather than silently no-op if infra/db/rls.sql's helper
    # functions aren't present yet (see module docstring).
    exists = bind.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_current_org')"
        )
    ).scalar()
    if not exists:
        raise RuntimeError(
            "app_current_org() not found. Run infra/db/rls.sql (which defines "
            "it, alongside app_rls_bypass()) against this database before "
            "running this migration — see docs/MULTI_TENANT_RLS.md §2.3/§3.1."
        )

    for table in _TABLES:
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
        op.execute(f'DROP POLICY IF EXISTS tenant_isolation ON "{table}"')
        op.execute(
            f'CREATE POLICY tenant_isolation ON "{table}" '
            "USING (app_rls_bypass() OR organization_id = app_current_org()) "
            "WITH CHECK (app_rls_bypass() OR organization_id = app_current_org())"
        )


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f'DROP POLICY IF EXISTS tenant_isolation ON "{table}"')
        op.execute(f'ALTER TABLE "{table}" NO FORCE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY')
