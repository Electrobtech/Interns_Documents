-- =====================================================================
-- 028_platform_governance.sql
--
-- Module 4 — Super Admin Governance & System Health:
--   1. RBAC roles on platform_admins (Super Admin / Billing Admin /
--      Support Lead) — this column didn't exist before; every admin was
--      an undifferentiated full super admin.
--   2. platform_announcements — the "push alerts to user portals" global
--      banner manager. Deliberately readable by tenant-scoped
--      connections (not bypass_only like platform_admins/invoice_counters)
--      because the whole point is tenants see it — see the RLS policy
--      below and its comment.
--   3. platform_service_status — admin-managed status board for external
--      dependencies (Meta/WhatsApp Cloud API, Twilio, the LLM provider,
--      Razorpay). This is admin-set, not a live poller: this repo has no
--      credentials/network path in this environment to actually call
--      those providers' status APIs, and a live status endpoint the
--      platform team can update honestly during an incident is more
--      useful than a green checkmark nobody can trust. Internal
--      microservice health (auth-service, billing-service, etc.) is a
--      *live* check instead — see shared/src/models/platformHealthModel.js
--      — because those ARE reachable from wherever Super Admin runs.
-- =====================================================================

ALTER TABLE platform_admins
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'super_admin'
    CHECK (role IN ('super_admin', 'billing_admin', 'support_lead'));

COMMENT ON COLUMN platform_admins.role IS
  'super_admin: full access, incl. managing other platform_admins. '
  'billing_admin: wallet/subscriptions/invoices/payments only, no tenant '
  'suspend/delete or admin management. support_lead: read-only across '
  'companies/analytics/audit logs, plus channel-quota support actions '
  '(reset usage), no billing mutations. See requirePlatformRole() in '
  'shared/src/superAdmin.js for the enforced matrix.';

CREATE TABLE IF NOT EXISTS platform_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  active      BOOLEAN NOT NULL DEFAULT true,
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at     TIMESTAMPTZ,                     -- NULL = open-ended
  created_by  UUID REFERENCES platform_admins(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_active_window
  ON platform_announcements (active, starts_at, ends_at);

ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_full_access ON platform_announcements;
CREATE POLICY admin_full_access ON platform_announcements
  USING      (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- Tenant-scoped connections may only ever SELECT, and only rows that are
-- currently live — never see drafts/expired/inactive ones, and can never
-- write. Postgres RLS policies for the same table are OR'd together
-- (permissive), so this adds read access on top of admin_full_access
-- rather than replacing it.
DROP POLICY IF EXISTS tenant_read_active ON platform_announcements;
CREATE POLICY tenant_read_active ON platform_announcements
  FOR SELECT
  USING (active AND now() >= starts_at AND (ends_at IS NULL OR now() < ends_at));

CREATE TABLE IF NOT EXISTS platform_service_status (
  service_key TEXT PRIMARY KEY CHECK (service_key IN (
                'meta_whatsapp', 'meta_instagram', 'meta_messenger',
                'twilio_sms', 'llm_provider', 'razorpay'
              )),
  label       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'operational'
                CHECK (status IN ('operational', 'degraded', 'outage')),
  note        TEXT,                            -- e.g. "Meta incident #12345, ETA 2h"
  updated_by  UUID REFERENCES platform_admins(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_service_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_service_status FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bypass_only ON platform_service_status;
CREATE POLICY bypass_only ON platform_service_status
  USING      (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

INSERT INTO platform_service_status (service_key, label) VALUES
  ('meta_whatsapp',   'WhatsApp Cloud API'),
  ('meta_instagram',  'Instagram Messaging API'),
  ('meta_messenger',  'Messenger Platform API'),
  ('twilio_sms',      'Twilio (SMS/RCS)'),
  ('llm_provider',    'LLM Provider'),
  ('razorpay',        'Razorpay')
ON CONFLICT (service_key) DO NOTHING;
