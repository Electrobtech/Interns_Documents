-- =====================================================================
-- Lead Automation — Multi-tenant SaaS schema (PostgreSQL)
-- Every table carries organization_id for org-wide data isolation.
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
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_name_ci_idx ON organizations (lower(name));

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
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

-- Verification codes used by the registration wizard (Step 1 2FA setup and
-- Step 5 email/mobile verification). organization_id is nullable because
-- verification can happen mid-wizard, before the tenant row exists yet.
CREATE TABLE IF NOT EXISTS verification_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL,           -- email | mobile
  target          TEXT NOT NULL,           -- the email address or phone number
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
  external_id     TEXT,                    -- raw channel identity (WhatsApp phone / IG-scoped user id / etc),
                                            -- set when a contact is first resolved from an inbound automation
                                            -- webhook rather than created manually in the CRM. NULL for
                                            -- contacts that only ever originated in-app.
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One contact per (org, channel, external id) — lets webhookController
-- find-or-create idempotently across retries/repeated messages instead of
-- spawning a duplicate contact per inbound event.
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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id),
  channel_type    TEXT NOT NULL,
  assigned_to     UUID REFERENCES users(id),
  status          TEXT DEFAULT 'open',     -- open | pending | missed | campaign | closed
  handled_by      TEXT NOT NULL DEFAULT 'bot'
                    CHECK (handled_by IN ('bot','human')),  -- who currently owns replying: the automation
                                                             -- flow, or a human agent. Flipped to 'human'
                                                             -- automatically when a Handoff node is reached
                                                             -- (see workflowEngine/webhookController), and
                                                             -- flippable either way from the inbox UI.
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL,           -- inbound | outbound
  body            TEXT,
  sender          TEXT,
  message_type    TEXT NOT NULL DEFAULT 'text', -- text | button_click | list_select | buttons | list | document | system
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb, -- raw interaction/template payload for richer rendering later
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- AI ----------
CREATE TABLE IF NOT EXISTS ai_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,           -- Support | Sales | Marketing | Voice
  type            TEXT NOT NULL,
  status          TEXT DEFAULT 'active',
  config          JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  suggestion      TEXT,
  confidence      NUMERIC,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- ---------- Google Business Profile Reviews (see migrations/004_google_reviews.sql) ----------
-- One connected Google account per organization. refresh_token is stored
-- encrypted (AES-256-GCM) when GOOGLE_TOKEN_ENC_KEY is set — see
-- services/review-service/src/google/crypto.js.
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
  account_id        TEXT NOT NULL,        -- Google resource name suffix, e.g. "accounts/123"
  account_name      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, account_id)
);

CREATE TABLE IF NOT EXISTS google_locations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  account_id        TEXT NOT NULL,
  location_id       TEXT NOT NULL,        -- Google resource name suffix, e.g. "locations/456"
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
  review_id           TEXT NOT NULL,       -- Google review resource name suffix
  reviewer_name       TEXT,
  reviewer_photo_url  TEXT,
  star_rating         INT,
  comment              TEXT,
  create_time          TIMESTAMPTZ,
  update_time          TIMESTAMPTZ,
  reply_comment         TEXT,
  reply_update_time     TIMESTAMPTZ,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_google_reviews_org_location
  ON google_reviews (organization_id, location_id);

CREATE INDEX IF NOT EXISTS idx_google_reviews_org_created
  ON google_reviews (organization_id, create_time DESC);

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

-- Helpful indexes for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_conv_org ON conversations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(conversation_id, message_type);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);

-- =====================================================================
-- Lead Automation module (WhatsApp/Instagram/Messenger playbook engine)
-- Migrated from a standalone MongoDB store — see
-- infra/db/migrations/001_automation_service_postgres.sql for the
-- standalone/incremental version of this same DDL, for databases created
-- before this migration.
--
-- Design note: a playbook's node graph (nodes[], branches, buttons, etc.)
-- is kept as a single JSONB document per playbook rather than normalized
-- into separate node/edge tables. The engine (workflowEngine.js) always
-- loads the *entire* graph into memory and walks it as a Map — no code
-- path ever queries a single node or edge in isolation — so normalizing
-- would add joins and migration overhead with no real query benefit.
-- This mirrors the schema-less "nodes" array the flow builder already
-- produces (see src/schemas/flow-schema.md) and keeps a flow document
-- atomic and easy to version as a whole. Everything that IS a real
-- relational key elsewhere (organization_id, session ids) is a normal
-- typed/PK'd/FK'd column.
-- =====================================================================

CREATE TABLE IF NOT EXISTS playbooks (
  -- Explicit, app/seed-assigned id (e.g. "pb_project_details") rather than
  -- an auto-generated UUID: the flow builder UI and its bundled demo/seed
  -- flows already reference playbooks by a stable human-chosen string id,
  -- and preserving that lets existing seed files and the frontend's
  -- offline-mock fallback ids keep resolving unchanged.
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

-- Fast lookup: every incoming webhook resolves (organization_id, status=active),
-- optionally narrowed by playbook_type. GIN lets "channel = ANY(channels)" use an index.
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

-- One active session per contact per playbook — prevents duplicate/racing
-- sessions on rapid double-webhook delivery (a common WhatsApp/Meta retry
-- scenario). Direct equivalent of the old Mongo partialFilterExpression
-- unique index, natively supported by Postgres partial indexes.
CREATE UNIQUE INDEX IF NOT EXISTS ux_conversation_sessions_active
  ON conversation_sessions (playbook_id, contact_external_id)
  WHERE status = 'active';

-- Resolves "does this contact already have an active session on this channel"
-- during inbound-webhook playbook resolution.
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_lookup
  ON conversation_sessions (organization_id, channel, contact_external_id, status);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_last_interaction
  ON conversation_sessions (last_interaction_at);

CREATE TABLE IF NOT EXISTS throttle_counters (
  -- A separate, tiny, hot-write table dedicated to counting — kept apart
  -- from conversation_sessions so high-frequency limit-check increments
  -- never contend with the larger session row (path_history/variables
  -- updates), same reasoning as the original Mongo design.
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key         TEXT NOT NULL,   -- flow: playbook_id | node: "playbook_id:node_id" | client: "client:organization_id"
  bucket            TEXT NOT NULL,   -- time-window bucket, see bucketUtils.js (e.g. "2026-07-08", "all")
  limit_type        TEXT NOT NULL
                      CHECK (limit_type IN ('conversation_count','message_count','unique_contact_count')),
  count             INT NOT NULL DEFAULT 0,
  seen_contact_ids  TEXT[] NOT NULL DEFAULT '{}', -- only populated for limit_type = unique_contact_count
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope_key, bucket, limit_type)
);