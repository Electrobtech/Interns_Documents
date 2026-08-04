-- =====================================================================
-- 026_channel_quotas.sql
--
-- Super Admin "Module 1" — per-tenant, per-channel enable/disable toggles
-- and monthly quota caps (WhatsApp, Instagram, Messenger, LinkedIn,
-- SMS/RCS, WebChat, Voice, Email).
--
-- NOTE ON SCOPE vs the existing `channels` table: `channels` (schema.sql)
-- is tenant-facing — one row per *connection instance* a tenant creates
-- (integration-service lets a tenant connect more than one number/page of
-- the same type; see smsForwarderService.js's comment on there being no
-- unique constraint on (organization_id, type)). This table is a
-- different, platform-level concept: exactly one governance row per
-- (organization, channel *type*), owned by Super Admin, independent of
-- how many connection instances the tenant has made. Reusing `channels`
-- for this would conflate "is this number connected" with "is this
-- tenant even allowed to use this channel type, and how much", which are
-- different questions asked by different actors (tenant vs platform).
--
-- USAGE METERING: quota_used is incremented by
-- shared/src/models/channelQuotaModel.js#recordUsage(), which is meant to
-- be called from the same call sites that already call
-- walletModel.deduct() for a channel-billable action (e.g.
-- automation-service's outbound senders). That wiring is intentionally
-- NOT done as part of this migration/module — walletModel.deduct() call
-- sites live in several already-running services (automation-service,
-- integration-service, campaign-service, linkedin-service) that this
-- change cannot exercise end-to-end here, and splicing a new blocking
-- check into live send paths without being able to run them is exactly
-- the kind of "looks right, breaks at runtime" risk this project is
-- trying to avoid. recordUsage()/checkQuota() are ready to call; wiring
-- each sender is a follow-up, one service at a time, tested against that
-- service's own test suite (see e.g. automation-service/tests/).
-- =====================================================================

CREATE TABLE IF NOT EXISTS channel_quotas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel                 TEXT NOT NULL CHECK (channel IN (
                            'whatsapp', 'instagram', 'messenger', 'linkedin',
                            'sms_rcs', 'webchat', 'voice', 'email'
                          )),
  enabled                 BOOLEAN NOT NULL DEFAULT true,
  -- NULL = unlimited. Enforced by the caller (recordUsage throws
  -- QuotaExceededError); this table only tracks and reports.
  monthly_quota           INT,
  quota_used              INT NOT NULL DEFAULT 0,
  -- Usage resets when now() crosses into a new period; see
  -- channelQuotaModel.js#currentPeriodStart(). Calendar-month periods,
  -- same cadence as the GST/billing invoicing period in Module 2.
  quota_period_start      DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  low_quota_threshold_pct INT NOT NULL DEFAULT 80 CHECK (low_quota_threshold_pct BETWEEN 1 AND 100),
  disabled_reason         TEXT,
  updated_by_admin        UUID REFERENCES platform_admins(id),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_channel_quotas_org ON channel_quotas (organization_id);

-- RLS: same tenant_isolation shape as wallets/payments/feature_flags —
-- a tenant can read its own rows (e.g. to show "quota used" in its own
-- Channel settings UI later), Super Admin (app_rls_bypass()) can read
-- and write across every tenant.
ALTER TABLE channel_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_quotas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON channel_quotas;
CREATE POLICY tenant_isolation ON channel_quotas
  USING      (app_rls_bypass() OR organization_id = app_current_org())
  WITH CHECK (app_rls_bypass() OR organization_id = app_current_org());

-- Auto-provision the 8 default rows whenever a new organization is
-- created — same pattern as trg_create_wallet_for_new_org in
-- 022_super_admin_billing.sql, so callers never need a separate
-- "initialize channel quotas" step.
CREATE OR REPLACE FUNCTION create_channel_quotas_for_new_org() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO channel_quotas (organization_id, channel)
  SELECT NEW.id, c
  FROM unnest(ARRAY['whatsapp','instagram','messenger','linkedin','sms_rcs','webchat','voice','email']) AS c
  ON CONFLICT (organization_id, channel) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_channel_quotas_for_new_org ON organizations;
CREATE TRIGGER trg_create_channel_quotas_for_new_org
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_channel_quotas_for_new_org();

-- Backfill for organizations that already existed before this migration.
INSERT INTO channel_quotas (organization_id, channel)
SELECT o.id, c
FROM organizations o
CROSS JOIN unnest(ARRAY['whatsapp','instagram','messenger','linkedin','sms_rcs','webchat','voice','email']) AS c
ON CONFLICT (organization_id, channel) DO NOTHING;
