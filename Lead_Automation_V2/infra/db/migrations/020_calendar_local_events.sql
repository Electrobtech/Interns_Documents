-- 020_calendar_local_events.sql
--
-- Google Calendar is an optional enhancement for services/calendar-service,
-- not a prerequisite for having a calendar. Connecting it adds real invites
-- and reminders; without it an organization still gets a working internal
-- calendar backed by calendar_events.
--
-- 016_calendar_integration.sql declared google_event_id NOT NULL, which made
-- every write fail for orgs that had not connected Google (and connecting is
-- itself blocked until a Web-application OAuth client is configured). Relax
-- the constraint so events can be created locally and back-filled with a
-- Google id later if/when the org connects.

ALTER TABLE calendar_events ALTER COLUMN google_event_id DROP NOT NULL;

-- Distinguishes "not synced to Google" from "synced" without a second column.
CREATE INDEX IF NOT EXISTS ix_calendar_events_unsynced
  ON calendar_events (organization_id)
  WHERE google_event_id IS NULL;
