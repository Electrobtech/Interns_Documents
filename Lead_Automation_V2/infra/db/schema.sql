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
  -- Estimated/actual deal value (see migrations/030_lead_deal_value.sql).
  -- Nullable with no default: unset must stay unset, not silently 0, so
  -- Pipeline Value aggregation can tell "unknown" apart from "zero".
  deal_value      NUMERIC(14, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Last time score/stage/deal_value was written (see
  -- migrations/031_lead_updated_at.sql). Bumped at the application layer
  -- (contact-service's PUT /leads/:id and PUT /leads/:id/stage), not via a
  -- trigger — same convention as conversations.last_read_at.
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
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
  last_read_at        TIMESTAMPTZ NOT NULL DEFAULT now(), -- bumped on open; see migrations/023_conversation_last_read_at.sql
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_conversations_org_channel_external
  ON conversations (organization_id, channel_type, external_contact_id);

-- Follow-ups: Moved after conversations table to satisfy FK dependency
CREATE TABLE IF NOT EXISTS follow_ups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  due_at          TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',   -- pending | completed | cancelled
  priority        TEXT NOT NULL DEFAULT 'medium',    -- low | medium | high
  disposition     TEXT,                              -- Interested | No Response | Lost | Converted | Callback Requested ...
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  source          TEXT NOT NULL DEFAULT 'manual',     -- manual | automation
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT follow_ups_status_check   CHECK (status   IN ('pending','completed','cancelled')),
  CONSTRAINT follow_ups_priority_check CHECK (priority IN ('low','medium','high')),
  CONSTRAINT follow_ups_source_check   CHECK (source   IN ('manual','automation'))
);

CREATE INDEX IF NOT EXISTS ix_follow_ups_org_due    ON follow_ups (organization_id, status, due_at);
CREATE INDEX IF NOT EXISTS ix_follow_ups_contact     ON follow_ups (contact_id);
CREATE INDEX IF NOT EXISTS ix_follow_ups_assigned_to ON follow_ups (assigned_to);

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
  status          TEXT DEFAULT 'draft',    -- draft | scheduled | sent | needs_approval | rejected | queued | processing | completed | failed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_source     TEXT,                 -- 'csv' | 'manual' | 'segment'
  send_mode            TEXT DEFAULT 'immediate', -- 'immediate' | 'scheduled'
  throttle_per_minute  INT DEFAULT 60,       -- SMS/min rate cap for this broadcast
  total_recipients     INT DEFAULT 0,
  sent_count           INT DEFAULT 0,
  failed_count         INT DEFAULT 0
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

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  phone           TEXT NOT NULL,
  name            TEXT,
  variables       JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | queued | sent | failed
  error           TEXT,
  attempts        INT NOT NULL DEFAULT 0,
  job_id          TEXT,
  rendered_message TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_campaign_recipients_campaign_status
  ON campaign_recipients (campaign_id, status);

CREATE INDEX IF NOT EXISTS ix_campaign_recipients_campaign_phone
  ON campaign_recipients (campaign_id, phone);

-- ---------- Marketing Hub (030_marketing_hub.sql) ----------
-- Backs frontend/src/components/marketing-hub/ (Campaigns/Broadcasts/Audience
-- pages) — a separate schema from `campaigns`/`campaign_recipients` above,
-- which back the older Bulk Messaging feature and use a simpler
-- single-channel-blast shape. This one carries the richer marketing-campaign
-- fields (objective, budget, per-channel ROAS-style analytics) that hub's UI
-- needs, plus the fuller delivery-status set (queued/sending/sent/delivered/
-- read/replied/failed) a WhatsApp/Email-style channel actually reports.
CREATE TABLE IF NOT EXISTS mh_audiences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'custom', -- custom | pixel | lookalike | import | crm
  filter            JSONB NOT NULL DEFAULT '{}',    -- { "tags": ["vip","q3-leads"] } — tag-based, matches what contact-service can resolve
  size_cached       INT,
  size_computed_at  TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'active',
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_mh_audiences_org ON mh_audiences (organization_id);

CREATE TABLE IF NOT EXISTS mh_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('campaign','broadcast')),
  name              TEXT NOT NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('whatsapp','email','sms','messenger','instagram','linkedin')),
  objective         TEXT,          -- campaign-only (Lead Generation, Sales, ...)
  audience_id       UUID REFERENCES mh_audiences(id) ON DELETE SET NULL,
  message_body      TEXT,          -- required before /publish
  budget_amount     NUMERIC(12,2), -- campaign-only
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','scheduled','queued','processing','completed','failed','paused','archived')),
  scheduled_at      TIMESTAMPTZ,
  start_date        DATE,
  end_date          DATE,
  total_recipients  INT NOT NULL DEFAULT 0,
  sent_count        INT NOT NULL DEFAULT 0,
  delivered_count   INT NOT NULL DEFAULT 0,
  read_count        INT NOT NULL DEFAULT 0,
  replied_count     INT NOT NULL DEFAULT 0,
  failed_count      INT NOT NULL DEFAULT 0,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Enforced at the DB, not just the API — LinkedIn broadcasts are rejected
  -- by the route handler too (belt and suspenders, same discipline as the
  -- rest of this schema).
  CONSTRAINT mh_no_linkedin_broadcast CHECK (NOT (channel = 'linkedin' AND kind = 'broadcast'))
);
CREATE INDEX IF NOT EXISTS ix_mh_campaigns_org_kind_status ON mh_campaigns (organization_id, kind, status);
CREATE INDEX IF NOT EXISTS ix_mh_campaigns_audience ON mh_campaigns (audience_id) WHERE audience_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mh_recipients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES mh_campaigns(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  channel             TEXT NOT NULL,
  destination         TEXT NOT NULL, -- phone/email/external_id, snapshotted at enqueue time
  display_name        TEXT,
  rendered_message    TEXT,
  status              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','sending','sent','delivered','read','replied','failed')),
  attempts            INT NOT NULL DEFAULT 0,
  error               TEXT,
  job_id              TEXT,
  provider_message_id TEXT,
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  replied_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_mh_recipients_campaign_status ON mh_recipients (campaign_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_mh_recipients_campaign_destination ON mh_recipients (campaign_id, destination);

-- Append-only — the source future analytics/reports pages aggregate from,
-- same rationale as orbq's own DeliveryEvent design comment: a redelivered
-- status update or an out-of-order webhook must not silently overwrite
-- history the way a mutable counter would.
CREATE TABLE IF NOT EXISTS mh_delivery_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES mh_recipients(id) ON DELETE CASCADE,
  campaign_id   UUID NOT NULL REFERENCES mh_campaigns(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN ('queued','sending','sent','delivered','read','replied','failed')),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload       JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS ix_mh_delivery_events_campaign ON mh_delivery_events (campaign_id, occurred_at);

-- Realtime fan-out for live recipient-status updates — mirrors
-- notify_new_message() above exactly. mh_recipients has no organization_id
-- column of its own (matches campaign_recipients' EXISTS-based RLS
-- convention below), so the org id is looked up via its parent campaign.
CREATE OR REPLACE FUNCTION notify_mh_recipient_update() RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id FROM mh_campaigns WHERE id = NEW.campaign_id;
  PERFORM pg_notify(
    'marketing_hub_channel',
    json_build_object(
      'recipient_id', NEW.id,
      'campaign_id', NEW.campaign_id,
      'organization_id', org_id,
      'status', NEW.status
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mh_recipients_notify_trigger ON mh_recipients;
CREATE TRIGGER mh_recipients_notify_trigger
  AFTER INSERT OR UPDATE OF status ON mh_recipients
  FOR EACH ROW EXECUTE FUNCTION notify_mh_recipient_update();

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

-- ---------- Google Calendar Integration ----------
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
  google_event_id     TEXT,
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

-- ---------- SMS Devices ----------
CREATE TABLE IF NOT EXISTS sms_devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  phone_number      TEXT,
  webhook_token     TEXT NOT NULL UNIQUE,
  connected         BOOLEAN NOT NULL DEFAULT true,
  last_message_at   TIMESTAMPTZ,
  message_count     INTEGER NOT NULL DEFAULT 0,
  last_raw_payload  JSONB,
  locked_at         TIMESTAMPTZ,
  locked_by         UUID REFERENCES users(id) ON DELETE SET NULL,
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
-- type: 'generic' | 'ui_click' | 'followup_due'. contact_id/follow_up_id
-- are populated for 'followup_due' rows (see notification-service's poller,
-- which turns a follow-up's due_at coming due into one of these) so the
-- bell dropdown's click-through has something to navigate to.
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  type            TEXT NOT NULL DEFAULT 'generic',
  title           TEXT,
  body            TEXT,
  contact_id      UUID REFERENCES contacts(id) ON DELETE CASCADE,
  follow_up_id    UUID REFERENCES follow_ups(id) ON DELETE CASCADE,
  read            BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stops the follow-up poller from inserting a duplicate notification for
-- the same follow-up on every ~60s poll cycle.
CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_org_followup
  ON notifications (organization_id, follow_up_id)
  WHERE follow_up_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_notifications_org_created
  ON notifications (organization_id, created_at DESC);

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

-- ---------- Marketing Hub ----------
CREATE TABLE IF NOT EXISTS mh_audiences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  filter             JSONB NOT NULL,  -- {tags: ["tag1", "tag2"]}
  size_cached        INTEGER DEFAULT 0,
  size_computed_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_campaigns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  kind               TEXT NOT NULL CHECK (kind IN ('campaign', 'broadcast')),
  channel            TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin')),
  audience_id        UUID REFERENCES mh_audiences(id),
  message_body       TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'failed')),
  
  -- Aggregate counters (re-derived from mh_recipients)
  sent_count         INTEGER DEFAULT 0,
  delivered_count    INTEGER DEFAULT 0,
  read_count         INTEGER DEFAULT 0,
  replied_count      INTEGER DEFAULT 0,
  failed_count       INTEGER DEFAULT 0,
  
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Business rule: LinkedIn broadcasts not allowed
  CONSTRAINT mh_no_linkedin_broadcast CHECK (NOT (channel='linkedin' AND kind='broadcast'))
);

CREATE TABLE IF NOT EXISTS mh_recipients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID REFERENCES mh_campaigns(id) ON DELETE CASCADE,
  contact_id           UUID REFERENCES contacts(id) ON DELETE CASCADE,
  destination          TEXT NOT NULL,  -- phone/email/handle
  status               TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'read', 'replied', 'failed')),
  attempts             INTEGER DEFAULT 0,
  job_id               TEXT,
  provider_message_id  TEXT,
  error_message        TEXT,
  last_attempted_at    TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_delivery_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id       UUID REFERENCES mh_recipients(id) ON DELETE CASCADE,
  event_type         TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'read', 'replied', 'failed')),
  provider_data      JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for Marketing Hub
CREATE INDEX IF NOT EXISTS idx_mh_campaigns_org ON mh_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_mh_campaigns_kind ON mh_campaigns(kind);
CREATE INDEX IF NOT EXISTS idx_mh_campaigns_status ON mh_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_mh_recipients_campaign ON mh_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mh_recipients_status ON mh_recipients(status);
CREATE INDEX IF NOT EXISTS idx_mh_delivery_events_recipient ON mh_delivery_events(recipient_id);

-- Trigger for marketing hub recipient updates
CREATE OR REPLACE FUNCTION notify_mh_recipient_update() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('marketing_hub_channel', 
    json_build_object(
      'event', 'recipient_updated',
      'campaign_id', NEW.campaign_id,
      'recipient_id', NEW.id,
      'status', NEW.status
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mh_recipient_update_notify 
AFTER UPDATE ON mh_recipients 
FOR EACH ROW EXECUTE FUNCTION notify_mh_recipient_update();

-- ---------- Content Studio & Asset Management ----------
CREATE TABLE IF NOT EXISTS mh_assets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('image', 'video', 'document', 'audio', 'template')),
  file_path          TEXT NOT NULL,
  file_size          INTEGER,
  mime_type          TEXT,
  metadata           JSONB DEFAULT '{}',
  tags               TEXT[] DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  category           TEXT NOT NULL,
  channel            TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin')),
  content            JSONB NOT NULL,  -- {subject, body, variables, assets}
  preview_data       JSONB,
  usage_count        INTEGER DEFAULT 0,
  is_public          BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_content_studio (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('post', 'campaign', 'template', 'asset')),
  channel            TEXT CHECK (channel IN ('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin')),
  content            JSONB NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  scheduled_at       TIMESTAMPTZ,
  tags               TEXT[] DEFAULT '{}',
  performance        JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- SEO & AEO Tools ----------
CREATE TABLE IF NOT EXISTS mh_seo_keywords (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  keyword            TEXT NOT NULL,
  search_volume      INTEGER DEFAULT 0,
  difficulty         INTEGER DEFAULT 0,
  current_rank       INTEGER,
  target_rank        INTEGER,
  url                TEXT,
  competition        NUMERIC(3,2) DEFAULT 0.0,
  cpc                NUMERIC(10,2) DEFAULT 0.0,
  trend_data         JSONB DEFAULT '{}',
  last_checked       TIMESTAMPTZ DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_seo_audits (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  url                TEXT NOT NULL,
  audit_type         TEXT NOT NULL CHECK (audit_type IN ('technical', 'content', 'backlinks', 'performance')),
  score              INTEGER DEFAULT 0,
  issues             JSONB DEFAULT '[]',
  recommendations    JSONB DEFAULT '[]',
  audit_data         JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_aeo_optimization (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  query              TEXT NOT NULL,
  answer_type        TEXT CHECK (answer_type IN ('featured_snippet', 'local_pack', 'knowledge_panel', 'video', 'image')),
  current_content    TEXT,
  optimized_content  TEXT,
  optimization_tips  JSONB DEFAULT '[]',
  performance        JSONB DEFAULT '{}',
  status             TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'optimizing', 'completed', 'monitoring')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Competitor Analysis ----------
CREATE TABLE IF NOT EXISTS mh_competitors (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  domain             TEXT,
  industry           TEXT,
  channels           TEXT[] DEFAULT '{}',
  tracking_keywords  TEXT[] DEFAULT '{}',
  social_handles     JSONB DEFAULT '{}',
  metadata           JSONB DEFAULT '{}',
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_competitor_analysis (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id      UUID REFERENCES mh_competitors(id) ON DELETE CASCADE,
  analysis_type      TEXT NOT NULL CHECK (analysis_type IN ('seo', 'content', 'social', 'ads', 'pricing', 'features')),
  metrics            JSONB NOT NULL,
  insights           JSONB DEFAULT '{}',
  recommendations    TEXT[],
  analysis_date      TIMESTAMPTZ DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Marketing Calendar & Scheduling ----------
CREATE TABLE IF NOT EXISTS mh_calendar_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  description        TEXT,
  event_type         TEXT NOT NULL CHECK (event_type IN ('campaign', 'broadcast', 'content', 'meeting', 'deadline', 'launch')),
  start_date         TIMESTAMPTZ NOT NULL,
  end_date           TIMESTAMPTZ,
  all_day            BOOLEAN DEFAULT false,
  campaign_id        UUID REFERENCES mh_campaigns(id) ON DELETE CASCADE,
  content_id         UUID REFERENCES mh_content_studio(id) ON DELETE SET NULL,
  assignees          UUID[] DEFAULT '{}',
  status             TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  metadata           JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Knowledge Base ----------
CREATE TABLE IF NOT EXISTS mh_knowledge_articles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  content            TEXT NOT NULL,
  category           TEXT,
  tags               TEXT[] DEFAULT '{}',
  author_id          UUID REFERENCES users(id),
  status             TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  view_count         INTEGER DEFAULT 0,
  helpful_count      INTEGER DEFAULT 0,
  search_vector      TSVECTOR,
  metadata           JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Settings & Configuration ----------
CREATE TABLE IF NOT EXISTS mh_settings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  category           TEXT NOT NULL,
  key                TEXT NOT NULL,
  value              JSONB NOT NULL,
  description        TEXT,
  is_public          BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, category, key)
);

CREATE TABLE IF NOT EXISTS mh_integrations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider           TEXT NOT NULL,
  service_type       TEXT NOT NULL CHECK (service_type IN ('seo', 'analytics', 'social', 'crm', 'email', 'storage')),
  credentials        JSONB NOT NULL,
  configuration      JSONB DEFAULT '{}',
  status             TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  last_sync          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Additional indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_mh_assets_org_type ON mh_assets(organization_id, type);
CREATE INDEX IF NOT EXISTS idx_mh_templates_org_category ON mh_templates(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_mh_content_studio_org_status ON mh_content_studio(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_mh_seo_keywords_org ON mh_seo_keywords(organization_id);
CREATE INDEX IF NOT EXISTS idx_mh_competitors_org ON mh_competitors(organization_id);
CREATE INDEX IF NOT EXISTS idx_mh_calendar_events_org_date ON mh_calendar_events(organization_id, start_date);
CREATE INDEX IF NOT EXISTS idx_mh_knowledge_articles_search ON mh_knowledge_articles USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_mh_settings_org_category ON mh_settings(organization_id, category);

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

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS flow_playbook_id TEXT REFERENCES playbooks(id);

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

-- ---------- Platform Super Admin & Billing ----------
CREATE TABLE IF NOT EXISTS platform_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active', -- active | disabled
  role          TEXT NOT NULL DEFAULT 'super_admin'
                  CHECK (role IN ('super_admin', 'billing_admin', 'support_lead')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  active      BOOLEAN NOT NULL DEFAULT true,
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at     TIMESTAMPTZ,
  created_by  UUID REFERENCES platform_admins(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_active_window
  ON platform_announcements (active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS platform_service_status (
  service_key TEXT PRIMARY KEY CHECK (service_key IN (
                'meta_whatsapp', 'meta_instagram', 'meta_messenger',
                'twilio_sms', 'llm_provider', 'razorpay'
              )),
  label       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'operational'
                CHECK (status IN ('operational', 'degraded', 'outage')),
  note        TEXT,
  updated_by  UUID REFERENCES platform_admins(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_service_status (service_key, label) VALUES
  ('meta_whatsapp',   'WhatsApp Cloud API'),
  ('meta_instagram',  'Instagram Messaging API'),
  ('meta_messenger',  'Messenger Platform API'),
  ('twilio_sms',      'Twilio (SMS/RCS)'),
  ('llm_provider',    'LLM Provider'),
  ('razorpay',        'Razorpay')
ON CONFLICT (service_key) DO NOTHING;

-- ---------- Channel subscription billing ----------

-- Our own price catalogue per channel — platform-admin managed, not per-org.
CREATE TABLE IF NOT EXISTS channel_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type    TEXT NOT NULL CHECK (channel_type IN
                    ('whatsapp','messenger','instagram','linkedin','email','sms')),
  our_fee_amount  NUMERIC(14,2) NOT NULL CHECK (our_fee_amount >= 0),
  currency        TEXT NOT NULL DEFAULT 'INR',
  billing_period  TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','annual')),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_plans_active_channel_period
  ON channel_plans (channel_type, billing_period) WHERE active;

-- Which channels an org is subscribed to, at what (snapshotted) price.
CREATE TABLE IF NOT EXISTS organization_channel_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_type    TEXT NOT NULL CHECK (channel_type IN
                    ('whatsapp','messenger','instagram','linkedin','email','sms')),
  channel_plan_id UUID REFERENCES channel_plans(id),
  price_amount    NUMERIC(14,2) NOT NULL CHECK (price_amount >= 0),
  currency        TEXT NOT NULL DEFAULT 'INR',
  billing_period  TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','annual')),
  status          TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','active','paused','cancelled')),
  trial_ends_at   TIMESTAMPTZ,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_org_channel_sub_live
  ON organization_channel_subscriptions (organization_id, channel_type)
  WHERE status IN ('pending_payment','active','paused');
CREATE INDEX IF NOT EXISTS idx_org_channel_sub_org
  ON organization_channel_subscriptions (organization_id);

-- Meta's rate card (per channel_type/category/recipient country)
CREATE TABLE IF NOT EXISTS meta_rate_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type    TEXT NOT NULL CHECK (channel_type IN ('whatsapp','messenger','instagram')),
  category        TEXT NOT NULL CHECK (category IN ('marketing','utility','authentication','service')),
  country_code    TEXT NOT NULL DEFAULT '*',
  meta_rate       NUMERIC(14,4) NOT NULL CHECK (meta_rate >= 0),
  currency        TEXT NOT NULL DEFAULT 'INR',
  gst_percent     NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  bsp_markup      NUMERIC(14,4) NOT NULL DEFAULT 0,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_rate_cards_lookup
  ON meta_rate_cards (channel_type, category, country_code, effective_from DESC) WHERE active;

-- SMS rate card
CREATE TABLE IF NOT EXISTS sms_rate_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_type      TEXT NOT NULL CHECK (route_type IN ('promotional','transactional','otp')),
  per_sms_rate    NUMERIC(14,4) NOT NULL CHECK (per_sms_rate >= 0),
  currency        TEXT NOT NULL DEFAULT 'INR',
  gst_percent     NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_rate_cards_lookup
  ON sms_rate_cards (route_type, effective_from DESC) WHERE active;

-- The % markup we add on top of Meta's/SMS's actual cost.
CREATE TABLE IF NOT EXISTS billing_markup_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  markup_percent    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (markup_percent >= 0),
  updated_by_admin  UUID REFERENCES platform_admins(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_markup_default
  ON billing_markup_config ((organization_id IS NULL)) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_markup_org
  ON billing_markup_config (organization_id) WHERE organization_id IS NOT NULL;

-- WhatsApp campaign billing ledger
CREATE TABLE IF NOT EXISTS whatsapp_billing_ledger (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_type            TEXT NOT NULL CHECK (entry_type IN ('reservation','charge','refund')),
  status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled','released')),
  amount                NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency              TEXT NOT NULL DEFAULT 'INR',
  campaign_id           UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  category              TEXT CHECK (category IN ('marketing','utility','authentication','service')),
  recipient_count       INT,
  reserved_by_entry_id  UUID REFERENCES whatsapp_billing_ledger(id),
  note                  TEXT,
  settled_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_ledger_org_created
  ON whatsapp_billing_ledger (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_ledger_campaign
  ON whatsapp_billing_ledger (campaign_id) WHERE campaign_id IS NOT NULL;

-- Per-message Meta usage audit trail
CREATE TABLE IF NOT EXISTS meta_usage_charges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_type      TEXT NOT NULL CHECK (channel_type IN ('whatsapp','messenger','instagram')),
  category          TEXT NOT NULL CHECK (category IN ('marketing','utility','authentication','service')),
  recipient_country TEXT,
  meta_rate         NUMERIC(14,4) NOT NULL,
  markup_percent    NUMERIC(5,2) NOT NULL DEFAULT 0,
  bsp_markup        NUMERIC(14,4) NOT NULL DEFAULT 0,
  gst_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantity          INT NOT NULL CHECK (quantity > 0),
  total_amount      NUMERIC(14,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'INR',
  period            DATE NOT NULL,
  campaign_id       UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  reference_id      TEXT,
  invoiced          BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_usage_org_period ON meta_usage_charges (organization_id, period);
CREATE INDEX IF NOT EXISTS idx_meta_usage_campaign ON meta_usage_charges (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meta_usage_uninvoiced ON meta_usage_charges (organization_id) WHERE NOT invoiced;

-- SMS usage audit trail
CREATE TABLE IF NOT EXISTS sms_usage_charges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  route_type        TEXT NOT NULL CHECK (route_type IN ('promotional','transactional','otp')),
  per_sms_rate      NUMERIC(14,4) NOT NULL,
  markup_percent    NUMERIC(5,2) NOT NULL DEFAULT 0,
  gst_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantity          INT NOT NULL CHECK (quantity > 0),
  total_amount      NUMERIC(14,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'INR',
  period            DATE NOT NULL,
  campaign_id       UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  dlt_template_id   TEXT,
  sender_id         TEXT,
  reference_id      TEXT,
  invoiced          BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_usage_org_period ON sms_usage_charges (organization_id, period);
CREATE INDEX IF NOT EXISTS idx_sms_usage_campaign ON sms_usage_charges (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_usage_uninvoiced ON sms_usage_charges (organization_id) WHERE NOT invoiced;

CREATE TABLE IF NOT EXISTS wallets (
  organization_id       UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  balance               NUMERIC(14,2) NOT NULL DEFAULT 0,
  lifetime_deposited    NUMERIC(14,2) NOT NULL DEFAULT 0,
  lifetime_spent        NUMERIC(14,2) NOT NULL DEFAULT 0,
  low_balance_threshold NUMERIC(14,2) NOT NULL DEFAULT 100,
  credit_rates          JSONB NOT NULL DEFAULT '{"whatsapp_message": 1, "workflow_execution": 1}'::jsonb,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('RECHARGE', 'USAGE_DEDUCTION', 'ADJUSTMENT')),
  amount            NUMERIC(14,2) NOT NULL,
  balance_after     NUMERIC(14,2) NOT NULL,
  reference_id      TEXT,
  description       TEXT,
  action_key        TEXT,
  created_by_user   UUID REFERENCES users(id),
  created_by_admin  UUID REFERENCES platform_admins(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_org_created ON wallet_transactions (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purpose             TEXT NOT NULL CHECK (purpose IN ('WALLET_RECHARGE', 'ECOMMERCE_ORDER', 'WALKIN_SALE', 'SUBSCRIPTION_CHARGE', 'INVOICE_SETTLEMENT')),
  reference_id        UUID, -- ecommerce_orders.id for ECOMMERCE_ORDER / WALKIN_SALE
  contact_id          UUID REFERENCES contacts(id),
  amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency            TEXT NOT NULL DEFAULT 'INR',
  method              TEXT,
  status              TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pending', 'paid', 'failed', 'refunded')),
  gateway             TEXT DEFAULT 'razorpay',
  gateway_order_id    TEXT,
  gateway_payment_id  TEXT,
  gateway_signature   TEXT,
  notes               JSONB,
  created_by_user     UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_org_created ON payments (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order_id ON payments (gateway_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_gateway_payment_id ON payments (gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan                  TEXT,
  status                TEXT DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  billing_cycle         TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount                NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'INR',
  auto_billing          BOOLEAN NOT NULL DEFAULT true,
  current_period_start  DATE NOT NULL DEFAULT current_date,
  current_period_end    DATE NOT NULL DEFAULT (current_date + INTERVAL '1 month'),
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
  canceled_at           TIMESTAMPTZ,
  updated_by_admin      UUID REFERENCES platform_admins(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);

CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number      TEXT UNIQUE,
  subscription_id     UUID REFERENCES subscriptions(id),
  payment_id          UUID REFERENCES payments(id),
  billing_period_start DATE,
  billing_period_end   DATE,
  seller_gstin        TEXT,
  seller_state_code   TEXT,
  buyer_legal_name    TEXT,
  buyer_gstin         TEXT,
  buyer_state         TEXT,
  buyer_state_code    TEXT,
  place_of_supply     TEXT,
  hsn_sac_code        TEXT DEFAULT '998314',
  line_items          JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal            NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_rate           NUMERIC(5,2) NOT NULL DEFAULT 0,
  cgst_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_rate           NUMERIC(5,2) NOT NULL DEFAULT 0,
  sgst_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_rate           NUMERIC(5,2) NOT NULL DEFAULT 0,
  igst_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_tax           NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  due_date            DATE,
  issued_at           TIMESTAMPTZ,
  pdf_url             TEXT,
  pdf_generated_at    TIMESTAMPTZ,
  generated_by_admin  UUID REFERENCES platform_admins(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org_created ON invoices (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices (subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment ON invoices (payment_id);

-- Itemized invoice lines — indirectly scoped via invoice_id -> invoices.organization_id.
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN
                  ('saas_channel_fee','meta_passthrough','sms_passthrough','bsp_markup','other')),
  channel_type  TEXT,
  description   TEXT NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  unit_amount   NUMERIC(14,2) NOT NULL,
  total_amount  NUMERIC(14,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items (invoice_id);

CREATE TABLE IF NOT EXISTS invoice_counters (
  financial_year TEXT PRIMARY KEY,
  last_number    INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key        TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT false,
  updated_by_admin UUID REFERENCES platform_admins(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, flag_key)
);

CREATE TABLE IF NOT EXISTS attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_type      TEXT NOT NULL,
  owner_id        UUID NOT NULL,
  file_url        TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      INT,
  uploaded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_owner ON attachments (organization_id, owner_type, owner_id);

-- ---------- Channel Quotas ----------
CREATE TABLE IF NOT EXISTS channel_quotas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel                 TEXT NOT NULL CHECK (channel IN (
                            'whatsapp', 'instagram', 'messenger', 'linkedin',
                            'sms_rcs', 'webchat', 'voice', 'email'
                          )),
  enabled                 BOOLEAN NOT NULL DEFAULT true,
  monthly_quota           INT,
  quota_used              INT NOT NULL DEFAULT 0,
  quota_period_start      DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  low_quota_threshold_pct INT NOT NULL DEFAULT 80 CHECK (low_quota_threshold_pct BETWEEN 1 AND 100),
  disabled_reason         TEXT,
  updated_by_admin        UUID REFERENCES platform_admins(id),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_channel_quotas_org ON channel_quotas (organization_id);

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

-- ---------- Products / Offers ----------
CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT,
  status            TEXT NOT NULL DEFAULT 'active',
  tagline           TEXT,
  description       TEXT,
  price_display     TEXT,
  price_amount      NUMERIC(12,2),
  currency          TEXT DEFAULT 'INR',
  billing_period    TEXT,
  value_props       TEXT[] NOT NULL DEFAULT '{}',
  target_segments   TEXT[] NOT NULL DEFAULT '{}',
  objections        TEXT[] NOT NULL DEFAULT '{}',
  differentiators   TEXT[] NOT NULL DEFAULT '{}',
  keywords          TEXT[] NOT NULL DEFAULT '{}',
  tone              TEXT,
  claims_to_avoid   TEXT[] NOT NULL DEFAULT '{}',
  landing_url       TEXT,
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_products_org        ON products (organization_id);
CREATE INDEX IF NOT EXISTS ix_products_org_status ON products (organization_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_one_primary
  ON products (organization_id) WHERE is_primary;

ALTER TABLE campaigns       ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
-- See infra/db/migrations/032_lead_product_id.sql — which product/section a
-- lead is associated with, so the Sales Agent's Forecasting tab can break
-- pipeline value, targets, and gap analysis down per product instead of
-- only org-wide.
ALTER TABLE leads           ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_campaigns_product ON campaigns (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_leads_product     ON leads     (product_id) WHERE product_id IS NOT NULL;

-- ---------- Message Templates ----------
CREATE TABLE IF NOT EXISTS message_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'MARKETING',
  language          TEXT NOT NULL DEFAULT 'en_US',
  channels          TEXT[] NOT NULL DEFAULT '{WHATSAPP}',
  status            TEXT NOT NULL DEFAULT 'PENDING',
  header_type       TEXT NOT NULL DEFAULT 'NONE',
  header_text       TEXT,
  header_media_url  TEXT,
  body              TEXT NOT NULL DEFAULT '',
  body_variables    JSONB NOT NULL DEFAULT '{}',
  footer            TEXT,
  buttons           JSONB NOT NULL DEFAULT '[]',
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_message_templates_org         ON message_templates (organization_id);
CREATE INDEX IF NOT EXISTS ix_message_templates_org_status  ON message_templates (organization_id, status);
CREATE INDEX IF NOT EXISTS ix_message_templates_channels    ON message_templates USING GIN (channels);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_campaigns_template ON campaigns (template_id) WHERE template_id IS NOT NULL;

CREATE OR REPLACE FUNCTION create_wallet_for_new_org() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (organization_id) VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_wallet_for_new_org ON organizations;
CREATE TRIGGER trg_create_wallet_for_new_org
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_wallet_for_new_org();

-- ---------- Marketing Hub Assets Library ----------
-- Owned by marketing-hub-service. File blobs on local disk under
-- public/uploads/marketing-assets; this table holds metadata + tenant scope.
CREATE TABLE IF NOT EXISTS marketing_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN (
                      'Logos', 'Images', 'Videos', 'PDFs', 'AI Generated Images'
                    )),
  size_bytes        BIGINT NOT NULL DEFAULT 0,
  storage_url       TEXT NOT NULL,
  mime_type         TEXT,

  uploaded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_marketing_assets_org
  ON marketing_assets (organization_id);
CREATE INDEX IF NOT EXISTS ix_marketing_assets_org_type
  ON marketing_assets (organization_id, type);
CREATE INDEX IF NOT EXISTS ix_marketing_assets_org_created
  ON marketing_assets (organization_id, created_at DESC);

-- ---------- Marketing Hub Audiences ----------
-- Owned by marketing-hub-service. Contact-service only has tag-based
-- segments (GET /contacts/segments = DISTINCT tags + counts). That is too
-- thin for the Audience Manager UI (source, score, status, filter rules,
-- growth chart), so we keep a dedicated marketing_audiences table here
-- rather than overloading contacts.tags.
CREATE TABLE IF NOT EXISTS marketing_audiences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  source             TEXT NOT NULL DEFAULT 'Custom'
                       CHECK (source IN ('Custom', 'Pixel', 'Lookalike', 'Import', 'CRM')),
  size               BIGINT NOT NULL DEFAULT 0,
  score              INTEGER,
  status             TEXT NOT NULL DEFAULT 'Active'
                       CHECK (status IN ('Active', 'Archived')),
  filter_definition  JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_marketing_audiences_org
  ON marketing_audiences (organization_id);
CREATE INDEX IF NOT EXISTS ix_marketing_audiences_org_status
  ON marketing_audiences (organization_id, status);
CREATE INDEX IF NOT EXISTS ix_marketing_audiences_org_created
  ON marketing_audiences (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_audience_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id   UUID NOT NULL REFERENCES marketing_audiences(id) ON DELETE CASCADE,
  size          BIGINT NOT NULL DEFAULT 0,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_marketing_audience_snapshots_audience_captured
  ON marketing_audience_snapshots (audience_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS ix_marketing_audience_snapshots_captured
  ON marketing_audience_snapshots (captured_at);

-- ---------- Marketing Hub Campaigns (ad-platform tracking) ----------
-- DECISION: metrics are manually entered CRUD — no Meta/Google Ads OAuth
-- or webhook sync. Kept separate from campaign-service's `campaigns` table
-- (outbound WhatsApp/SMS/email broadcasts). See migrations/034_marketing_campaigns.sql.
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


-- ---------- Marketing Hub Broadcasts (one-to-many sends) ----------
-- DECISION: own table in marketing-hub-service; /send uses same simulation
-- convention as campaign-service bulkCampaignWorker (no real carrier wired).
-- See migrations/035_marketing_broadcasts.sql.
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

-- ---------- Marketing Hub Calendar (standalone meeting/reminder events) ----------
-- Campaign/broadcast events are derived at read time from marketing_campaigns
-- and marketing_broadcasts — not stored here. See migrations/036_marketing_calendar_events.sql.
CREATE TABLE IF NOT EXISTS marketing_calendar_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  title             TEXT NOT NULL,
  type              TEXT NOT NULL
                      CHECK (type IN ('meeting', 'reminder')),
  date              DATE NOT NULL,
  color             TEXT NOT NULL DEFAULT '#3b82f6',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_marketing_calendar_events_org
  ON marketing_calendar_events (organization_id);
CREATE INDEX IF NOT EXISTS ix_marketing_calendar_events_org_date
  ON marketing_calendar_events (organization_id, date);

-- ---------- Imported Sheets (Support Agent Import tab: saved, editable spreadsheets) ----------
-- See migrations/037_imported_sheets.sql for full column notes.
CREATE TABLE IF NOT EXISTS imported_sheets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name              TEXT NOT NULL,
  source            TEXT NOT NULL
                      CHECK (source IN ('upload', 'google_sheets')),
  source_ref        TEXT,

  headers           JSONB NOT NULL DEFAULT '[]'::jsonb,
  rows              JSONB NOT NULL DEFAULT '[]'::jsonb,

  last_imported_at  TIMESTAMPTZ,

  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_imported_sheets_org
  ON imported_sheets (organization_id);
CREATE INDEX IF NOT EXISTS ix_imported_sheets_org_updated
  ON imported_sheets (organization_id, updated_at DESC);