-- 020_bulk_campaigns.sql
--
-- Adds bulk/broadcast support on top of the existing `campaigns` table
-- (services/campaign-service) for the SMS/RCS "Bulk Campaign" tab
-- (frontend/src/components/automation/sms-simulator/SmsAutomationSimulator.jsx).
-- The old flow — one message_body sent to every row in campaign_audiences
-- via POST /campaigns/:id/send — is untouched; these columns are additive
-- and NULL/defaulted for every pre-existing campaign.
--
-- Note: SMS/RCS flows in this app are the Simulator's own local, in-memory
-- flow catalog (see INITIAL_FLOWS in SmsAutomationSimulator.jsx) — there is
-- no SMS-side equivalent of the WhatsApp/Instagram `playbooks` table, so a
-- broadcast carries its own already-resolved message template in the
-- existing `message_body` column rather than a foreign key to a flow row.
-- Per-recipient variable substitution against that template happens in
-- campaign_recipients.variables (below) at send time.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS recipient_source      TEXT,                 -- 'csv' | 'manual' | 'segment'
  ADD COLUMN IF NOT EXISTS send_mode             TEXT DEFAULT 'immediate', -- 'immediate' | 'scheduled'
  ADD COLUMN IF NOT EXISTS throttle_per_minute   INT DEFAULT 60,       -- SMS/min rate cap for this broadcast
  ADD COLUMN IF NOT EXISTS total_recipients      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_count            INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count          INT DEFAULT 0;

-- campaigns.status already existed as free-text (draft | needs_approval |
-- scheduled | sent | rejected — see campaign-service/src/index.js's
-- /decision route). The bulk pipeline adds 'queued' (jobs pushed to Redis,
-- none processed yet), 'processing' (at least one recipient attempted),
-- and 'completed'/'failed' (every recipient reached a terminal state, split
-- by whether any of them succeeded) as further values of that same column —
-- no schema change needed beyond documenting the new vocabulary here.

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL, -- null when the row came from a raw CSV/manual entry with no matching contact
  phone           TEXT NOT NULL,
  name            TEXT,
  variables       JSONB NOT NULL DEFAULT '{}',  -- mapped CSV-column -> flow-parameter values for this recipient
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | queued | sent | failed
  error           TEXT,
  attempts        INT NOT NULL DEFAULT 0,
  job_id          TEXT,                          -- BullMQ job id, for cross-referencing worker logs
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_campaign_recipients_campaign_status
  ON campaign_recipients (campaign_id, status);

-- Fast dedupe / lookup by phone within a single campaign (e.g. a CSV with a
-- repeated number, or checking "did this number already get queued").
CREATE INDEX IF NOT EXISTS ix_campaign_recipients_campaign_phone
  ON campaign_recipients (campaign_id, phone);
  