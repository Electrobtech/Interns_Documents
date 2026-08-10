"""Python equivalent of shared/src/db.js's withTenantScope()/withSystemAccess().

See docs/MULTI_TENANT_RLS.md §3.1 — ai-agent-backend previously had no
session-GUC scoping at all, so RLS policies on its tables would be a no-op
even once added, because there was nothing to set app.current_org.

REVISION NOTE (post-launch): the first version of this module set
app.current_org as a session-level GUC (`set_config(..., false)`),
committed immediately, and manually cleared it in a `finally` block before
the connection returned to the pool. That was live-verified correct under
light sequential load, but broke under concurrency: a real click-through
test (Settings tab, "Save targets") reproducibly hit
`InsufficientPrivilegeError: new row violates row-level security policy`
on an INSERT whose organization_id plainly matched the request's own
token, with 10 concurrent requests in flight. Root cause never fully
isolated (asyncpg + SQLAlchemy async pool internals around session-level
GUC commits are hard to reason about precisely), but the fix doesn't
require knowing the exact mechanism: don't rely on a manually-committed,
manually-cleared, connection-lifetime GUC at all.

This version binds app.current_org to Postgres's own transaction lifecycle
instead, via `SET LOCAL` fired on every `after_begin` event on this
session. `SET LOCAL` auto-resets at COMMIT/ROLLBACK, so:
  - it's automatically re-applied after a route's own mid-handler
    session.commit() triggers a new autobegin transaction for later
    queries (the exact case that ruled out SET LOCAL in the original
    design — see git history) — after_begin fires again, no gap.
  - there is no leaked state to clear before the connection returns to the
    pool: a transaction-scoped setting cannot outlive its transaction, so
    the manual "clear before checkin" step (the actual source of the race)
    is no longer needed at all.
"""
from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser, get_current_user
from app.database.session import _SessionLocal, get_session

logger = logging.getLogger(__name__)


def _bind_guc(session: AsyncSession, *, org: str | None, bypass: bool) -> None:
    """Registers an after_begin listener on this session's underlying sync
    Session so every transaction -- the first one and any later one started
    by a mid-route session.commit() -- gets `SET LOCAL app.current_org`
    (and app.rls_bypass, for with_system_access) applied automatically.
    Runs synchronously inside SQLAlchemy's begin machinery, so it must use
    `connection.exec_driver_sql`, not an awaited call.
    """
    sync_session = session.sync_session

    def _after_begin(sess, transaction, connection):
        # set_config(..., true) is the parameterizable equivalent of
        # `SET LOCAL key = value` -- Postgres's SET/SET LOCAL statement
        # form does NOT accept a bind parameter for the value (it must be
        # a literal), so this has to go through the function form instead.
        # exec_driver_sql bypasses SQLAlchemy's own paramstyle translation
        # (that's the point -- it talks to the DBAPI driver directly), so
        # the placeholder has to match what asyncpg itself expects: `$1`
        # positional, not the `%s` pyformat SQLAlchemy normally compiles to.
        if org is not None:
            connection.exec_driver_sql(
                "SELECT set_config('app.current_org', $1, true)", (org,)
            )
        if bypass:
            connection.exec_driver_sql(
                "SELECT set_config('app.rls_bypass', 'on', true)"
            )

    event.listen(sync_session, "after_begin", _after_begin)
    # Stash so it can be removed on the way out -- event.listen leaks a
    # reference to `_after_begin` on `sync_session` forever otherwise, and
    # sync_session instances get reused/pooled by the ORM in ways that
    # would let one request's listener quietly fire for a later request.
    session._tenant_scope_listener = (sync_session, _after_begin)  # type: ignore[attr-defined]


def _unbind_guc(session: AsyncSession) -> None:
    binding = getattr(session, "_tenant_scope_listener", None)
    if binding is None:
        return
    sync_session, fn = binding
    try:
        event.remove(sync_session, "after_begin", fn)
    except Exception:  # noqa: BLE001 - best-effort; a leaked listener on a
        # session object that's about to be garbage-collected anyway (it
        # dies with the request) is far less bad than raising here and
        # masking the route's real response/exception.
        logger.exception("[tenant_scope] failed to remove after_begin listener")


async def get_scoped_session(
    user: AuthUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AsyncIterator[AsyncSession]:
    """FastAPI dependency -- drop-in replacement for `Depends(get_session)`
    on every tenant-scoped route. Pins `session` to the caller's
    organization for the lifetime of the request (every transaction on it,
    not just the first) via `SET LOCAL app.current_org`, so Postgres RLS
    policies restrict every read/write to that tenant's rows even if a
    query is missing its own `WHERE organization_id = ...` clause.

    Called automatically wherever a route depends on this instead of
    `get_session` directly -- routes should not need to think about tenant
    scoping themselves, same as the Node services.
    """
    _bind_guc(session, org=str(user.organization_id), bypass=False)
    try:
        yield session
    finally:
        _unbind_guc(session)


@asynccontextmanager
async def with_system_access() -> AsyncIterator[AsyncSession]:
    """Python equivalent of withSystemAccess() -- the *only* sanctioned way
    for ai-agent-backend code to cross tenant boundaries. Sets
    app.rls_bypass = 'on' instead of a tenant id.

    As of this writing there are no call sites: every ai-agent-backend
    endpoint is tenant-scoped (see module docstring -- get_session is only
    ever used from app/api/v1/*.py, all of which sit behind
    get_current_user/require_permission). If a genuinely cross-tenant path
    is added later (a platform-admin endpoint, a cross-org scheduled job),
    use this and leave an inline comment justifying why, per
    docs/MULTI_TENANT_RLS.md §2.5 -- don't reach for get_session directly
    to route around RLS.
    """
    async with _SessionLocal() as session:
        _bind_guc(session, org=None, bypass=True)
        try:
            yield session
        finally:
            _unbind_guc(session)
