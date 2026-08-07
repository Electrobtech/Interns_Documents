-- 035_marketing_broadcasts.sql
--
-- NOTE: docker-compose's postgres service mounts schema.sql / seed.sql /
-- rls.sql as docker-entrypoint-initdb.d — this file is the single-feature
-- record. Keep schema.sql + rls.sql in sync.
--
-- Backs the Marketing Hub Broadcasts page
-- (frontend/src/components/marketing-hub/pages/MHBroadcasts.jsx).
--
-- DECISION (Task 5 of 6 — delivery reuse):
-- campaign-service already owns outbound template messaging and a BullMQ
-- bulk-send pipeline (bulkCampaignQueue / bulkCampaignWorker) for SMS/RCS.
-- That pipeline is tightly coupled to campaign-service's own `campaigns` +
-- `campaign_recipients` tables and currently *simulates* carrier delivery
-- (no real SMS/WhatsApp provider is wired project-wide — see
-- bulkCampaignWorker.js header). Mapping Marketing Hub broadcasts into
-- that schema would pollute the outbound-campaigns surface and still not
-- yield a real carrier call.
--
-- Therefore marketing-hub-service owns marketing_broadcasts end-to-end and
-- implements /send with the same simulation convention used by
-- campaign-service (realistic latency + metrics updates). When a real
-- channel provider is later attached to campaign-service, swap the
-- simulate step here the same way — do not build a parallel real sender.
--
-- Owned by marketing-hub-service (routes: src/broadcasts.js).
-- Requires marketing_audiences (033) for the audience_id FK.

CREATE TABLE IF NOT EXISTS marketing_broadcasts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name              TEXT NOT NULL,
  channel           TEXT NOT NULL
                      CHECK (channel IN ('WhatsApp', 'Email', 'SMS')),
  audience_id       UUID REFERENCES marketing_audiences(id) ON DELETE SET NULL,

  status            TEXT NOT NULL DEFAULT 'Draft'
                      CHECK (status IN ('Draft', 'Scheduled', 'Active', 'Sent')),

  sent              INTEGER NOT NULL DEFAULT 0,
  delivered         INTEGER NOT NULL DEFAULT 0,
  opened            INTEGER NOT NULL DEFAULT 0,
  clicked           INTEGER NOT NULL DEFAULT 0,
  responses         INTEGER NOT NULL DEFAULT 0,
  conversion        NUMERIC NOT NULL DEFAULT 0,
  ai_score          INTEGER CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),

  -- Optional message body used at send time (channel-agnostic plain text).
  message_body      TEXT,

  scheduled_at      TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_marketing_broadcasts_org
  ON marketing_broadcasts (organization_id);
CREATE INDEX IF NOT EXISTS ix_marketing_broadcasts_org_status
  ON marketing_broadcasts (organization_id, status);
CREATE INDEX IF NOT EXISTS ix_marketing_broadcasts_org_channel
  ON marketing_broadcasts (organization_id, channel);
CREATE INDEX IF NOT EXISTS ix_marketing_broadcasts_org_created
  ON marketing_broadcasts (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_marketing_broadcasts_audience
  ON marketing_broadcasts (audience_id);
