#!/usr/bin/env bash
# Create the lead_automation database + roles and load the schema, RLS
# policies, and seed data.
# Works with a local Postgres (Postgres.app OR the EnterpriseDB installer) — no Docker.
#
# It connects as the Postgres SUPERUSER (default: postgres) to create:
#   - 'lead'     — an admin/migration-only role, used only by this script
#   - 'app_user' — the ordinary, non-superuser role the app actually
#                  connects with (DATABASE_URL). This distinction matters:
#                  Postgres Row-Level Security (infra/db/rls.sql) is a no-op
#                  for superusers, so the app must NOT connect as one.
#
# You will be prompted once for the superuser password you set when installing
# PostgreSQL (set PGPASSWORD in the environment to skip the prompt).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPERUSER="${PGSUPERUSER:-postgres}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:-apppass}"

# Find psql: PATH first, then Postgres.app, then the EnterpriseDB install location.
PSQL="$(command -v psql || true)"
if [ -z "$PSQL" ]; then
  for p in /Applications/Postgres.app/Contents/Versions/latest/bin/psql \
           /Library/PostgreSQL/*/bin/psql; do
    [ -x "$p" ] && PSQL="$p" && break
  done
fi
if [ -z "$PSQL" ]; then
  echo "ERROR: psql not found. Is PostgreSQL installed and running?" >&2
  exit 1
fi
echo "Using psql: $PSQL"

# Ask for the superuser password once and reuse it for every psql call.
if [ -z "${PGPASSWORD:-}" ]; then
  read -r -s -p "Password for Postgres superuser '$SUPERUSER': " PGPASSWORD
  echo ""
  export PGPASSWORD
fi

ADMIN=("$PSQL" -h localhost -U "$SUPERUSER")

echo "Creating role 'lead' and database 'lead_automation' (ignore 'already exists')…"
"${ADMIN[@]}" -d postgres -c "CREATE ROLE lead WITH LOGIN PASSWORD 'leadpass' SUPERUSER;" 2>/dev/null || true
"${ADMIN[@]}" -d postgres -c "CREATE DATABASE lead_automation OWNER lead;" 2>/dev/null || true

echo "Creating non-superuser role 'app_user' for the app to actually connect as (ignore 'already exists')…"
"${ADMIN[@]}" -d postgres -c "CREATE ROLE app_user WITH LOGIN PASSWORD '${APP_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;" 2>/dev/null || true

echo "Loading schema…"
"${ADMIN[@]}" -d lead_automation -v ON_ERROR_STOP=1 -f "$ROOT/infra/db/schema.sql"
echo "Loading seed data…"
"${ADMIN[@]}" -d lead_automation -v ON_ERROR_STOP=1 -f "$ROOT/infra/db/seed.sql"
echo "Loading row-level security policies + app_user grants…"
"${ADMIN[@]}" -d lead_automation -v ON_ERROR_STOP=1 -f "$ROOT/infra/db/rls.sql"

echo ""
echo "✅ Database ready. Login: admin@electrobtech.com / Admin@123"
echo "   Set DATABASE_URL=postgres://app_user:${APP_DB_PASSWORD}@localhost:5432/lead_automation in your .env"
