-- 016_calendar_integration.sql
--
-- Google Calendar integration (services/calendar-service). Adds:
--   - calendar_accounts: one connected Google account per organization
--     (see services/calendar-service/src/services/tokenStore.js)
--   - calendar_events: local mirror of events created through the app,
--     linked to whichever thing scheduled them (a lead/contact meeting,
--     a campaign send, or an automation flow "delay" node) so the rest
--     of the product can list/display them without a live Google API
--     round trip on every page load.
--
-- Run this file by hand against any database that was already initialized
-- before this change (docker-entrypoint-initdb.d only runs against an
-- empty Postgres volume):
--   psql "$DATABASE_URL" -f infra/db/migrations/016_calendar_integration.sql
--
-- NOTE: infra/db/schema.sql has already been updated with the same tables
-- for fresh installs. infra/db/rls.sql's tenant_isolation policy is added
-- generically for every organization_id-scoped table (see that file) — the
-- two new tables below only need to be added to its table list.

CREATE TABLE IF NOT EXISTS calendar_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  google_email      TEXT,
  access_token      TEXT,                            -- encrypted at rest, see services/crypto.js
  refresh_token     TEXT,                            -- encrypted at rest
  token_expires_at  TIMESTAMPTZ,
  scope             TEXT,
  connected         BOOLEAN NOT NULL DEFAULT true,
  connected_by      UUID REFERENCES users(id),
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  google_event_id     TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  location            TEXT,
  attendee_emails     TEXT[],
  -- Exactly one of these is normally set, identifying why the event
  -- exists — a lead meeting, a scheduled campaign send, or a flow's
  -- delay node — but nothing enforces that at the DB level since a
  -- future feature (e.g. bulk-booking a campaign's follow-up calls)
  -- could reasonably want more than one.
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  campaign_id         UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  automation_node_id  TEXT,                            -- flow node id (see automation-service flow-schema.md); not an FK, node ids live inside playbooks.flow_json
  status              TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | cancelled
  html_link           TEXT,                             -- Google's event detail URL, shown as "View in Google Calendar"
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_calendar_events_org_time ON calendar_events (organization_id, starts_at);
CREATE INDEX IF NOT EXISTS ix_calendar_events_contact ON calendar_events (contact_id);
CREATE INDEX IF NOT EXISTS ix_calendar_events_campaign ON calendar_events (campaign_id);
