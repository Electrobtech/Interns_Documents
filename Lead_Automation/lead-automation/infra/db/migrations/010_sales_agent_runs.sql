-- Sales Agent generation history (Phase 2) — same pattern as marketing_agent_runs.
CREATE TABLE IF NOT EXISTS sales_agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brief           TEXT NOT NULL,
  output          JSONB NOT NULL,
  knowledge_sources_used TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sales_runs_org ON sales_agent_runs (organization_id, created_at DESC);
