#!/bin/bash
# =====================================================================
# Ensure Seed Data Script
# This script should be run after docker-compose up to ensure
# seed data is present. It can be run multiple times safely.
# Usage: ./scripts/ensure-seed-data.sh
# =====================================================================

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Default values if not set in .env
POSTGRES_USER=${POSTGRES_USER:-lead}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-leadpass}
POSTGRES_DB=${POSTGRES_DB:-lead_automation}
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5435}

echo "🔄 Ensuring seed data is present..."
echo "Host: ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "Database: ${POSTGRES_DB}"
echo "User: ${POSTGRES_USER}"
echo ""

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until PGPASSWORD=${POSTGRES_PASSWORD} psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c '\q' 2>/dev/null; do
    echo "PostgreSQL not ready yet, waiting 2 seconds..."
    sleep 2
done

echo "✅ Connected to database"

# Check if users table exists and has data
USER_COUNT=$(PGPASSWORD=${POSTGRES_PASSWORD} psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

if [ "$USER_COUNT" -eq "0" ]; then
    echo "📝 No seed data found. Running seed scripts..."
    
    # Run seed files
    PGPASSWORD=${POSTGRES_PASSWORD} psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -f ./infra/db/seed.sql
    PGPASSWORD=${POSTGRES_PASSWORD} psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -f ./infra/db/marketing_hub_seed.sql
    
    echo "🎉 Seed data loaded successfully!"
else
    echo "✅ Seed data already exists (found $USER_COUNT users)."
fi

echo ""
echo "📝 You can now login with:"
echo "   - admin@electrobtech.com / Admin@123"
echo "   - superadmin@platform.local / SuperAdmin@123"