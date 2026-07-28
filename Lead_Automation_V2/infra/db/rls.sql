-- =====================================================================
-- Row-Level Security — database-level tenant isolation backstop.
--
-- App code already filters every query by organization_id, but that's
-- just SQL a developer has to remember to write correctly on every
-- query, forever. One missed WHERE clause in any of the ~10 services in
-- this repo and one tenant could read or write another tenant's data.
--
-- This makes Postgres itself reject any row that doesn't belong to the
-- caller's current tenant, regardless of what the query says — so a bug
-- in application code fails safe (zero rows) instead of leaking data.
--
-- Runs as 03-rls.sql, after 01-schema.sql and 02-seed.sql (docker
-- entrypoint scripts run in filename order) and after 00-app-role.sh has
-- created the non-superuser app_user role — RLS is never enforced
-- against a table's owner (this file's DDL runs as POSTGRES_USER, the
-- table owner) or a superuser, so the actual isolation only takes effect
-- once every service connects as app_user instead (see docker-compose.yml).
--
-- See docs/MULTI_TENANT_RLS.md for the full design + verification
-- procedure.
-- =====================================================================

-- ---------- Helper functions ----------

-- Reads the app.current_org session GUC set by withTenantScope()
-- (shared/src/db.js). NULL if never set on this connection — which is
-- exactly the fail-closed case: no policy predicate below ever matches
-- NULL, so an un-scoped connection sees zero rows instead of everything.
CREATE OR REPLACE FUNCTION app_current_org() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_org', true), '')::UUID;
$$ LANGUAGE sql STABLE;

-- True only if app.rls_bypass was explicitly set to 'on' by
-- withSystemAccess() (shared/src/db.js). This is the ONLY sanctioned way
-- to cross tenant boundaries — see docs/MULTI_TENANT_RLS.md §2.5 for the
-- full list of call sites that use it.
CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_setting('app.rls_bypass', true), '') = 'on';
$$ LANGUAGE sql STABLE;

-- ---------- organizations — the tenant boundary itself ----------
-- Special case: scoped on id, not organization_id.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON organizations;
CREATE POLICY tenant_isolation ON organizations
  USING      (app_rls_bypass() OR id = app_current_org())
  WITH CHECK (app_rls_bypass() OR id = app_current_org());

-- ---------- Standard organization_id-scoped tables ----------
-- Every table below carries its own organization_id column directly.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'teams', 'channels', 'integrations',
    'contacts', 'leads', 'conversations', 'messages',
    'campaigns', 'reviews', 'social_comments',
    'google_tokens', 'google_accounts', 'google_locations',
    'google_reviews', 'google_oauth_configs',
    'ecommerce_orders', 'carts', 'recovery_flows',
    'analytics_events', 'notifications',
    'subscriptions', 'invoices',
    'api_keys', 'webhooks', 'audit_logs',
    'playbooks', 'conversation_sessions',
    'email_accounts', 'email_threads', 'email_messages',
    'sms_devices'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING      (app_rls_bypass() OR organization_id = app_current_org())
         WITH CHECK (app_rls_bypass() OR organization_id = app_current_org())',
      t
    );
  END LOOP;
END $$;

-- ---------- Indirectly-scoped tables (no organization_id column) ----------
-- campaign_audiences / campaign_logs hang off campaigns, which is itself
-- organization_id-scoped above — so scope these via an EXISTS check
-- against the parent row instead of duplicating an organization_id column.
ALTER TABLE campaign_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_audiences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON campaign_audiences;
CREATE POLICY tenant_isolation ON campaign_audiences
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM campaigns c
       WHERE c.id = campaign_audiences.campaign_id
         AND c.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM campaigns c
       WHERE c.id = campaign_audiences.campaign_id
         AND c.organization_id = app_current_org()
    )
  );

ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON campaign_logs;
CREATE POLICY tenant_isolation ON campaign_logs
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM campaigns c
       WHERE c.id = campaign_logs.campaign_id
         AND c.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM campaigns c
       WHERE c.id = campaign_logs.campaign_id
         AND c.organization_id = app_current_org()
    )
  );

-- email_attachments hangs off email_messages (organization_id-scoped
-- above) the same way campaign_audiences/campaign_logs hang off campaigns.
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON email_attachments;
CREATE POLICY tenant_isolation ON email_attachments
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM email_messages em
       WHERE em.id = email_attachments.message_id
         AND em.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM email_messages em
       WHERE em.id = email_attachments.message_id
         AND em.organization_id = app_current_org()
    )
  );

-- ---------- Deliberately NOT under RLS ----------
-- roles / permissions / role_permissions
--   Shared reference data, not tenant-owned.
--
-- gst_verifications
--   A global cache keyed by GST number (services/auth-service/src/services/gstService.js),
--   looked up before any tenant/org exists. Not tenant-owned.
--
-- verification_codes
--   Written and read by email/mobile OTP lookup keyed on (channel, target)
--   — by design cross-tenant/pre-tenant (registration wizard, before an
--   organizations row exists). organization_id on this table is
--   best-effort metadata, not a reliable scoping key.
--
-- oauth_states, linkedin_connections, linkedin_lead_forms, linkedin_leads,
-- linkedin_campaigns, linkedin_campaign_metrics, linkedin_organizations,
-- linkedin_approvals, linkedin_sync_logs
--   linkedin-service is a single-connection model keyed by user_id (TEXT),
--   not yet organization-scoped (see schema.sql comment above these
--   tables) — there's no organization_id column to enforce against yet.
--
-- throttle_counters
--   scope_key is a free-form string ("playbook_id", "playbook_id:node_id",
--   or "client:organization_id" depending on limit_type) rather than a
--   real organization_id column, so it can't be enforced with a plain
--   equality/EXISTS predicate the way the tables above are.
--
-- These are known, intentional gaps — see docs/MULTI_TENANT_RLS.md.

-- ---------- Privileges ----------
-- app_user is what every service actually connects as (docker-compose.yml).
-- Table ownership stays with POSTGRES_USER (the migration/admin role); RLS
-- is enforced against app_user because it is a non-superuser, non-owner,
-- NOBYPASSRLS role (see 00-app-role.sh).
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;