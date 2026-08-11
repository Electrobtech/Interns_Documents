-- =====================================================================
-- Row-Level Security — database-level tenant isolation backstop.
-- =====================================================================

-- ---------- Helper functions ----------
CREATE OR REPLACE FUNCTION app_current_org() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_org', true), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_setting('app.rls_bypass', true), '') = 'on';
$$ LANGUAGE sql STABLE;

-- ---------- organizations ----------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON organizations;
CREATE POLICY tenant_isolation ON organizations
  USING      (app_rls_bypass() OR id = app_current_org())
  WITH CHECK (app_rls_bypass() OR id = app_current_org());

-- ---------- Standard organization_id-scoped tables ----------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'teams', 'channels', 'integrations',
    'contacts', 'leads', 'follow_ups', 'conversations', 'messages',
    'campaigns', 'marketing_audiences', 'marketing_campaigns',
    'mh_audiences', 'mh_campaigns', 'reviews', 'social_comments',
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
    'finance_transactions', 'course_invoices', 'finance_invoice_counters'
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

-- ---------- Indirectly-scoped tables ----------
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

ALTER TABLE marketing_audience_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_audience_snapshots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON marketing_audience_snapshots;
CREATE POLICY tenant_isolation ON marketing_audience_snapshots
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM marketing_audiences ma
       WHERE ma.id = marketing_audience_snapshots.audience_id
         AND ma.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM marketing_audiences ma
       WHERE ma.id = marketing_audience_snapshots.audience_id
         AND ma.organization_id = app_current_org()
    )
  );

ALTER TABLE mh_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_recipients FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON mh_recipients;
CREATE POLICY tenant_isolation ON mh_recipients
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM mh_campaigns mhc
       WHERE mhc.id = mh_recipients.campaign_id
         AND mhc.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM mh_campaigns mhc
       WHERE mhc.id = mh_recipients.campaign_id
         AND mhc.organization_id = app_current_org()
    )
  );

ALTER TABLE mh_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_delivery_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON mh_delivery_events;
CREATE POLICY tenant_isolation ON mh_delivery_events
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM mh_campaigns mhc
       WHERE mhc.id = mh_delivery_events.campaign_id
         AND mhc.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM mh_campaigns mhc
       WHERE mhc.id = mh_delivery_events.campaign_id
         AND mhc.organization_id = app_current_org()
    )
  );

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

ALTER TABLE billing_markup_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_markup_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON billing_markup_config;
CREATE POLICY tenant_isolation ON billing_markup_config
  USING      (app_rls_bypass() OR organization_id IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_rls_bypass() OR organization_id = app_current_org());

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

-- ---------- platform_admins ----------
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bypass_only ON platform_admins;
CREATE POLICY bypass_only ON platform_admins
  USING      (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ---------- platform_announcements ----------
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

-- ---------- platform_service_status ----------
ALTER TABLE platform_service_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_service_status FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bypass_only ON platform_service_status;
CREATE POLICY bypass_only ON platform_service_status
  USING      (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ---------- invoice_counters ----------
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_counters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bypass_only ON invoice_counters;
CREATE POLICY bypass_only ON invoice_counters
  USING      (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ---------- Privileges ----------
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;