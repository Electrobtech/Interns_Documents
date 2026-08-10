"""Shared fixtures for the sales-agent test suite.

Runs against a real Postgres database (the same one Alembic migrates),
not sqlite/mocks — sales_agent_config/runs use jsonb + integer[] columns
that don't behave identically on sqlite, and the point of these tests is
to catch exactly the class of bug that only shows up against real Postgres
semantics (COALESCE-vs-Ellipsis partial updates, numeric() rounding, etc).

Each test gets its own throwaway organization (+ a user + two leads),
created directly via SQL and cleaned up in a fixture teardown, so tests
never depend on or mutate the shared seed.sql data and can run in any
order without stepping on each other.
"""
from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config.settings import get_settings
from app.core.security import AuthUser, get_current_user
from app.database.tenant_scope import get_scoped_session
from app.main import app

pytestmark = pytest.mark.asyncio


@dataclass
class TestOrg:
    org_id: uuid.UUID
    user_id: uuid.UUID
    lead_open_id: uuid.UUID  # qualified, deal_value=28000
    lead_won_id: uuid.UUID  # won, deal_value=60000, 7-day created->closed cycle


@pytest_asyncio.fixture
async def engine():
    # Function-scoped (not session-scoped): pytest-asyncio gives each test
    # its own event loop by default, and an asyncpg engine/pool created on
    # one loop raises "Future attached to a different loop" if reused on
    # another. Recreating the engine per test costs a little connection
    # overhead but is what actually works without pinning a custom
    # session-wide event loop policy.
    #
    # Uses get_settings().DATABASE_URL directly (not the app_user role that
    # is now the *production* default as of 0007_enable_rls/RLS wiring) --
    # this fixture does raw admin-style setup (INSERT INTO organizations
    # directly, bypassing the app layer entirely), not a real tenant
    # request, so it needs the owner/superuser role to avoid tripping the
    # very RLS policies this session enabled. Run this suite with
    # DATABASE_URL pointed at the owner role (`lead`), same as
    # MIGRATION_DATABASE_URL elsewhere -- e.g.:
    #   DATABASE_URL=postgresql+asyncpg://lead:leadpass@localhost:5432/lead_automation pytest
    # Tenant-scoped RLS behavior itself is exercised live (see
    # docs/MULTI_TENANT_RLS.md §4), not by this suite.
    eng = create_async_engine(get_settings().DATABASE_URL, pool_pre_ping=True)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def org(engine) -> AsyncIterator[TestOrg]:
    """A fresh, isolated organization + a real user row (so log_audit's FK
    on user_id is satisfied) + two leads, cleaned up after the test."""
    ids = TestOrg(
        org_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        lead_open_id=uuid.uuid4(),
        lead_won_id=uuid.uuid4(),
    )
    contact_open, contact_won = uuid.uuid4(), uuid.uuid4()
    Session = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with Session() as session:
        await session.execute(
            text("INSERT INTO organizations (id, name, slug) VALUES (:id, :name, :slug)"),
            {"id": ids.org_id, "name": f"Test Org {ids.org_id}", "slug": f"test-org-{ids.org_id}"},
        )
        await session.execute(
            text(
                "INSERT INTO users (id, organization_id, name, email, password_hash) "
                "VALUES (:id, :org, 'Test User', :email, 'x')"
            ),
            {"id": ids.user_id, "org": ids.org_id, "email": f"{ids.user_id}@test.local"},
        )
        for cid, name in ((contact_open, "Open Contact"), (contact_won, "Won Contact")):
            await session.execute(
                text(
                    "INSERT INTO contacts (id, organization_id, name, source) "
                    "VALUES (:id, :org, :name, 'webchat')"
                ),
                {"id": cid, "org": ids.org_id, "name": name},
            )
        await session.execute(
            text(
                "INSERT INTO leads (id, organization_id, contact_id, stage, score, deal_value, created_at, updated_at) "
                "VALUES (:id, :org, :contact, 'qualified', 60, 28000, now(), now())"
            ),
            {"id": ids.lead_open_id, "org": ids.org_id, "contact": contact_open},
        )
        await session.execute(
            text(
                "INSERT INTO leads (id, organization_id, contact_id, stage, score, deal_value, created_at, updated_at) "
                "VALUES (:id, :org, :contact, 'won', 95, 60000, now() - interval '25 days', now() - interval '18 days')"
            ),
            {"id": ids.lead_won_id, "org": ids.org_id, "contact": contact_won},
        )
        await session.commit()
    yield ids
    async with Session() as session:
        # sales_agent_config.organization_id has NO foreign key back to
        # organizations (confirmed live: `\d sales_agent_config` shows only
        # a PK, no FK/cascade) — deleting the org alone leaves an orphaned
        # config row behind forever. Clean it up explicitly rather than
        # relying on a cascade that doesn't exist; see this session's
        # findings for the same gap's broader implications (no RLS either).
        await session.execute(
            text("DELETE FROM sales_agent_config WHERE organization_id = :id"), {"id": ids.org_id}
        )
        await session.execute(text("DELETE FROM organizations WHERE id = :id"), {"id": ids.org_id})
        await session.commit()


def _make_client(engine, organization_id: uuid.UUID, user_id: uuid.UUID) -> AsyncClient:
    Session = async_sessionmaker(bind=engine, expire_on_commit=False)

    async def _override_scoped_session() -> AsyncIterator[AsyncSession]:
        # Test double for get_scoped_session (app/database/tenant_scope.py).
        # No SET LOCAL/set_config needed here: `engine` (see fixture above)
        # connects as the owner/superuser role for this suite, which RLS
        # never applies to regardless of GUCs -- the override only needs to
        # hand routes a working session bound to the test org's data, same
        # as it did pre-RLS when this overrode get_session directly.
        async with Session() as session:
            yield session

    def _override_user() -> AuthUser:
        return AuthUser(
            user_id=str(user_id),
            organization_id=str(organization_id),
            role="admin",
            permissions=["ai_agents:manage"],
        )

    app.dependency_overrides[get_scoped_session] = _override_scoped_session
    app.dependency_overrides[get_current_user] = _override_user
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest_asyncio.fixture
async def client(engine, org: TestOrg) -> AsyncIterator[AsyncClient]:
    """Authenticated test client for `org`, wired to the real DB via
    dependency overrides (no JWT signing, no HTTP server needed)."""
    async with _make_client(engine, org.org_id, org.user_id) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_unregistered_user(engine, org: TestOrg) -> AsyncIterator[AsyncClient]:
    """Same org, but authenticated as a user_id that does NOT exist in the
    `users` table — deliberately reproduces the log_audit FK-violation path,
    for test_audit_fk_failure_does_not_break_the_request."""
    async with _make_client(engine, org.org_id, uuid.uuid4()) as ac:
        yield ac
    app.dependency_overrides.clear()
