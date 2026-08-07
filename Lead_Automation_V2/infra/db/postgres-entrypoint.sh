#!/bin/bash
# =====================================================================
# Custom PostgreSQL Entrypoint
# This script extends the default postgres entrypoint to ensure
# seed data is always present, even when volumes persist.
# =====================================================================

set -e

# Run the default postgres entrypoint with PID 1
exec docker-entrypoint.sh "$@" &
POSTGRES_PID=$!

# Set environment variables with defaults
POSTGRES_USER=${POSTGRES_USER:-lead}
POSTGRES_DB=${POSTGRES_DB:-lead_automation}

# Wait for postgres to be ready
until pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}; do
    echo "Waiting for PostgreSQL to be ready..."
    sleep 2
done

echo "PostgreSQL is ready, checking seed data..."

# Run the check-and-reseed script
if [ -f /docker-entrypoint-initdb.d/05-check-and-reseed.sh ]; then
    chmod +x /docker-entrypoint-initdb.d/05-check-and-reseed.sh
    /docker-entrypoint-initdb.d/05-check-and-reseed.sh
else
    echo "Warning: check-and-reseed.sh not found"
fi

# Wait for the postgres process
wait $POSTGRES_PID