# =====================================================================
# Ensure Seed Data Script (PowerShell)
# This script should be run after docker-compose up to ensure
# seed data is present. It can be run multiple times safely.
# Usage: .\scripts\ensure-seed-data.ps1
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

Write-Host "Ensuring seed data is present..." -ForegroundColor Cyan
Write-Host "Host: ${POSTGRES_HOST}:${POSTGRES_PORT}" -ForegroundColor Gray
Write-Host "Database: ${POSTGRES_DB}" -ForegroundColor Gray
Write-Host "User: ${POSTGRES_USER}" -ForegroundColor Gray
Write-Host ""

# Set PGPASSWORD environment variable for psql
$env:PGPASSWORD = $POSTGRES_PASSWORD

# Wait for PostgreSQL to be ready
Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
while ($true) {
    try {
        $null = psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c '\q' 2>&1
        Write-Host "Connected to database" -ForegroundColor Green
        break
    } catch {
        Write-Host "PostgreSQL not ready yet, waiting 2 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

# Check if users table exists and has data
$USER_COUNT = psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM users;" 2>&1
$USER_COUNT = $USER_COUNT.Trim()
# Parse the output properly - handle array or string
if ($USER_COUNT -is [array]) {
    $USER_COUNT = $USER_COUNT[0].Trim()
}
$USER_COUNT = [int]$USER_COUNT

if ($USER_COUNT -eq 0) {
    Write-Host "No seed data found. Running seed scripts..." -ForegroundColor Yellow
    
    # Run seed files
    psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -f ./infra/db/seed.sql
    psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -f ./infra/db/marketing_hub_seed.sql
    
    Write-Host "Seed data loaded successfully!" -ForegroundColor Green
} else {
    Write-Host "Seed data already exists (found $USER_COUNT users)." -ForegroundColor Green
}

Write-Host ""
Write-Host "You can now login with:" -ForegroundColor Cyan
Write-Host "   - admin@electrobtech.com / Admin@123" -ForegroundColor White
Write-Host "   - superadmin@platform.local / SuperAdmin@123" -ForegroundColor White