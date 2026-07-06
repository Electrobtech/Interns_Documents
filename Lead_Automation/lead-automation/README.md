# Lead Automation — Full-Stack Microservices Platform
**Electrobtech Innovations Pvt Ltd** · Unified Customer Engagement & Revenue Platform

A microservices SaaS starter built to the attached wireframe & spec: multi-tenant,
role-based, real-time-ready inbox, AI-assist hooks, campaigns, ecommerce revenue,
reviews, analytics, integrations, and billing.

> **Scope note:** This repository is a *runnable, coherent foundation*, not a finished
> commercial product. It ships **fully working** Auth, Inbox, and Contact/Lead services
> behind an API gateway, the **complete database schema for every table** in the spec,
> and a **Next.js dashboard matching the wireframe**. The remaining 9 services
> (campaign, ai, ecommerce, review, analytics, notification, billing, integration,
> user/team) are scaffolded via a shared template and route pattern so they can be
> filled in without re-architecting anything.

## Architecture
```
                 ┌────────────┐
 Next.js  ─────► │ API Gateway│ ─┬─► auth-service      (register/login/JWT/RBAC)  ✅
 frontend        │  (:8080)   │  ├─► inbox-service      (conversations/messages)  ✅
                 └────────────┘  ├─► contact-service    (contacts/leads)          ✅
                                 └─► [campaign | ai | ecommerce | review |
                                      analytics | notification | billing | ...]   🧩 template
        Postgres (shared schema, org-isolated)   Redis (cache/queues)
```
- **Multi-tenant:** every table carries `organization_id`; every query is scoped by
  `req.user.organizationId` from the JWT.
- **Auth:** bcrypt + JWT, `admin/manager/agent` roles, `requireRole()` guard in `@lead/shared`.
- **Gateway:** single public entry point (`http-proxy-middleware`) with a route table.

## Stack
Frontend: Next.js 14, React 18, Tailwind, Recharts, lucide-react ·
Backend: Node + Express microservices, shared `pg` pool ·
Data: PostgreSQL 16, Redis 7 · Infra: Docker Compose, GitHub Actions CI.

## Quick start
```bash
cp .env.example .env          # adjust JWT_SECRET etc.
docker compose up --build     # postgres seeds schema + demo admin automatically
# gateway:   http://localhost:8080
# frontend:  cd frontend && npm install && npm run dev  -> http://localhost:3000
```
**Seeded login:** `admin@electrobtech.com` / `Admin@123`

## Repo layout
```
api-gateway/            Public entry point + proxy route table
services/
  auth-service/         ✅ register, login, profile, RBAC
  inbox-service/        ✅ conversations, messages, assign, status
  contact-service/      ✅ contacts + leads CRUD
  _template/            🧩 copy this to build the other services
shared/                 db pool + JWT/RBAC middleware (@lead/shared)
infra/db/               schema.sql (all spec tables) + seed.sql
frontend/               Next.js app — dashboard, login (wireframe theme)
docs/TESTING.md         test strategy + smoke tests
.github/workflows/      CI (install, build, docker build)
```

## Extending to the remaining services
1. `cp -r services/_template services/campaign-service`
2. Set name + port in `package.json`; implement routes in `src/index.js`
   (always scope by `req.user.organizationId`).
3. Add the path to the gateway route table in `api-gateway/src/index.js`.
4. Add a service block + Dockerfile to `docker-compose.yml`.

The schema, gateway, auth, and tenancy model already support all 12 modules —
new services are pure route/controller work on top of existing tables.

## API surface (implemented)
| Method | Path | Service |
|---|---|---|
| POST | /auth/register, /auth/login, /auth/logout | auth |
| GET | /auth/profile | auth |
| GET | /conversations, /conversations/:id | inbox |
| POST | /conversations/:id/reply | inbox |
| PUT | /conversations/:id/status, /:id/assign | inbox |
| GET/POST | /contacts, /contacts/:id | contact |
| PUT/DELETE | /contacts/:id | contact |
| GET | /leads · PUT /leads/:id/stage | contact |
