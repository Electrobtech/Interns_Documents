"""Alembic async env — reads DATABASE_URL from environment (same as the app),
imports all ORM models so autogenerate detects them, and runs migrations
against the live database."""
from __future__ import annotations

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

# Make sure the app package is importable.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ---------------------------------------------------------------------------
# Import ALL models so Alembic's autogenerate picks them up.
# ---------------------------------------------------------------------------
from app.models.base import Base  # noqa: F401 — must come before model imports
from app.models.handoff import HandoffRequest  # noqa: F401
from app.models.knowledge import KnowledgeChunk, KnowledgeSource  # noqa: F401
from app.models.marketing import MarketingAgentRun  # noqa: F401
from app.models.provider_log import ProviderUsageLog  # noqa: F401
from app.models.sales import SalesAgentRun  # noqa: F401
from app.models.support import (  # noqa: F401
    AgentConversationTurn,
    AgentWebhook,
    SupportAgentRun,
)

# ---------------------------------------------------------------------------
# Alembic config object
# ---------------------------------------------------------------------------
config = context.config

# Override sqlalchemy.url from the environment at runtime.
# Normalise all common PostgreSQL URL forms to the asyncpg async driver scheme.
database_url = os.environ.get("DATABASE_URL", "")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
# If DATABASE_URL is not set, fall through to the alembic.ini value (already asyncpg).
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Offline mode (no live DB connection — just generates SQL)
# ---------------------------------------------------------------------------

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online mode (connects to the real DB)
# ---------------------------------------------------------------------------

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
