#!/bin/bash
# =====================================================================
# Quick Startup Script
# This script starts the application and ensures seed data is loaded
# Usage: ./scripts/startup.sh
# =====================================================================

set -e

echo "🚀 Starting Lead Automation V2..."
echo ""

# Start Docker containers
echo "📦 Starting Docker containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Ensure seed data is loaded
echo ""
echo "🌱 Ensuring seed data is loaded..."
./scripts/ensure-seed-data.sh

echo ""
echo "🎉 Application is ready!"
echo "📝 Access the application at: http://localhost:3000"
echo "🔐 Login with:"
echo "   - admin@electrobtech.com / Admin@123"
echo "   - superadmin@platform.local / SuperAdmin@123"