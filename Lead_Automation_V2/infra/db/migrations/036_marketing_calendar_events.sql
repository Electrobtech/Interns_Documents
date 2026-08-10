-- 036_marketing_calendar_events.sql
--
-- NOTE: docker-compose's postgres service mounts schema.sql / seed.sql /
-- rls.sql as docker-entrypoint-initdb.d — this file is the single-feature
-- record. Keep schema.sql + rls.sql in sync.
--
-- Backs standalone Marketing Hub calendar events (meeting / reminder).
-- Campaign and broadcast events are DERIVED at read time from
-- marketing_campaigns (start_date / end_date) and marketing_broadcasts
-- (scheduled_at / sent_at) — they are not stored here.
--
-- Owned by marketing-hub-service (routes: src/calendar.js).

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
