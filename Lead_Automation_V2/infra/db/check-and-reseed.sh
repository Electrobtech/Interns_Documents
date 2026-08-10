#!/bin/bash
# =====================================================================
# Check and Re-seed Script
# This script runs on PostgreSQL container startup and checks if
# seed data exists. If tables are empty, it re-runs the seed files.
# =====================================================================

set -e

# Default values if environment variables not set
POSTGRES_USER=${POSTGRES_USER:-lead}
POSTGRES_DB=${POSTGRES_DB:-lead_automation}

# Wait for PostgreSQL to be ready
until pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}; do
    echo "Waiting for PostgreSQL to be ready..."
    sleep 2
done

echo "Checking if seed data exists..."

# Check if users table exists and has data
USER_COUNT=$(psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

if [ "$USER_COUNT" -eq "0" ]; then
    echo "No seed data found. Running seed scripts..."
    
    # Run seed files
    psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -f /docker-entrypoint-initdb.d/02-seed.sql
    psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -f /docker-entrypoint-initdb.d/03-marketing-hub-seed.sql
    
    echo "Seed data loaded successfully!"
else
    echo "Seed data already exists (found $USER_COUNT users). Skipping seed."
fi
