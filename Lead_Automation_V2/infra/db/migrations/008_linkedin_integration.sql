CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- OAuth states for LinkedIn OAuth flow
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oauth_states_state ON oauth_states(state);

-- LinkedIn connections
CREATE TABLE IF NOT EXISTS linkedin_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  linkedin_user_id VARCHAR(255),
  linkedin_org_urn VARCHAR(255),
  display_name VARCHAR(255),
  granted_scopes TEXT[] DEFAULT ARRAY[]::text[],
  status VARCHAR(32) DEFAULT 'disconnected',
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linkedin_connections_user ON linkedin_connections(user_id);

-- LinkedIn lead forms
CREATE TABLE IF NOT EXISTS linkedin_lead_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  form_urn VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(500) NOT NULL,
  new_lead_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  sync_status VARCHAR(32) DEFAULT 'pending',
  auto_approve BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linkedin_lead_forms_user ON linkedin_lead_forms(user_id);

-- LinkedIn leads
CREATE TABLE IF NOT EXISTS linkedin_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  linkedin_lead_id VARCHAR(255) NOT NULL UNIQUE,
  form_urn VARCHAR(255) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  form_response JSONB,
  status VARCHAR(32) DEFAULT 'received',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linkedin_leads_form ON linkedin_leads(form_urn);
CREATE INDEX idx_linkedin_leads_status ON linkedin_leads(status);

-- LinkedIn campaigns
CREATE TABLE IF NOT EXISTS linkedin_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  campaign_urn VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(500) NOT NULL,
  sync_status VARCHAR(32) DEFAULT 'pending',
  last_synced_at TIMESTAMPTZ,
  spend_to_date_cents BIGINT DEFAULT 0,
  error_code VARCHAR(64),
  error_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linkedin_campaigns_user ON linkedin_campaigns(user_id);

-- LinkedIn campaign metrics
CREATE TABLE IF NOT EXISTS linkedin_campaign_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  campaign_urn VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  spend_cents BIGINT DEFAULT 0,
  leads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linkedin_campaign_metrics_campaign ON linkedin_campaign_metrics(campaign_urn);
CREATE INDEX idx_linkedin_campaign_metrics_date ON linkedin_campaign_metrics(date);

-- LinkedIn organizations
CREATE TABLE IF NOT EXISTS linkedin_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  org_urn VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  logo_url VARCHAR(500),
  follower_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linkedin_organizations_user ON linkedin_organizations(user_id);

-- LinkedIn approvals
CREATE TABLE IF NOT EXISTS linkedin_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(500) NOT NULL,
  detail TEXT,
  status VARCHAR(32) DEFAULT 'pending',
  payload_preview JSONB,
  decision_note TEXT,
  decided_by VARCHAR(255),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linkedin_approvals_user ON linkedin_approvals(user_id);
CREATE INDEX idx_linkedin_approvals_status ON linkedin_approvals(status);

-- LinkedIn sync logs
CREATE TABLE IF NOT EXISTS linkedin_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  module VARCHAR(64) NOT NULL,
  event TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  actor_type VARCHAR(32) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linkedin_sync_logs_user ON linkedin_sync_logs(user_id);
CREATE INDEX idx_linkedin_sync_logs_created ON linkedin_sync_logs(created_at DESC);
