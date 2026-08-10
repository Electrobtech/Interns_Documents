#!/bin/bash
# One cluster, one database per service (ADR-007) — no cross-schema grants.
set -e
for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
  echo "creating database $db"
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $db" || true
done
