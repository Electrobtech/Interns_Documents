-- 031_notification_followups.sql
--
-- Task 3/5 (Support Agent — Notifications): the `notifications` table
-- already existed in schema.sql but was never actually used —
-- notification-service was storing everything in an in-memory array
-- instead. This is "the moment this needs to be real" flagged in that
-- service's old code: swap the in-memory store for this table, and add
-- the columns needed to represent "a follow-up came due" rather than only
-- the generic { title, body } shape it started with.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type         TEXT NOT NULL DEFAULT 'generic', -- 'generic' | 'ui_click' | 'followup_due'
  ADD COLUMN IF NOT EXISTS contact_id   UUID REFERENCES contacts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS follow_up_id UUID REFERENCES follow_ups(id) ON DELETE CASCADE;

-- Prevents the follow-up poller from inserting a duplicate notification
-- for the same follow-up on every ~60s poll cycle. Partial (only applies
-- when follow_up_id is set) so generic/ui_click notifications, which have
-- no follow_up_id, are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_org_followup
  ON notifications (organization_id, follow_up_id)
  WHERE follow_up_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_notifications_org_created
  ON notifications (organization_id, created_at DESC);
