#!/bin/sh
set -e

echo "==> Running Alembic migrations..."
alembic upgrade head

echo "==> Starting AI Agent Support service on port 4023..."
exec uvicorn app.main:app --host 0.0.0.0 --port 4023