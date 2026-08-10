-- ---------- Marketing Hub Audiences ----------
-- Owned by marketing-hub-service. Contact-service only has tag-based
-- segments (GET /contacts/segments = DISTINCT tags + counts). That is too
-- thin for the Audience Manager UI (source, score, status, filter rules,
-- growth chart), so we keep a dedicated marketing_audiences table here
-- rather than overloading contacts.tags.
CREATE TABLE IF NOT EXISTS marketing_audiences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  source             TEXT NOT NULL DEFAULT 'Custom'
                       CHECK (source IN ('Custom', 'Pixel', 'Lookalike', 'Import', 'CRM')),
  size               BIGINT NOT NULL DEFAULT 0,
  score              INTEGER,
  status             TEXT NOT NULL DEFAULT 'Active'
                       CHECK (status IN ('Active', 'Archived')),
  filter_definition  JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_marketing_audiences_org
  ON marketing_audiences (organization_id);
CREATE INDEX IF NOT EXISTS ix_marketing_audiences_org_status
  ON marketing_audiences (organization_id, status);
CREATE INDEX IF NOT EXISTS ix_marketing_audiences_org_created
  ON marketing_audiences (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_audience_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id   UUID NOT NULL REFERENCES marketing_audiences(id) ON DELETE CASCADE,
  size          BIGINT NOT NULL DEFAULT 0,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_marketing_audience_snapshots_audience_captured
  ON marketing_audience_snapshots (audience_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS ix_marketing_audience_snapshots_captured
  ON marketing_audience_snapshots (captured_at);
