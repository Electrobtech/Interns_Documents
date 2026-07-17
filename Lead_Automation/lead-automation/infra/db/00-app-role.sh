#!/bin/bash
# infra/db/00-app-role.sh
#
# Row-Level Security is a no-op for superusers and table owners (Postgres
# always lets them through, FORCE ROW LEVEL SECURITY notwithstanding for
# superusers) — and POSTGRES_USER in the official postgres image is granted
# superuser by initdb. So if the app connected as POSTGRES_USER, every RLS
# policy in rls.sql would silently do nothing.
#
# This creates a second, ordinary (non-superuser) role — app_user — that
# the application actually connects as. POSTGRES_USER remains an
# admin/migration role, used only to load schema.sql/seed.sql/rls.sql.
#
# Runs automatically via docker-entrypoint-initdb.d (before schema.sql,
# hence the 00- prefix) — table grants happen later, in rls.sql, once the
# tables actually exist.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
      CREATE ROLE app_user WITH LOGIN PASSWORD '${APP_DB_PASSWORD:-apppass}'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
  END
  \$\$;
EOSQL
