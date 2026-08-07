# Multi-Tenant Row-Level Security

> This file was referenced from 9 places across the codebase
> (`shared/src/db.js`, `infra/db/rls.sql`, `docker-compose.yml`, and
> several `services/auth-service` controllers) but didn't exist on disk.
> Restored to match what's actually implemented in `infra/db/rls.sql` as
> of this writing, plus an honest accounting of what it doesn't cover yet.

## 1. Why this exists

Every service's application code already filters queries by
`organization_id`. That's fine until it isn't — one missed `WHERE` clause,
in any of the ~10 services in this repo, and one tenant can read or write
another tenant's data. Postgres Row-Level Security (RLS) is a database-level
backstop: it makes the database itself reject rows that don't belong to the
caller's current tenant, regardless of what the query says, so an
application bug fails **closed** (zero rows) instead of leaking data.

## 2. How it works

### 2.1 Session GUCs

Two Postgres session variables carry tenant context on a connection:

- `app.current_org` — the tenant's UUID for this request.
- `app.rls_bypass` — `'on'` for the (small, audited) set of code paths that
  legitimately need to cross tenant boundaries.

`infra/db/rls.sql` defines two SQL functions that read them:

```sql
app_current_org()  -- NULL if app.current_org was never set
app_rls_bypass()   -- true only if app.rls_bypass = 'on'
```

`app_current_org()` returning `NULL` on an unscoped connection is the
fail-closed case: no policy predicate ever matches `NULL`, so a connection
that forgot to set a tenant sees zero rows instead of everything.

### 2.2 Setting the GUCs — `shared/src/db.js`

Node services never set these directly; they go through two helpers:

- **`withTenantScope(organizationId, fn)`** — checks out one connection,
  runs `SELECT set_config('app.current_org', $1, false)`, runs `fn` on
  that connection, then explicitly clears both GUCs before the connection
  goes back to the pool (`pg`'s pool is connection-reusing, so a leftover
  `app.current_org` from a previous request would silently scope the next
  one otherwise).
- **`withSystemAccess(fn)`** — sets `app.rls_bypass = 'on'` instead of a
  tenant id. This is the *only* sanctioned way to cross tenant boundaries.
  Find every call site with:
  ```
  grep -rn "withSystemAccess" --include="*.js" services/ shared/
  ```
  Each call site should have a comment justifying why it needs
  cross-tenant access (e.g. platform-admin endpoints, the super-admin
  login path, scheduled jobs that operate across orgs).

### 2.3 Policies — `infra/db/rls.sql`

Runs as `03-rls.sql`, after `01-schema.sql` and `02-seed.sql` (Docker
entrypoint scripts run in filename order) and after `00-app-role.sh` has
created the non-superuser `app_user` role.

- `organizations` gets a policy scoped on `id` (it *is* the tenant
  boundary, not a tenant-scoped child of one).
- Every standard `organization_id`-scoped table (the full list is in
  `rls.sql`'s `DO $$ ... FOREACH t IN ARRAY [...]` block — `users`,
  `leads`, `campaigns`, `conversations`, `invoices`, etc.) gets an
  identical `tenant_isolation` policy:
  `USING (app_rls_bypass() OR organization_id = app_current_org())`,
  with the matching `WITH CHECK` so it's enforced on writes too.
- Tables with no `organization_id` column of their own but that hang off
  an org-scoped parent (`campaign_audiences`, `campaign_recipients`) get
  an `EXISTS`-against-the-parent policy instead of a duplicated column.
- `ALTER TABLE ... FORCE ROW LEVEL SECURITY` is used everywhere, not just
  `ENABLE` — `FORCE` is what makes the policy apply even to the table's
  *owner*. Without it, RLS is silently skipped for the owning role.

### 2.4 Who RLS actually applies to

RLS is **never** enforced against a table's owner or a superuser, no
matter how many policies exist. `03-rls.sql`'s DDL runs as
`POSTGRES_USER` (the table owner / migration role) — table ownership
stays there. The actual isolation only takes effect for connections made
as `app_user`: a real non-superuser, non-owner role with `NOBYPASSRLS`
(see `00-app-role.sh`), which is what every Node service's `DATABASE_URL`
in `docker-compose.yml` connects as.

**Concretely: if a service connects as anything other than `app_user`
(the table owner, a superuser, or a `BYPASSRLS` role), every RLS policy
in this file is a no-op for that service — the policies exist in the
schema but are never evaluated.**

### 2.5 Call sites using `withSystemAccess` (cross-tenant bypass)

As of this writing: the super-admin login path
(`verificationController.js`), org-creation during self-registration
(`companyController.js`, before the new org's own `organization_id`
exists to scope against), and a couple of PIN-reset/auth bootstrap paths
in `auth-service/src/index.js` and `pinController.js`. Each call site has
an inline comment pointing back here — grep for `withSystemAccess` (per
2.2) to get the current, authoritative list; don't treat this paragraph
as the source of truth if it drifts from the code.

## 3. Known, intentional gaps

`rls.sql`'s own end-of-file comment block is the authoritative list for
individual tables with no `organization_id` to enforce against yet
(`linkedin_approvals`, `linkedin_sync_logs`, `throttle_counters`,
`platform_admins`). This section covers the one **platform-wide** gap
found live during the Sales Agent feature work (2026-08):

### 3.1 `ai-agent-backend` is not wired into this model at all

Every table added by `ai-agent-backend`'s own Alembic migrations
(0001-0006 — knowledge sources, RAG chunks, sales/marketing/support agent
config and run logs, `sales_agent_config`, etc.) sits in the **same**
Postgres database as the tables above, but:

- None of them have RLS policies (`ENABLE`/`FORCE ROW LEVEL SECURITY`
  was never run against them).
- The service's `DATABASE_URL` (`app/config/settings.py`,
  `app/database/session.py`) connects as `lead` — the migration/owner
  role — not `app_user`.
- There is no Python equivalent of `withTenantScope`/`withSystemAccess`:
  no per-request `SET LOCAL app.current_org`, no session GUC of any kind.
  Every query is scoped by application-level `WHERE organization_id = ...`
  only, the same "one missed WHERE clause away from a leak" situation
  §1 describes RLS as a backstop against — except here there's no backstop.

**Practical consequence:** even if RLS policies were added to
`ai-agent-backend`'s tables today, they would have **zero effect** as
long as the service keeps connecting as `lead`. `lead` is either the
table owner or a superuser (depending on environment) — RLS is never
enforced against either, `FORCE ROW LEVEL SECURITY` notwithstanding. This
is why migration `0006_sales_agent_config_fk.py` (adding the missing FK
from `sales_agent_config.organization_id` to `organizations.id`)
deliberately did **not** also enable RLS on that table — doing so without
first giving `ai-agent-backend` its own tenant-scoping connection layer
would be cosmetic at best and misleading at worst.

**Fixing this properly requires**, roughly in order:
1. A Python equivalent of `withTenantScope`/`withSystemAccess` — an
   async context manager that runs `SET LOCAL app.current_org` (and,
   for the narrow set of legitimate cross-tenant paths, `app.rls_bypass`)
   on the SQLAlchemy session/connection at the start of each request.
2. Switching `ai-agent-backend`'s `DATABASE_URL` to connect as `app_user`
   (or an equivalent non-owner, non-superuser, `NOBYPASSRLS` role)
   instead of the migration role.
3. Only then, enabling `ENABLE`/`FORCE ROW LEVEL SECURITY` with the same
   `tenant_isolation` policy pattern as §2.3 on every `organization_id`-
   scoped table this service owns.

This is tracked as a follow-up, not fixed in the sales-agent changeset —
it's a pre-existing gap across the entire `ai-agent-backend` service, not
something introduced by (or scoped to) that feature.

## 4. Verification procedure

To confirm RLS is actually doing something (not just present in the
schema) after any change to `rls.sql` or to which role a service connects
as:

```sql
-- 1. Confirm FORCE is set, not just ENABLE, on every table that should have it:
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN ('leads', 'sales_agent_config', /* ... */);

-- 2. Confirm the connecting role is NOT the owner and NOT a superuser/bypassrls role:
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;

-- 3. As that role, with app.current_org unset, confirm a real cross-tenant
--    query returns zero rows (fail-closed), not an error or all rows:
SET ROLE app_user;
SELECT count(*) FROM leads;  -- should be 0 with app.current_org unset

-- 4. Then confirm it returns only the right tenant's rows once scoped:
SELECT set_config('app.current_org', '<some-real-org-uuid>', false);
SELECT count(*) FROM leads;  -- should match that org's actual lead count
```
