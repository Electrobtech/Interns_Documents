"""Async engine + session factory, with Row-Level Security wiring.

This is layer 3 of tenant isolation (§17.2) — the one that holds even when
application code is wrong. Every session sets ``app.current_org_id`` for the
transaction; RLS policies on each tenant table compare against it.

Layers 1 and 2 (middleware, repository base) are application code and can be
bypassed by a raw SQL string or a clever optimization. This one cannot.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from ..config import BaseServiceSettings
from ..tenancy import current_tenant_optional

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_engine(settings: BaseServiceSettings) -> AsyncEngine:
    global _engine, _session_factory
    if _engine is not None:
        return _engine

    _engine = create_async_engine(
        settings.sqlalchemy_url,
        echo=settings.db_echo,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=True,  # survives Postgres restarts / idle connection reaping
        pool_recycle=1800,
    )
    _session_factory = async_sessionmaker(
        _engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )
    return _engine


def get_engine() -> AsyncEngine:
    if _engine is None:
        raise RuntimeError("init_engine() must be called during app startup")
    return _engine


async def dispose_engine() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None


async def _apply_rls(session: AsyncSession) -> None:
    """Bind the current tenant to the transaction for RLS policies.

    SET LOCAL scopes to the transaction, so a pooled connection cannot leak a
    previous request's org_id to the next one — which is exactly the bug this
    would otherwise introduce under PgBouncer.
    """
    ctx = current_tenant_optional()
    if ctx is None:
        return
    await session.execute(
        text("SELECT set_config('app.current_org_id', :org_id, true)"),
        {"org_id": str(ctx.org_id)},
    )


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Transactional session for workers and event consumers."""
    if _session_factory is None:
        raise RuntimeError("init_engine() must be called during app startup")

    async with _session_factory() as session:
        try:
            await _apply_rls(session)
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency. Commits on success, rolls back on any exception."""
    async with session_scope() as session:
        yield session


# ---------------------------------------------------------------------------
# RLS policy DDL — emitted by migrations
# ---------------------------------------------------------------------------

RLS_POLICY_TEMPLATE = """
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};
CREATE POLICY {table}_tenant_isolation ON {table}
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
"""


def rls_policy_sql(table: str) -> str:
    """DDL enabling tenant RLS on a table.

    FORCE is important: without it, the table owner (which migrations and often
    the app user are) bypasses the policy entirely, making RLS decorative.
    """
    return RLS_POLICY_TEMPLATE.format(table=table)


TENANT_TABLES_AUDIT_SQL = """
-- CI check (§17.2 layer 4): any table with an org_id column but no RLS policy.
-- Expected to return zero rows; a non-empty result fails the build.
SELECT c.relname AS table_without_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'org_id'
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity;
"""
