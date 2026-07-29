-- 019_sms_devices.sql
--
-- Backing table for the SMS/RCS channel (frontend/src/app/app/channels/sms).
-- The channels table already carries a 'sms' entry per org, but sending
-- SMS needs somewhere to register *which* number/gateway that channel
-- actually sends through — mirrors how email_accounts backs the email
-- channel, one row per connected sending device/number rather than a
-- single JSON blob on channels.credentials.
--
-- Org-scoped like every other integration table, so it slots into the
-- standard RLS loop in infra/db/rls.sql (which already lists it).

CREATE TABLE IF NOT EXISTS sms_devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,               -- human-friendly name, e.g. "Front Desk Android"
  phone_number      TEXT NOT NULL,                -- E.164, e.g. +91XXXXXXXXXX
  provider          TEXT NOT NULL DEFAULT 'android_gateway', -- android_gateway | twilio | other
  status            TEXT NOT NULL DEFAULT 'disconnected',    -- connected | disconnected | error
  sender_id         TEXT,                          -- alphanumeric sender ID for transactional SMS, if the provider supports one
  credentials       JSONB NOT NULL DEFAULT '{}'::jsonb, -- provider API key/secret etc, same shape as integrations.credentials
  connected_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  last_seen_at      TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_sms_devices_org_status ON sms_devices (organization_id, status);