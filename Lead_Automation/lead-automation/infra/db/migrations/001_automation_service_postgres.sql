-- =====================================================================
-- Migration: 001_automation_service_postgres
--
-- Moves the Lead Automation module (services/automation-service) off its
-- standalone MongoDB store and onto the CRM's shared PostgreSQL database
-- (the same instance/pool every other service already uses via
-- @lead/shared). Safe to run against a DATABASE that already has the base
-- schema from infra/db/schema.sql loaded (organizations, users, etc).
--
-- Idempotent: every statement uses IF NOT EXISTS, so re-running this file
-- is a no-op on a database that already has it applied. This same DDL is
-- also folded into infra/db/schema.sql so a brand-new database created via
-- docker-compose (which runs schema.sql fresh) doesn't need this file too.
--
-- Run manually against an existing database with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/db/migrations/001_automation_service_postgres.sql
-- =====================================================================

BEGIN;

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

COMMIT;
