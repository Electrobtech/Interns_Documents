#!/bin/bash
# =====================================================================
# Re-seed Database Script
# This script re-runs the seed files on an existing database
# Usage: ./scripts/reseed-database.sh
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

echo "🔄 Re-seeding database..."
echo "Host: ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "Database: ${POSTGRES_DB}"
echo "User: ${POSTGRES_USER}"
echo ""

# Check if PostgreSQL is accessible
if ! PGPASSWORD=${POSTGRES_PASSWORD} psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c '\q' 2>/dev/null; then
    echo "❌ Cannot connect to PostgreSQL. Please ensure Docker is running and the database is accessible."
    exit 1
fi

echo "✅ Connected to database"

# Function to run SQL file
run_sql_file() {
    local file=$1
    local description=$2
    echo "📝 Running ${description}..."
    PGPASSWORD=${POSTGRES_PASSWORD} psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -f ${file}
    echo "✅ ${description} completed"
}

# Re-run seed files
run_sql_file "./infra/db/seed.sql" "Main seed data"
run_sql_file "./infra/db/marketing_hub_seed.sql" "Marketing Hub seed data"

echo ""
echo "🎉 Database re-seeded successfully!"
echo "📝 You can now login with:"
echo "   - admin@electrobtech.com / Admin@123"
echo "   - superadmin@platform.local / SuperAdmin@123"
