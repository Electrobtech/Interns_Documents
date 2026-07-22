#!/bin/sh
set -e

echo "==> Running Alembic migrations..."
alembic upgrade head

echo "==> Starting ai-agent service on port 4005..."
exec uvicorn app.main:app --host 0.0.0.0 --port 4005
