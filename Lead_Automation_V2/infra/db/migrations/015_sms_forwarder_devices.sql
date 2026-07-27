-- SMS channel integration (receive-only, via a forwarder app on an
-- Android phone). See sms-integration-architecture.md for full design.
-- Run after 014_integration_connection_lock.sql.

-- ---------- SMS (receive-only, via forwarder app) — see
-- migrations/015_sms_forwarder_devices.sql and services/integration-service
-- routes/smsWebhook.js + smsDevices.js. Each row is one Android phone
-- running a third-party forwarding app (e.g. SMS Forwarder) that POSTs
-- inbound texts to a per-device webhook URL; the token in that URL is the
-- only credential. Inbound texts land in the shared contacts/conversations/
-- messages tables above (channel_type='sms') like every other channel. ----------
CREATE TABLE IF NOT EXISTS sms_devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,             -- e.g. "Front desk phone", "Rep #2 SIM"
  phone_number      TEXT,                       -- optional, cosmetic — not used for delivery
  webhook_token     TEXT NOT NULL UNIQUE,        -- 64-char random hex; the URL IS the credential
  connected         BOOLEAN NOT NULL DEFAULT true,
  last_message_at   TIMESTAMPTZ,
  message_count     INTEGER NOT NULL DEFAULT 0,
  last_raw_payload  JSONB,                       -- most recent payload received — critical for
                                                   -- debugging field-name mismatches
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_sms_devices_org ON sms_devices (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_sms_devices_token ON sms_devices (webhook_token);
