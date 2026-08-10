-- 037_imported_sheets.sql
--
-- NOTE: docker-compose's postgres service mounts schema.sql / seed.sql /
-- rls.sql as docker-entrypoint-initdb.d — this file is the single-feature
-- record for a fresh install. Keep schema.sql + rls.sql in sync. For an
-- already-running database, apply this file's CREATE TABLE by hand (see
-- the "existing database" note in spreadsheetsRoutes.js's header comment).
--
-- Backs the Support Agent "Import" tab's editable spreadsheet feature:
-- an uploaded .csv/.xlsx file or a fetched Google Sheet is saved here as
-- a grid (headers + rows) the user can view, edit cell-by-cell, and
-- re-import into contacts/leads whenever they're ready — separate from
-- the one-shot "paste a link, map columns, import" flow already in
-- sheetsRoutes.js.
--
-- Owned by contact-service (routes: src/spreadsheetsRoutes.js).

CREATE TABLE IF NOT EXISTS imported_sheets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name              TEXT NOT NULL,
  source            TEXT NOT NULL
                      CHECK (source IN ('upload', 'google_sheets')),
  source_ref        TEXT, -- original filename, or the Google Sheets URL/ID

  headers           JSONB NOT NULL DEFAULT '[]'::jsonb, -- ["Name","Email",...]
  rows              JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [["Ada","a@x.com"],...]

  last_imported_at  TIMESTAMPTZ, -- null until first committed into contacts

  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_imported_sheets_org
  ON imported_sheets (organization_id);
CREATE INDEX IF NOT EXISTS ix_imported_sheets_org_updated
  ON imported_sheets (organization_id, updated_at DESC);