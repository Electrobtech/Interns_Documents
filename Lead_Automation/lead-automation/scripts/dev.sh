#!/usr/bin/env bash
# Run the whole backend locally (no Docker): all 10 services + the API gateway.
# Each service connects to the local Postgres and shares one JWT secret so tokens
# issued by auth-service verify everywhere. Ctrl-C stops all of them.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Shared env for every service. We deliberately do NOT export the *_SERVICE_URL
# vars from .env (those point at Docker hostnames) — the gateway falls back to
# its localhost:400x defaults, which is what we want for local runs.
export DATABASE_URL="${DATABASE_URL:-postgres://lead:leadpass@localhost:5432/lead_automation}"
export JWT_SECRET="${JWT_SECRET:-dev-secret}"
export JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-1d}"

echo "DATABASE_URL=$DATABASE_URL"
echo "Starting backend… (Ctrl-C to stop all)"
echo ""

# Stop every child process on exit.
trap 'echo; echo "Stopping…"; kill 0' SIGINT SIGTERM EXIT

start() { # label  path-to-index.js
  ( node "$ROOT/$2" 2>&1 | sed "s/^/[$1] /" ) &
}

start auth        services/auth-service/src/index.js
start inbox       services/inbox-service/src/index.js
start contact     services/contact-service/src/index.js
start campaign    services/campaign-service/src/index.js
start ai          services/ai-service/src/index.js
start ecommerce   services/ecommerce-service/src/index.js
start review      services/review-service/src/index.js
start analytics   services/analytics-service/src/index.js
start integration services/integration-service/src/index.js
start team        services/team-service/src/index.js
start gateway     api-gateway/src/index.js

wait
