-- 023_conversation_last_read_at.sql
--
-- Powers real per-channel "unread message" badges (WhatsApp-style) in the
-- sidebar, replacing the old dummy notification-service which only ever
-- tracked fake "UI click" events and had nothing to do with actual inbound
-- WhatsApp/Instagram/LinkedIn/Email/SMS messages.
--
-- Adds `last_read_at` to `conversations`. A message is "unread" when
-- messages.direction = 'inbound' AND messages.created_at > conversations.last_read_at.
-- last_read_at is bumped to now() whenever a conversation thread is opened
-- (GET /conversations/:id in inbox-service), the same way opening a chat
-- in WhatsApp clears its badge. No new column on `messages` and no change
-- needed to any of the several inbound-message insert call sites
-- (automation-service's messageRepository, integration-service's
-- conversationStore, email-service's emailConversationStore, etc.) — this
-- is computed purely from existing timestamps.
--
-- Safe to re-run: IF NOT EXISTS guards.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ix_conversations_org_channel_last_read
  ON conversations (organization_id, channel_type, last_read_at);
