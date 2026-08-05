-- 029_follow_ups.sql
--
-- Adds the Follow-ups feature: a manageable queue of "call this lead back
-- on X date" reminders, created either by hand (Follow-ups page / Contact
-- & Lead detail views) or automatically whenever a WhatsApp/Channel
-- Automation Builder flow hits a Handoff node with auto-follow-up enabled
-- (see services/automation-service/src/repositories/followUpRepository.js
-- and controllers/webhookController.js).
--
-- NOTE: infra/db/schema.sql has already been updated with this same table
-- for fresh installs (docker-entrypoint-initdb.d only runs against an empty
-- Postgres volume). Run this file by hand against any database that was
-- already initialized before this change:
--   psql "$DATABASE_URL" -f infra/db/migrations/029_follow_ups.sql

CREATE TABLE IF NOT EXISTS follow_ups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL, -- set when created by a Handoff node
  due_at          TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',   -- pending | completed | cancelled
  priority        TEXT NOT NULL DEFAULT 'medium',    -- low | medium | high
  disposition     TEXT,                              -- Interested | No Response | Lost | Converted | Callback Requested ...
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  source          TEXT NOT NULL DEFAULT 'manual',     -- manual | automation
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for automation-created rows
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT follow_ups_status_check   CHECK (status   IN ('pending','completed','cancelled')),
  CONSTRAINT follow_ups_priority_check CHECK (priority IN ('low','medium','high')),
  CONSTRAINT follow_ups_source_check   CHECK (source   IN ('manual','automation'))
);

-- Powers the Follow-ups page's Overdue/Today/Upcoming buckets, and the
-- Contact/Lead detail views' "follow-ups for this contact" lookup.
CREATE INDEX IF NOT EXISTS ix_follow_ups_org_due     ON follow_ups (organization_id, status, due_at);
CREATE INDEX IF NOT EXISTS ix_follow_ups_contact      ON follow_ups (contact_id);
CREATE INDEX IF NOT EXISTS ix_follow_ups_assigned_to  ON follow_ups (assigned_to);

-- Row-level tenant isolation, same pattern as every other table — see
-- infra/db/rls.sql. Also add 'follow_ups' to the standard-tables array in
-- that file for fresh installs.
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON follow_ups;
CREATE POLICY tenant_isolation ON follow_ups
  USING      (app_rls_bypass() OR organization_id = app_current_org())
  WITH CHECK (app_rls_bypass() OR organization_id = app_current_org());
