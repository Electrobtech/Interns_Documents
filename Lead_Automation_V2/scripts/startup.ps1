# =====================================================================
# Quick Startup Script (PowerShell)
# This script starts the application and ensures seed data is loaded
# Usage: .\scripts\startup.ps1
# =====================================================================

$ErrorActionPreference = "Stop"

Write-Host "Starting Lead Automation V2..." -ForegroundColor Cyan
Write-Host ""

# Start Docker containers
Write-Host "Starting Docker containers..." -ForegroundColor Yellow
docker-compose up -d

Write-Host ""
Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Ensure seed data is loaded
Write-Host ""
Write-Host "Ensuring seed data is loaded..." -ForegroundColor Yellow
& ".\scripts\ensure-seed-data.ps1"

Write-Host ""
Write-Host "Application is ready!" -ForegroundColor Green
Write-Host "Access the application at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Login with:" -ForegroundColor Cyan
Write-Host "   - admin@electrobtech.com / Admin@123" -ForegroundColor White
Write-Host "   - superadmin@platform.local / SuperAdmin@123" -ForegroundColor White