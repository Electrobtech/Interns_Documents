-- 034_marketing_campaigns.sql
--
-- NOTE: docker-compose's postgres service mounts schema.sql / seed.sql /
-- rls.sql as docker-entrypoint-initdb.d — this file is the single-feature
-- record. Keep schema.sql + rls.sql in sync.
--
-- Backs the Marketing Hub Campaigns page
-- (frontend/src/components/marketing-hub/pages/MHCampaigns.jsx).
--
-- DECISION (Task 4): spend / reach / CTR / etc. are MANUALLY ENTERED via
-- simple CRUD. No Meta Ads / Google Ads OAuth or webhook sync is wired —
-- credentials and requirements were not provided. Metrics are not computed
-- from contact-service lead data either; the UI is an ad-platform tracking
-- dashboard, not an outbound messaging log.
--
-- SEPARATION: this table is intentionally distinct from the existing
-- `campaigns` table owned by campaign-service (WhatsApp/SMS/email template
-- broadcasts). Marketing Hub "Campaigns" = ad-platform campaign tracking
-- (Facebook/Google/LinkedIn/Instagram spend & performance). Do not merge.
--
-- Owned by marketing-hub-service (routes: src/campaigns.js).

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name              TEXT NOT NULL,
  platform          TEXT NOT NULL
                      CHECK (platform IN (
                        'Facebook', 'Google Ads', 'LinkedIn',
                        'Instagram', 'WhatsApp', 'Email'
                      )),
  objective         TEXT,
  status            TEXT NOT NULL DEFAULT 'Draft'
                      CHECK (status IN ('Active', 'Scheduled', 'Paused', 'Draft')),

  budget            NUMERIC NOT NULL DEFAULT 0,
  spend             NUMERIC NOT NULL DEFAULT 0,
  ctr               NUMERIC NOT NULL DEFAULT 0,
  cpm               NUMERIC NOT NULL DEFAULT 0,
  cpc               NUMERIC NOT NULL DEFAULT 0,
  reach             BIGINT  NOT NULL DEFAULT 0,
  impressions       BIGINT  NOT NULL DEFAULT 0,
  leads             INTEGER NOT NULL DEFAULT 0,
  conversions       INTEGER NOT NULL DEFAULT 0,
  revenue           NUMERIC NOT NULL DEFAULT 0,
  roas              NUMERIC NOT NULL DEFAULT 0,

  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date        DATE,
  end_date          DATE,
  ai_score          INTEGER CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_marketing_campaigns_org
  ON marketing_campaigns (organization_id);
CREATE INDEX IF NOT EXISTS ix_marketing_campaigns_org_status
  ON marketing_campaigns (organization_id, status);
CREATE INDEX IF NOT EXISTS ix_marketing_campaigns_org_platform
  ON marketing_campaigns (organization_id, platform);
CREATE INDEX IF NOT EXISTS ix_marketing_campaigns_org_created
  ON marketing_campaigns (organization_id, created_at DESC);
  