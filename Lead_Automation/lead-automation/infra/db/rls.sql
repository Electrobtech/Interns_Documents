-- infra/db/rls.sql
--
-- Row-Level Security (RLS): a database-level backstop for multi-tenant
-- isolation. Every service already filters queries by organization_id in
-- application code (`WHERE organization_id = $1`), but that's just SQL a
-- developer has to remember to write correctly on every single query,
-- forever. One missed WHERE clause in any of the ~10 services in this repo
-- and one tenant can read or write another tenant's data. RLS makes that
-- structurally impossible: Postgres itself rejects any row that doesn't
-- belong to the caller's current tenant, regardless of what the query says.
--
-- How the app talks to this:
--   - shared/src/db.js's withTenantScope(organizationId, fn) checks out a
--     dedicated connection, sets the `app.current_org` session variable on
--     it via set_config(), and runs `fn` with that connection pinned to the
--     current request (via AsyncLocalStorage) so every pool.query() call
--     made anywhere during the request transparently uses it.
--   - shared/src/auth.js's `authenticate` middleware calls withTenantScope
--     automatically for every authenticated request, using the org id from
--     the verified JWT — so no route handler needs to change.
--   - auth-service's /auth/register and /auth/login run *before* we know
--     which org a request belongs to (a user isn't scoped to one until
--     they've logged in), so they use withSystemAccess(fn) instead, which
--     sets `app.rls_bypass = on` for that connection only. This is the only
--     place in the codebase that's allowed to bypass tenant isolation, and
--     it's enforced by the policies below, not by convention.
--
-- IMPORTANT — table ownership & superusers: Postgres does NOT apply RLS to
-- a table's owner or to superusers, ever — FORCE ROW LEVEL SECURITY only
-- extends enforcement to the owner, and nothing extends it to superusers.
-- The official postgres Docker image's POSTGRES_USER is a superuser, so if
-- the app connected as that role, every policy below would silently do
-- nothing. That's why infra/db/00-app-role.sh creates a second, ordinary
-- role (`app_user`, NOSUPERUSER) that the application's DATABASE_URL
-- actually points at — see the GRANTs for it at the bottom of this file.
-- POSTGRES_USER remains an admin/migration-only role.
--
-- Run this after schema.sql (or after infra/db/migrations/002_media_and_replies.sql
-- if you're upgrading an existing database).

-- ---------------------------------------------------------------------
-- Helper: is the current connection scoped to a tenant right now?
-- ---------------------------------------------------------------------
-- current_setting(..., true) returns NULL (not an error) when the GUC was
-- never set on this connection — e.g. background jobs, migrations, or
-- anything that queries the DB outside of withTenantScope/withSystemAccess.
-- Those are denied by default (fail closed) unless bypass is explicitly on.

CREATE OR REPLACE FUNCTION app_current_org() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_org', true), '')::UUID
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_setting('app.rls_bypass', true), '') = 'on'
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------
-- organizations: the tenant boundary itself. A connection may only see
-- its own org row — except register (withSystemAccess), which needs to
-- create/find orgs before a tenant context exists.
-- ---------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON organizations;
CREATE POLICY tenant_isolation ON organizations
  USING (app_rls_bypass() OR id = app_current_org())
  WITH CHECK (app_rls_bypass() OR id = app_current_org());

-- ---------------------------------------------------------------------
-- users: login (withSystemAccess) needs to find a user by email across
-- every org; everything else is scoped normally.
-- ---------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (app_rls_bypass() OR organization_id = app_current_org())
  WITH CHECK (app_rls_bypass() OR organization_id = app_current_org());

-- ---------------------------------------------------------------------
-- roles / permissions / role_permissions: shared reference data, not
-- tenant-owned — every org needs to read the same fixed role list
-- (e.g. register looks up the 'admin' role id). Left world-readable;
-- nothing here is tenant-specific or sensitive.
-- ---------------------------------------------------------------------
-- (intentionally no RLS on these three tables)

-- ---------------------------------------------------------------------
-- Every other tenant-owned table follows the same simple pattern.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'teams', 'channels', 'integrations', 'contacts', 'leads',
    'conversations', 'messages', 'ai_agents', 'ai_suggestions',
    'campaigns', 'reviews', 'social_comments', 'ecommerce_orders',
    'carts', 'recovery_flows', 'analytics_events', 'notifications',
    'subscriptions', 'invoices', 'api_keys', 'webhooks', 'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (app_rls_bypass() OR organization_id = app_current_org())
         WITH CHECK (app_rls_bypass() OR organization_id = app_current_org());',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- campaign_audiences / campaign_logs: no organization_id column of their
-- own — scoped indirectly through the campaign they belong to.
-- ---------------------------------------------------------------------
ALTER TABLE campaign_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_audiences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON campaign_audiences;
CREATE POLICY tenant_isolation ON campaign_audiences
  USING (app_rls_bypass() OR EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_audiences.campaign_id AND c.organization_id = app_current_org()
  ))
  WITH CHECK (app_rls_bypass() OR EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_audiences.campaign_id AND c.organization_id = app_current_org()
  ));

ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON campaign_logs;
CREATE POLICY tenant_isolation ON campaign_logs
  USING (app_rls_bypass() OR EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_logs.campaign_id AND c.organization_id = app_current_org()
  ))
  WITH CHECK (app_rls_bypass() OR EXISTS (
    SELECT 1 FROM campaigns c WHERE c.id = campaign_logs.campaign_id AND c.organization_id = app_current_org()
  ));

-- ---------------------------------------------------------------------
-- Grants for app_user (see 00-app-role.sh): ordinary read/write on every
-- table, but NOT table ownership and NOT BYPASSRLS — those are what would
-- let it slip past the policies above. This is the role the app's
-- DATABASE_URL actually connects as; POSTGRES_USER (superuser) stays an
-- admin/migration-only role, since RLS can't restrict a superuser at all.
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
