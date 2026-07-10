-- =====================================================================
-- Migration: 003_message_transcript_metadata
--
-- Adds the two columns automation-service's new transcript logger
-- (services/automation-service/src/repositories/messageRepository.js)
-- needs to record *what kind* of message each row was (plain text vs. a
-- WhatsApp interactive button/list, a document, or a system-style note
-- like a Handoff event) and to keep the raw channel payload around for
-- any future richer rendering in the inbox UI.
--
-- Idempotent: IF NOT EXISTS on both the column adds and the index, so
-- re-running this file against a database that already has it applied is
-- a no-op. Also folded into infra/db/schema.sql for fresh installs
-- (docker-entrypoint-initdb.d only runs against an empty Postgres volume).
--
-- Run manually against an already-running dev database with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/db/migrations/003_message_transcript_metadata.sql
-- =====================================================================

BEGIN;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Lets the inbox filter/badge by message kind later (e.g. show a
-- paperclip icon for 'document' rows) without a full table scan.
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(conversation_id, message_type);

COMMIT;
