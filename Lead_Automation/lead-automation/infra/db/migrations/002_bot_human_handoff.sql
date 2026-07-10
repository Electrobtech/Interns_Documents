-- 002_bot_human_handoff.sql
--
-- Adds the plumbing needed for the automation flow's Handoff node to surface
-- in the CRM's Conversation view as an actual bot/human toggle, instead of
-- only existing as internal automation-service session state.
--
-- NOTE: infra/db/schema.sql has already been updated with these same
-- columns for fresh installs (docker-entrypoint-initdb.d only runs against
-- an empty Postgres volume). Run this file by hand against any database
-- that was already initialized before this change:
--   psql "$DATABASE_URL" -f infra/db/migrations/002_bot_human_handoff.sql

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_org_source_external
  ON contacts (organization_id, source, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS handled_by TEXT NOT NULL DEFAULT 'bot';

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_handled_by_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_handled_by_check CHECK (handled_by IN ('bot','human'));