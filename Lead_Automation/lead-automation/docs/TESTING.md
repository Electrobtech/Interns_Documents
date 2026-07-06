# Testing Strategy

## Layers
- **Unit** — pure logic (lead scoring, JWT signing). Use Jest.
- **Integration** — service + Postgres. Spin up the DB via docker compose,
  run supertest against each service's Express app.
- **E2E** — Playwright against the Next.js frontend hitting the gateway.

## Manual smoke test (after `docker compose up`)
```bash
# 1. Login as the seeded admin
TOKEN=$(curl -s localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@electrobtech.com","password":"Admin@123"}' | jq -r .token)

# 2. Fetch contacts (tenant-scoped)
curl -s localhost:8080/contacts -H "Authorization: Bearer $TOKEN"

# 3. Fetch conversations
curl -s localhost:8080/conversations -H "Authorization: Bearer $TOKEN"
```
