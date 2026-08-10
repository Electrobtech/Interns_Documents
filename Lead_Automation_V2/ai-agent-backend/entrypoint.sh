#!/bin/sh
set -e

echo "==> Running Alembic migrations..."
# alembic/env.py prefers MIGRATION_DATABASE_URL (owner role) over DATABASE_URL
# (app_user, non-owner) — DDL like ENABLE ROW LEVEL SECURITY needs the owner.
# See docs/MULTI_TENANT_RLS.md §3.1.
alembic upgrade head

echo "==> Starting ai-agent service on port 4005..."
exec uvicorn app.main:app --host 0.0.0.0 --port 4005
