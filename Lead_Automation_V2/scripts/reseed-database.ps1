# =====================================================================
# Re-seed Database Script (PowerShell)
# This script re-runs the seed files on an existing database
# Usage: .\scripts\reseed-database.ps1
# =====================================================================

$ErrorActionPreference = "Stop"

# Load environment variables
if (Test-Path .env) {
    Get-Content .env | Where-Object { $_ -notmatch '^#' -and $_ -match '=' } | ForEach-Object {
        $key, $value = $_ -split '=', 2
        Set-Item -Path "env:$key" -Value $value
    }
}

# Default values if not set in .env
$POSTGRES_USER = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "lead" }
$POSTGRES_PASSWORD = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "leadpass" }
$POSTGRES_DB = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "lead_automation" }
$POSTGRES_HOST = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "localhost" }
$POSTGRES_PORT = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5435" }

Write-Host "Re-seeding database..." -ForegroundColor Cyan
Write-Host "Host: ${POSTGRES_HOST}:${POSTGRES_PORT}" -ForegroundColor Gray
Write-Host "Database: ${POSTGRES_DB}" -ForegroundColor Gray
Write-Host "User: ${POSTGRES_USER}" -ForegroundColor Gray
Write-Host ""

# Set PGPASSWORD environment variable for psql
$env:PGPASSWORD = $POSTGRES_PASSWORD

# Check if PostgreSQL is accessible
try {
    $null = psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c '\q' 2>&1
    Write-Host "Connected to database" -ForegroundColor Green
} catch {
    Write-Host "Cannot connect to PostgreSQL. Please ensure Docker is running and the database is accessible." -ForegroundColor Red
    exit 1
}

# Re-run seed files
Write-Host "Running Main seed data..." -ForegroundColor Yellow
psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -f ./infra/db/seed.sql
Write-Host "Main seed data completed" -ForegroundColor Green

Write-Host "Running Marketing Hub seed data..." -ForegroundColor Yellow
psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -f ./infra/db/marketing_hub_seed.sql
Write-Host "Marketing Hub seed data completed" -ForegroundColor Green

Write-Host ""
Write-Host "Database re-seeded successfully!" -ForegroundColor Green
Write-Host "You can now login with:" -ForegroundColor Cyan
Write-Host "   - admin@electrobtech.com / Admin@123" -ForegroundColor White
Write-Host "   - superadmin@platform.local / SuperAdmin@123" -ForegroundColor White
