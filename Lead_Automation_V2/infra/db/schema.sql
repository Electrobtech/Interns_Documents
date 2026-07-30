-- =====================================================================
-- Lead Automation — Multi-tenant SaaS schema (PostgreSQL)
-- Every table carries organization_id for org-wide data isolation.
-- Unified Schema (Main Project + Custom Additions)
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- Tenancy ----------
CREATE TABLE IF NOT EXISTS organizations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  slug                    TEXT UNIQUE NOT NULL,
  -- ---- Company Registration (Tenant Onboarding) profile ----
  legal_name              TEXT,
  business_type           TEXT,   -- proprietorship | partnership | llp | private_limited | public_limited | startup | ngo | other
  industry                TEXT,
  website                 TEXT,
  logo_url                TEXT,
  employee_count          TEXT,
  description             TEXT,
  company_email           TEXT,
  company_phone           TEXT,
  support_email           TEXT,
  alternate_phone         TEXT,
  address_line1           TEXT,
  address_line2           TEXT,
  city                    TEXT,
  state                   TEXT,
  country                 TEXT,
  postal_code             TEXT,
  gst_number              TEXT,
  pan_number              TEXT,
  registration_number     TEXT,
  incorporation_cert_url  TEXT,
  gst_cert_url            TEXT,
  registration_cert_url   TEXT,
  subscription_plan       TEXT DEFAULT 'starter', -- starter | professional | enterprise
  coupon_code             TEXT,
  status                  TEXT DEFAULT 'pending', -- pending | active | suspended
  onboarding_step         INT DEFAULT 1,
  -- ---- GST verification auto-fill (Step 5 "Verify GST") ----
  trade_name              TEXT,
  district                TEXT,
  gst_status              TEXT,   -- e.g. Active | Cancelled | Suspended, as returned by the GST provider
  gst_registration_date   TEXT,   -- kept as returned by the provider (formats vary); not a DB date type
  gst_verified_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_name_ci_idx ON organizations (lower(name));

-- GST verification cache
CREATE TABLE IF NOT EXISTS gst_verifications (
  gst_number           TEXT PRIMARY KEY,
  verification_status  TEXT,
  company_name         TEXT,
  trade_name           TEXT,
  business_type        TEXT,
  registration_date    TEXT,
  address              TEXT,
  district             TEXT,
  state                TEXT,
  pincode              TEXT,
  verified_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Auth / Users / Roles ----------
CREATE TABLE IF NOT EXISTS roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,             -- admin | manager | agent
  description   TEXT,
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,      -- e.g. inbox:read, campaign:send
  description   TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role_id             UUID REFERENCES roles(id),
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  mobile              TEXT,
  password_hash       TEXT NOT NULL,
  availability        TEXT DEFAULT 'offline',  -- online | away | offline
  is_email_verified   BOOLEAN NOT NULL DEFAULT false,
  is_phone_verified   BOOLEAN NOT NULL DEFAULT false,
  two_factor_enabled  BOOLEAN NOT NULL DEFAULT false,
  two_factor_method   TEXT,                     -- authenticator | sms
  pin_hash            TEXT,                      -- bcrypt hash of a 4-6 digit PIN, alt login (017_pin_authentication.sql)
  is_pin_enabled      BOOLEAN NOT NULL DEFAULT false,
  failed_pin_attempts INTEGER NOT NULL DEFAULT 0,
  pin_lockout_until   TIMESTAMPTZ,
  pin_updated_at      TIMESTAMPTZ,                -- age-checked at login for 30-day expiration
  previous_pin_hash   TEXT,                       -- prior PIN, so a new one can't just repeat it (018_pin_expiration_history.sql)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

-- Verification codes used by registration wizard
CREATE TABLE IF NOT EXISTS verification_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL,           -- email | mobile
  target          TEXT NOT NULL,           -- email address or phone number
  code_hash       TEXT NOT NULL,
  purpose         TEXT NOT NULL DEFAULT 'signup',
  consumed        BOOLEAN NOT NULL DEFAULT false,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_codes_target_idx ON verification_codes (channel, target);

CREATE TABLE IF NOT EXISTS teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Channels & Integrations ----------
CREATE TABLE IF NOT EXISTS channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,           -- whatsapp | instagram | messenger | sms | webchat | voice | email | google_reviews | linkedin
  display_name    TEXT,
  status          TEXT DEFAULT 'disconnected',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,           -- shopify | stripe | google_sheets | zapier ...
  status          TEXT DEFAULT 'disconnected',
  credentials     JSONB DEFAULT '{}'::jsonb,
  locked_at       TIMESTAMPTZ,
  locked_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backs the 'sms' channel: one row per connected sending number/gateway,
-- rather than a single JSON blob on channels.credentials (019_sms_devices.sql).
CREATE TABLE IF NOT EXISTS sms_devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,               -- human-friendly name, e.g. "Front Desk Android"
  phone_number      TEXT NOT NULL,                -- E.164, e.g. +91XXXXXXXXXX
  provider          TEXT NOT NULL DEFAULT 'android_gateway', -- android_gateway | twilio | other
  status            TEXT NOT NULL DEFAULT 'disconnected',    -- connected | disconnected | error
  sender_id         TEXT,                          -- alphanumeric sender ID for transactional SMS, if the provider supports one
  credentials       JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  last_seen_at      TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_sms_devices_org_status ON sms_devices (organization_id, status);

-- ---------- Contacts & Leads ----------
CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT,
  email           TEXT,
  phone           TEXT,
  source          TEXT,                    -- lead source / origin channel
  external_id     TEXT,                    -- raw channel identity (WhatsApp phone / IG-scoped user id / etc)
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  opted_out       BOOLEAN NOT NULL DEFAULT false, -- True once contact sends STOP/UNSUBSCRIBE
  opted_out_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_org_source_external
  ON contacts (organization_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE CASCADE,
  stage           TEXT DEFAULT 'new',      -- new | qualified | active | won | lost
  priority        TEXT DEFAULT 'medium',
  score           INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Conversations & Messages ----------
CREATE TABLE IF NOT EXISTS conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES contacts(id),
  channel_type        TEXT NOT NULL,
  assigned_to         UUID REFERENCES users(id),
  status              TEXT DEFAULT 'open',     -- open | pending | missed | campaign | closed
  handled_by          TEXT NOT NULL DEFAULT 'bot'
                        CHECK (handled_by IN ('bot','human')),
  external_contact_id TEXT,                    -- provider-side thread/sender id
  last_message_at     TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_conversations_org_channel_external
  ON conversations (organization_id, channel_type, external_contact_id);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL,           -- inbound | outbound
  body            TEXT,
  sender          TEXT,
  message_type    TEXT NOT NULL DEFAULT 'text', -- text | button_click | list_select | buttons | list | document | system
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  media_url       TEXT,                    -- WhatsApp/IG media or email attachment download URL
  media_type      TEXT,
  external_id     TEXT,                    -- provider-side message id (wamid / Gmail message id)
  subject         TEXT,                    -- email-specific subject line
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Realtime message fan-out ----------
CREATE OR REPLACE FUNCTION notify_new_message() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'messages_channel',
    json_build_object(
      'id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'organization_id', NEW.organization_id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_notify_trigger ON messages;
CREATE TRIGGER messages_notify_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();

-- ---------- Email (Gmail) ----------
CREATE TABLE IF NOT EXISTS email_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL DEFAULT 'gmail',
  email             TEXT NOT NULL,
  access_token      TEXT,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  scope             TEXT,
  connected         BOOLEAN NOT NULL DEFAULT true,
  connected_by      UUID REFERENCES users(id),
  history_id        TEXT,
  watch_expires_at  TIMESTAMPTZ,
  last_synced_at    TIMESTAMPTZ,
  last_sync_error   TEXT,
  signature_html    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS email_threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email_account_id  UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  thread_id         TEXT NOT NULL,
  conversation_id   UUID REFERENCES conversations(id) ON DELETE SET NULL,
  subject           TEXT,
  participants      TEXT[] DEFAULT '{}',
  last_message_time TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_account_id, thread_id)
);

CREATE TABLE IF NOT EXISTS email_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email_account_id  UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  thread_id         UUID REFERENCES email_threads(id) ON DELETE CASCADE,
  message_id        TEXT NOT NULL,
  rfc822_message_id TEXT,
  in_reply_to       TEXT,
  from_email        TEXT,
  to_email          TEXT[] DEFAULT '{}',
  cc_email          TEXT[] DEFAULT '{}',
  subject           TEXT,
  body              TEXT,
  html_body         TEXT,
  snippet           TEXT,
  direction         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'received',
  label_ids         TEXT[] DEFAULT '{}',
  has_attachments   BOOLEAN NOT NULL DEFAULT false,
  received_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_account_id, message_id)
);

CREATE INDEX IF NOT EXISTS ix_email_messages_thread ON email_messages (thread_id, received_at);

CREATE TABLE IF NOT EXISTS email_attachments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id          UUID REFERENCES email_messages(id) ON DELETE CASCADE,
  filename            TEXT,
  mime_type           TEXT,
  size                INT,
  gmail_attachment_id TEXT,
  url                 TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_email_attachments_message ON email_attachments (message_id);

-- ---------- Campaigns ----------
CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT DEFAULT 'broadcast',
  channel_type    TEXT,
  message_body    TEXT,
  cta             JSONB,
  scheduled_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'draft',    -- draft | scheduled | sent
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_audiences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campaign_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id),
  event           TEXT,                    -- delivered | opened | clicked | replied | converted
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Reviews & Social ----------
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source          TEXT,                    -- google
  author          TEXT,
  rating          INT,
  body            TEXT,
  reply           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source          TEXT,                    -- facebook | linkedin
  author          TEXT,
  body            TEXT,
  reply           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Google Business Profile Reviews ----------
CREATE TABLE IF NOT EXISTS google_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  access_token      TEXT,
  access_expires_at TIMESTAMPTZ,
  refresh_token     TEXT NOT NULL,
  scope             TEXT,
  connected_by      UUID REFERENCES users(id),
  last_sync_at      TIMESTAMPTZ,
  last_sync_status  TEXT,                 -- ok | error
  last_sync_error   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS google_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  account_id        TEXT NOT NULL,
  account_name      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, account_id)
);

CREATE TABLE IF NOT EXISTS google_locations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  account_id        TEXT NOT NULL,
  location_id       TEXT NOT NULL,
  location_name     TEXT,
  address           TEXT,
  phone             TEXT,
  is_selected       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, location_id)
);

CREATE TABLE IF NOT EXISTS google_reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  location_id         TEXT NOT NULL,
  review_id           TEXT NOT NULL,
  reviewer_name       TEXT,
  reviewer_photo_url  TEXT,
  star_rating         INT,
  comment             TEXT,
  create_time         TIMESTAMPTZ,
  update_time         TIMESTAMPTZ,
  reply_comment       TEXT,
  reply_update_time   TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_google_reviews_org_location
  ON google_reviews (organization_id, location_id);

CREATE INDEX IF NOT EXISTS idx_google_reviews_org_created
  ON google_reviews (organization_id, create_time DESC);

CREATE TABLE IF NOT EXISTS google_oauth_configs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID REFERENCES organizations(id) ON DELETE CASCADE,
  client_id               TEXT NOT NULL,
  encrypted_client_secret TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

-- ---------- Email (Gmail) — see migrations/013_email_integration.sql and
-- services/email-service. Full-fidelity mailbox data lives in these
-- dedicated tables; a summarized copy is also written into the shared
-- conversations/messages tables above (channel_type='email') so a
-- connected mailbox shows up in the Unified Inbox like every other
-- channel. ----------
CREATE TABLE IF NOT EXISTS email_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL DEFAULT 'gmail',
  email             TEXT NOT NULL,
  access_token      TEXT,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  scope             TEXT,
  connected         BOOLEAN NOT NULL DEFAULT true,
  connected_by      UUID REFERENCES users(id),
  history_id        TEXT,
  watch_expires_at  TIMESTAMPTZ,
  last_synced_at    TIMESTAMPTZ,
  last_sync_error   TEXT,
  signature_html    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS email_threads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email_account_id   UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  thread_id          TEXT NOT NULL,
  conversation_id    UUID REFERENCES conversations(id) ON DELETE SET NULL,
  subject            TEXT,
  participants       TEXT[] DEFAULT '{}',
  last_message_time  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_account_id, thread_id)
);

CREATE TABLE IF NOT EXISTS email_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email_account_id  UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  thread_id         UUID REFERENCES email_threads(id) ON DELETE CASCADE,
  message_id        TEXT NOT NULL,
  rfc822_message_id TEXT,
  in_reply_to       TEXT,
  from_email        TEXT,
  to_email          TEXT[] DEFAULT '{}',
  cc_email          TEXT[] DEFAULT '{}',
  subject           TEXT,
  body              TEXT,
  html_body         TEXT,
  snippet           TEXT,
  direction         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'received',
  label_ids         TEXT[] DEFAULT '{}',
  has_attachments   BOOLEAN NOT NULL DEFAULT false,
  received_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_account_id, message_id)
);

CREATE INDEX IF NOT EXISTS ix_email_messages_thread ON email_messages (thread_id, received_at);

CREATE TABLE IF NOT EXISTS email_attachments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id          UUID REFERENCES email_messages(id) ON DELETE CASCADE,
  filename            TEXT,
  mime_type           TEXT,
  size                INT,
  gmail_attachment_id TEXT,
  url                 TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_email_attachments_message ON email_attachments (message_id);

-- ---------------------------------------------------------------------
-- Google Calendar integration (services/calendar-service) — see
-- infra/db/migrations/016_calendar_integration.sql for the full
-- rationale/comments; kept in sync here for fresh installs.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  google_email      TEXT,
  access_token      TEXT,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  scope             TEXT,
  connected         BOOLEAN NOT NULL DEFAULT true,
  connected_by      UUID REFERENCES users(id),
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  google_event_id     TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  location            TEXT,
  attendee_emails     TEXT[],
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  campaign_id         UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  automation_node_id  TEXT,
  status              TEXT NOT NULL DEFAULT 'confirmed',
  html_link           TEXT,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_calendar_events_org_time ON calendar_events (organization_id, starts_at);
CREATE INDEX IF NOT EXISTS ix_calendar_events_contact ON calendar_events (contact_id);
CREATE INDEX IF NOT EXISTS ix_calendar_events_campaign ON calendar_events (campaign_id);

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

-- ---------- Ecommerce & Revenue ----------
CREATE TABLE IF NOT EXISTS ecommerce_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id),
  amount          NUMERIC,
  payment_type    TEXT,                    -- cod | prepaid
  status          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id),
  value           NUMERIC,
  recovered       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_flows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT,
  steps           JSONB DEFAULT '[]'::jsonb,
  active          BOOLEAN DEFAULT true
);

-- ---------- Analytics ----------
CREATE TABLE IF NOT EXISTS analytics_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  event_type      TEXT,
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  title           TEXT,
  body            TEXT,
  read            BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Billing ----------
CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan            TEXT,
  status          TEXT DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  amount          NUMERIC,
  status          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- API / Webhooks / Audit ----------
CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key_hash        TEXT NOT NULL,
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  event           TEXT,
  active          BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  action          TEXT,
  meta            JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_org ON conversations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(conversation_id, message_type);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);

-- ---------- Lead Automation Module (Playbook Engine) ----------
CREATE TABLE IF NOT EXISTS playbooks (
  id                TEXT PRIMARY KEY,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  channels          TEXT[] NOT NULL DEFAULT '{}',
  playbook_type     TEXT NOT NULL DEFAULT 'standard'
                      CHECK (playbook_type IN ('standard','default','fallback','gen_ai_default','transfer','unsubscribe')),
  trigger_keywords  TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','active','paused','archived')),
  version           INT NOT NULL DEFAULT 1,
  entry_node_id     TEXT NOT NULL,
  global_limits     JSONB NOT NULL DEFAULT '{}'::jsonb,
  nodes             JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_org_status ON playbooks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_playbooks_org_type_status ON playbooks(organization_id, playbook_type, status);
CREATE INDEX IF NOT EXISTS idx_playbooks_channels_gin ON playbooks USING GIN (channels);

CREATE TABLE IF NOT EXISTS conversation_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id           TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel               TEXT NOT NULL
                          CHECK (channel IN ('whatsapp','instagram','messenger','google_reviews','linkedin_comments')),
  contact_external_id   TEXT NOT NULL,
  current_node_id       TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','completed','handed_off','expired')),
  variables             JSONB NOT NULL DEFAULT '{}'::jsonb,
  path_history          JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_count         INT NOT NULL DEFAULT 0,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_interaction_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_conversation_sessions_active
  ON conversation_sessions (playbook_id, contact_external_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_lookup
  ON conversation_sessions (organization_id, channel, contact_external_id, status);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_last_interaction
  ON conversation_sessions (last_interaction_at);

CREATE TABLE IF NOT EXISTS throttle_counters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key         TEXT NOT NULL,
  bucket            TEXT NOT NULL,
  limit_type        TEXT NOT NULL
                      CHECK (limit_type IN ('conversation_count','message_count','unique_contact_count')),
  count             INT NOT NULL DEFAULT 0,
  seen_contact_ids  TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope_key, bucket, limit_type)
);

-- ---------- LinkedIn Integration ----------
CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  used        BOOLEAN NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS linkedin_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL UNIQUE,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT,
  expires_at        TIMESTAMPTZ NOT NULL,
  linkedin_user_id  TEXT,
  linkedin_org_urn  TEXT,
  display_name      TEXT,
  granted_scopes    TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'healthy',
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS linkedin_lead_forms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  form_urn        TEXT NOT NULL,
  name            TEXT,
  new_lead_count  INT NOT NULL DEFAULT 0,
  last_synced_at  TIMESTAMPTZ,
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  auto_approve    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, form_urn)
);

CREATE TABLE IF NOT EXISTS linkedin_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_lead_id  TEXT NOT NULL UNIQUE,
  form_urn          TEXT NOT NULL,
  submitted_at      TIMESTAMPTZ,
  form_response     JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'received',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS linkedin_campaigns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL,
  campaign_urn          TEXT NOT NULL,
  name                  TEXT,
  sync_status           TEXT NOT NULL DEFAULT 'synced',
  last_synced_at        TIMESTAMPTZ,
  spend_to_date_cents   BIGINT NOT NULL DEFAULT 0,
  error_code            TEXT,
  error_detail          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_urn)
);

CREATE TABLE IF NOT EXISTS linkedin_campaign_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  campaign_urn    TEXT NOT NULL,
  date            DATE NOT NULL,
  impressions     INT NOT NULL DEFAULT 0,
  clicks          INT NOT NULL DEFAULT 0,
  ctr             NUMERIC NOT NULL DEFAULT 0,
  spend_cents     BIGINT NOT NULL DEFAULT 0,
  leads           INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, campaign_urn, date)
);

CREATE TABLE IF NOT EXISTS linkedin_conversion_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL UNIQUE,
  conversion_rule_urn   TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS linkedin_conversion_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL,
  event_id              TEXT NOT NULL,
  conversion_rule_urn   TEXT NOT NULL,
  email_hash            TEXT NOT NULL,
  value_cents           BIGINT,
  currency_code         TEXT,
  lead_id               UUID,
  status                TEXT NOT NULL DEFAULT 'sent',
  error_detail          TEXT,
  sent_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_conversion_events_user_sent ON linkedin_conversion_events (user_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS linkedin_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  post_urn          TEXT NOT NULL,
  author_urn        TEXT NOT NULL,
  as_organization   BOOLEAN NOT NULL DEFAULT false,
  text              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'published',
  media_urn         TEXT,
  media_type        TEXT,
  metrics           JSONB NOT NULL DEFAULT '{}',
  comments_cache    JSONB NOT NULL DEFAULT '[]',
  comments_synced_at TIMESTAMPTZ,
  last_synced_at    TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_urn)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_posts_user_created ON linkedin_posts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS linkedin_organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  org_urn         TEXT,
  description     TEXT,
  logo_url        TEXT,
  follower_count  INT,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS linkedin_approvals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  type              TEXT NOT NULL,
  title             TEXT NOT NULL,
  detail            TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  payload_preview   JSONB NOT NULL DEFAULT '{}',
  decision_note     TEXT,
  decided_by        TEXT,
  decided_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS linkedin_sync_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  module      TEXT NOT NULL,
  event       TEXT NOT NULL,
  status      TEXT NOT NULL,
  actor_type  TEXT NOT NULL DEFAULT 'system',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_approvals_user_status ON linkedin_approvals (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_sync_logs_user_created ON linkedin_sync_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_campaign_metrics_lookup ON linkedin_campaign_metrics (user_id, campaign_urn, date);