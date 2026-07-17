-- 002_media_and_replies.sql
--
-- Adds what's needed for: video posts/broadcasts (not just images), real
-- broadcast sending, and real reply delivery to inbox messages + social
-- comments (instead of only writing to our own DB).
--
-- Safe to run against an existing database — every change is guarded with
-- IF NOT EXISTS. Also folded into infra/db/schema.sql for fresh installs.

-- Conversations need to remember the platform-specific thread/recipient id
-- (WhatsApp wa_id, Instagram-scoped ID, or Messenger PSID) so a reply typed
-- in the inbox knows who to actually send to on Meta's side.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS external_contact_id TEXT;

-- Messages: support image/video attachments, and remember the id Meta
-- returned for an outbound send (or the id an inbound webhook event carried)
-- for auditing/debugging delivery.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url  TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type TEXT; -- image | video | document
ALTER TABLE messages ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Social comments: need the actual Meta comment id to reply to it, and the
-- post it belongs to, for context in the UI.
ALTER TABLE social_comments ADD COLUMN IF NOT EXISTS external_comment_id TEXT;
ALTER TABLE social_comments ADD COLUMN IF NOT EXISTS post_id TEXT;

-- Campaigns/broadcasts: optional media attachment, and an optional
-- pre-approved WhatsApp template name (broadcasts outside the 24h session
-- window must use a template, not free-form text).
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS media_url     TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS media_type    TEXT; -- image | video
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_name TEXT;

-- campaign_logs: record delivery per contact (was only ever written once,
-- generically, on send) so a broadcast's real per-recipient result is visible.
ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS detail TEXT;
