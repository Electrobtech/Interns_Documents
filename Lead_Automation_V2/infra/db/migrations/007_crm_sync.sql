CREATE TABLE IF NOT EXISTS crm_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  provider VARCHAR(64) NOT NULL, -- e.g. salesforce, hubspot, pipedrive
  config JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  connection_id UUID REFERENCES crm_connections(id) ON DELETE SET NULL,
  direction VARCHAR(16) NOT NULL CHECK (direction IN ('outbound','inbound')),
  entity_type VARCHAR(64) NOT NULL, -- contact, lead, deal, ticket
  entity_id UUID,
  payload JSONB DEFAULT '{}',
  status VARCHAR(64) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_jobs_pending ON crm_sync_jobs(status, attempts, created_at);
CREATE INDEX IF NOT EXISTS idx_crm_connections_workspace ON crm_connections(workspace_id, active);
