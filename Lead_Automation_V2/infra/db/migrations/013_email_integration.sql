-- 013_email_integration.sql
--
-- Gmail email integration (services/email-service). Adds the dedicated
-- email_* tables (full-fidelity mailbox data: threads, messages, MIME
-- headers, attachments) plus two small additive columns on the existing
-- shared `conversations` / `messages` tables so a connected mailbox also
-- shows up in the Unified Inbox alongside WhatsApp/Instagram/Facebook,
-- the same way services/integration-service's conversationStore.js
-- already does for those channels.
--
-- Run this file by hand against any database that was already initialized
-- before this change (docker-entrypoint-initdb.d only runs against an
-- empty Postgres volume):
--   psql "$DATABASE_URL" -f infra/db/migrations/013_email_integration.sql
--
-- NOTE: infra/db/schema.sql has already been updated with the same tables
-- for fresh installs. infra/db/rls.sql's tenant_isolation policy is added
-- generically for every organization_id-scoped table (see that file) — the
-- four new tables below only need to be added to its table list.

-- ---------------------------------------------------------------------
-- Backfill: services/integration-service/src/services/conversationStore.js
-- has referenced conversations.external_contact_id and
-- messages.media_url / messages.media_type / messages.external_id since
-- it was written, but no prior migration ever actually added them — this
-- closes that gap at the same time, since email needs the same columns.
-- ---------------------------------------------------------------------
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS external_contact_id TEXT;
CREATE INDEX IF NOT EXISTS ix_conversations_org_channel_external
  ON conversations (organization_id, channel_type, external_contact_id);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url    TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type   TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS external_id  TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject      TEXT; -- email-specific, NULL for every other channel

-- ---------------------------------------------------------------------
-- One connected Gmail mailbox per row. An organization can connect more
-- than one mailbox (e.g. sales@ and support@), so this is NOT unique on
-- organization_id alone.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL DEFAULT 'gmail',   -- 'gmail' only for now — see routes/auth.js
  email             TEXT NOT NULL,
  access_token      TEXT,                            -- encrypted at rest, see services/crypto.js
  refresh_token     TEXT,                            -- encrypted at rest
  token_expires_at  TIMESTAMPTZ,
  scope             TEXT,
  connected         BOOLEAN NOT NULL DEFAULT true,
  connected_by      UUID REFERENCES users(id),
  history_id        TEXT,                            -- Gmail historyId watermark, drives incremental sync
  watch_expires_at  TIMESTAMPTZ,                      -- users.watch() push-notification lease (~7 days)
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
  thread_id          TEXT NOT NULL,                   -- Gmail threadId
  conversation_id    UUID REFERENCES conversations(id) ON DELETE SET NULL, -- link into the Unified Inbox
  subject            TEXT,
  participants        TEXT[] DEFAULT '{}',
  last_message_time   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_account_id, thread_id)
);

CREATE TABLE IF NOT EXISTS email_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email_account_id  UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  thread_id         UUID REFERENCES email_threads(id) ON DELETE CASCADE,
  message_id        TEXT NOT NULL,                    -- Gmail message id
  rfc822_message_id TEXT,                              -- Message-Id header, needed for In-Reply-To/References
  in_reply_to       TEXT,
  from_email        TEXT,
  to_email           TEXT[] DEFAULT '{}',
  cc_email           TEXT[] DEFAULT '{}',
  subject            TEXT,
  body               TEXT,                             -- plain-text body
  html_body          TEXT,
  snippet            TEXT,
  direction          TEXT NOT NULL,                     -- inbound | outbound
  status             TEXT NOT NULL DEFAULT 'received',  -- received | sent | failed | draft
  label_ids          TEXT[] DEFAULT '{}',                -- Gmail labelIds, e.g. UNREAD/IMPORTANT/custom labels
  has_attachments    BOOLEAN NOT NULL DEFAULT false,
  received_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_account_id, message_id)
);

CREATE INDEX IF NOT EXISTS ix_email_messages_thread ON email_messages (thread_id, received_at);

CREATE TABLE IF NOT EXISTS email_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID REFERENCES email_messages(id) ON DELETE CASCADE,
  filename        TEXT,
  mime_type       TEXT,
  size            INT,
  gmail_attachment_id TEXT,   -- Gmail's internal attachment id, used to lazily fetch bytes on demand
  url             TEXT,       -- set once downloaded to local/object storage (services/attachments.js)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_email_attachments_message ON email_attachments (message_id);
