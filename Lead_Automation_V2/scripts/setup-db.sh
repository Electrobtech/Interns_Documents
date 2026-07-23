#!/usr/bin/env bash
# Create the lead_automation database + role and load the schema and seed data.
# Works with a local Postgres (Postgres.app OR the EnterpriseDB installer) — no Docker.
#
# It connects as the Postgres SUPERUSER (default: postgres) to create a 'lead' role
# and the 'lead_automation' database, then loads schema.sql + seed.sql.
#
# You will be prompted once for the superuser password you set when installing
# PostgreSQL (set PGPASSWORD in the environment to skip the prompt).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPERUSER="${PGSUPERUSER:-postgres}"

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

# Non-superuser role every service actually connects as. RLS (loaded below)
# is never enforced against a table's owner ('lead') or a superuser, so
# this role is what makes the policies actually do anything — see
# infra/db/rls.sql and docs/MULTI_TENANT_RLS.md.
echo "Creating role 'app_user' (ignore 'already exists')…"
"${ADMIN[@]}" -d postgres -c "CREATE ROLE app_user WITH LOGIN PASSWORD '${APP_DB_PASSWORD:-apppass}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;" 2>/dev/null || true
"${ADMIN[@]}" -d postgres -c "GRANT CONNECT ON DATABASE lead_automation TO app_user;" 2>/dev/null || true

echo "Loading schema…"
"${ADMIN[@]}" -d lead_automation -v ON_ERROR_STOP=1 -f "$ROOT/infra/db/schema.sql"
echo "Loading seed data…"
"${ADMIN[@]}" -d lead_automation -v ON_ERROR_STOP=1 -f "$ROOT/infra/db/seed.sql"
echo "Enabling row-level security…"
"${ADMIN[@]}" -d lead_automation -v ON_ERROR_STOP=1 -f "$ROOT/infra/db/rls.sql"

echo ""
echo "✅ Database ready. Login: admin@electrobtech.com / Admin@123"
echo "   Services should connect as app_user (see .env.example), not lead — RLS"
echo "   is not enforced against 'lead' since it owns the tables."