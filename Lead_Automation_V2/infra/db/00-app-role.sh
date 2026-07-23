#!/usr/bin/env bash
# =====================================================================
# Creates a second, ordinary (non-superuser) Postgres role that every
# service connects as, so Row-Level Security policies actually apply.
#
# Postgres NEVER enforces RLS against a table's owner or against a
# superuser — FORCE ROW LEVEL SECURITY extends enforcement to the owner,
# but nothing extends it to superusers. The official postgres/pgvector
# Docker images make POSTGRES_USER a superuser on initdb, so if services
# connected as that role every RLS policy in rls.sql would silently do
# nothing.
#
#   POSTGRES_USER (default "lead")  -> stays admin/migration-only; loads
#                                       schema.sql / seed.sql / rls.sql.
#   app_user                        -> what every service's DATABASE_URL
#                                       actually points at (docker-compose.yml).
#
# Runs as a docker-entrypoint-initdb.d script. Files in that directory
# run in filename order, hence the "00-" prefix — this must exist before
# 03-rls.sql runs (see that file's GRANTs), and schema.sql/seed.sql
# (01-/02-) don't depend on it either way.
# =====================================================================
set -euo pipefail

APP_DB_USER="${APP_DB_USER:-app_user}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:-apppass}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_DB_USER}') THEN
      CREATE ROLE ${APP_DB_USER} WITH LOGIN PASSWORD '${APP_DB_PASSWORD}'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
  END
  \$\$;

  GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_DB_USER};
SQL

echo "app_user role ready (non-superuser, NOBYPASSRLS)."