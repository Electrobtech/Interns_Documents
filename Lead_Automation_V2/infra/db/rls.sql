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
    'contacts', 'leads', 'follow_ups', 'conversations', 'messages',
    'campaigns', 'reviews', 'social_comments',
    'google_tokens', 'google_accounts', 'google_locations',
    'google_reviews', 'google_oauth_configs',
    'ecommerce_orders', 'carts', 'recovery_flows',
    'analytics_events', 'notifications',
    'subscriptions', 'invoices',
    'api_keys', 'webhooks', 'audit_logs',
    'playbooks', 'conversation_sessions',
    'email_accounts', 'email_threads', 'email_messages',
    'sms_devices',
    'wallets', 'wallet_transactions', 'payments', 'feature_flags', 'attachments',
    'channel_quotas',
    'calendar_accounts', 'calendar_events',
    'organization_channel_subscriptions', 'whatsapp_billing_ledger',
    'meta_usage_charges', 'sms_usage_charges',
    'products',
    'message_templates',
    'marketing_assets',
    'marketing_audiences',
    'marketing_campaigns',
    'marketing_broadcasts',
    'marketing_calendar_events',
    'imported_sheets'
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

-- marketing_audience_snapshots hangs off marketing_audiences
ALTER TABLE marketing_audience_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_audience_snapshots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON marketing_audience_snapshots;
CREATE POLICY tenant_isolation ON marketing_audience_snapshots
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM marketing_audiences a
       WHERE a.id = marketing_audience_snapshots.audience_id
         AND a.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM marketing_audiences a
       WHERE a.id = marketing_audience_snapshots.audience_id
         AND a.organization_id = app_current_org()
    )
  );

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

-- campaign_recipients (020_bulk_campaigns.sql) hangs off campaigns the same
-- way campaign_audiences does — EXISTS check against the parent row rather
-- than its own organization_id column.
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON campaign_recipients;
CREATE POLICY tenant_isolation ON campaign_recipients
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM campaigns c
       WHERE c.id = campaign_recipients.campaign_id
         AND c.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM campaigns c
       WHERE c.id = campaign_recipients.campaign_id
         AND c.organization_id = app_current_org()
    )
  );

-- mh_recipients / mh_delivery_events (030_marketing_hub.sql) hang off
-- mh_campaigns the same way campaign_recipients hangs off campaigns above —
-- EXISTS check against the parent row rather than a duplicated
-- organization_id column.
ALTER TABLE mh_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_recipients FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON mh_recipients;
CREATE POLICY tenant_isolation ON mh_recipients
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM mh_campaigns c
       WHERE c.id = mh_recipients.campaign_id
         AND c.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM mh_campaigns c
       WHERE c.id = mh_recipients.campaign_id
         AND c.organization_id = app_current_org()
    )
  );

ALTER TABLE mh_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_delivery_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON mh_delivery_events;
CREATE POLICY tenant_isolation ON mh_delivery_events
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM mh_campaigns c
       WHERE c.id = mh_delivery_events.campaign_id
         AND c.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM mh_campaigns c
       WHERE c.id = mh_delivery_events.campaign_id
         AND c.organization_id = app_current_org()
    )
  );

-- invoice_line_items (025_channel_subscription_billing.sql) hangs off
-- invoices the same way — EXISTS check against the parent invoice row.
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON invoice_line_items;
CREATE POLICY tenant_isolation ON invoice_line_items
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM invoices i
       WHERE i.id = invoice_line_items.invoice_id
         AND i.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM invoices i
       WHERE i.id = invoice_line_items.invoice_id
         AND i.organization_id = app_current_org()
    )
  );

-- billing_markup_config: NOT the direct organization_id = app_current_org()
-- loop above, because organization_id is nullable here (NULL = the
-- platform-wide default row, which every tenant must be able to read).
-- A tenant connection may read the default row plus its own override row,
-- but may only ever WRITE its own org's row (never the shared default or
-- another org's) — in practice writes go through requireSuperAdmin routes
-- under withSystemAccess anyway.
ALTER TABLE billing_markup_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_markup_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON billing_markup_config;
CREATE POLICY tenant_isolation ON billing_markup_config
  USING      (app_rls_bypass() OR organization_id IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_rls_bypass() OR organization_id = app_current_org());

-- channel_plans, meta_rate_cards, sms_rate_cards (025_channel_subscription_
-- billing.sql) are deliberately NOT given RLS — global platform catalogues
-- with no organization_id column at all, same category as `permissions`/
-- `roles` above. Every tenant reads the same rows; only platform admins
-- (requireSuperAdmin routes) write them.

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

-- ---------- platform_admins — not tenant-scoped at all ----------
-- Super admin staff aren't inside any organization, so there's no
-- organization_id to compare against app_current_org() here. The only
-- legitimate access path is a platform-admin auth flow running under
-- withSystemAccess() (see shared/src/superAdmin.js) — a normal
-- tenant-scoped connection must never see this table.
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bypass_only ON platform_admins;
CREATE POLICY bypass_only ON platform_admins
  USING      (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ---------- platform_announcements — global banners (Module 4) ----------
-- Unlike platform_admins above, this one IS meant to be read by ordinary
-- tenant-scoped connections — that's the entire point of a banner. See
-- infra/db/migrations/028_platform_governance.sql for the full comment.
ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access ON platform_announcements;
CREATE POLICY admin_full_access ON platform_announcements
  USING      (app_rls_bypass())
  WITH CHECK (app_rls_bypass());
DROP POLICY IF EXISTS tenant_read_active ON platform_announcements;
CREATE POLICY tenant_read_active ON platform_announcements
  FOR SELECT
  USING (active AND now() >= starts_at AND (ends_at IS NULL OR now() < ends_at));

-- ---------- platform_service_status — admin-only status board (Module 4) ----------
ALTER TABLE platform_service_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_service_status FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bypass_only ON platform_service_status;
CREATE POLICY bypass_only ON platform_service_status
  USING      (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ---------- invoice_counters — platform-wide sequential invoice numbering ----------
-- No organization_id (GST sequential numbering is per financial year
-- across the whole platform, not per tenant) — Super Admin only, same
-- shape as platform_admins above. See
-- infra/db/migrations/027_subscription_billing.sql.
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_counters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bypass_only ON invoice_counters;
CREATE POLICY bypass_only ON invoice_counters
  USING      (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

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
-- platform_admins
--   Not tenant-owned — see its own bypass-only policy above. Listed here
--   too so this section stays a complete inventory of every table's RLS
--   treatment at a glance.
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