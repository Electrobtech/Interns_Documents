-- Complete Marketing Hub Schema Update
-- Apply this to add all new tables for complete backend functionality

-- ---------- Content Studio & Asset Management ----------
CREATE TABLE IF NOT EXISTS mh_assets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('image', 'video', 'document', 'audio', 'template')),
  file_path          TEXT NOT NULL,
  file_size          INTEGER,
  mime_type          TEXT,
  metadata           JSONB DEFAULT '{}',
  tags               TEXT[] DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  category           TEXT NOT NULL,
  channel            TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin')),
  content            JSONB NOT NULL,  -- {subject, body, variables, assets}
  preview_data       JSONB,
  usage_count        INTEGER DEFAULT 0,
  is_public          BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_content_studio (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('post', 'campaign', 'template', 'asset')),
  channel            TEXT CHECK (channel IN ('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin')),
  content            JSONB NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  scheduled_at       TIMESTAMPTZ,
  tags               TEXT[] DEFAULT '{}',
  performance        JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- SEO & AEO Tools ----------
CREATE TABLE IF NOT EXISTS mh_seo_keywords (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  keyword            TEXT NOT NULL,
  search_volume      INTEGER DEFAULT 0,
  difficulty         INTEGER DEFAULT 0,
  current_rank       INTEGER,
  target_rank        INTEGER,
  url                TEXT,
  competition        NUMERIC(3,2) DEFAULT 0.0,
  cpc                NUMERIC(10,2) DEFAULT 0.0,
  trend_data         JSONB DEFAULT '{}',
  last_checked       TIMESTAMPTZ DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_seo_audits (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  url                TEXT NOT NULL,
  audit_type         TEXT NOT NULL CHECK (audit_type IN ('technical', 'content', 'backlinks', 'performance')),
  score              INTEGER DEFAULT 0,
  issues             JSONB DEFAULT '[]',
  recommendations    JSONB DEFAULT '[]',
  audit_data         JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_aeo_optimization (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  query              TEXT NOT NULL,
  answer_type        TEXT CHECK (answer_type IN ('featured_snippet', 'local_pack', 'knowledge_panel', 'video', 'image')),
  current_content    TEXT,
  optimized_content  TEXT,
  optimization_tips  JSONB DEFAULT '[]',
  performance        JSONB DEFAULT '{}',
  status             TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'optimizing', 'completed', 'monitoring')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Competitor Analysis ----------
CREATE TABLE IF NOT EXISTS mh_competitors (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  domain             TEXT,
  industry           TEXT,
  channels           TEXT[] DEFAULT '{}',
  tracking_keywords  TEXT[] DEFAULT '{}',
  social_handles     JSONB DEFAULT '{}',
  metadata           JSONB DEFAULT '{}',
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mh_competitor_analysis (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id      UUID REFERENCES mh_competitors(id) ON DELETE CASCADE,
  analysis_type      TEXT NOT NULL CHECK (analysis_type IN ('seo', 'content', 'social', 'ads', 'pricing', 'features')),
  metrics            JSONB NOT NULL,
  insights           JSONB DEFAULT '{}',
  recommendations    TEXT[],
  analysis_date      TIMESTAMPTZ DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Marketing Calendar & Scheduling ----------
CREATE TABLE IF NOT EXISTS mh_calendar_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  description        TEXT,
  event_type         TEXT NOT NULL CHECK (event_type IN ('campaign', 'broadcast', 'content', 'meeting', 'deadline', 'launch')),
  start_date         TIMESTAMPTZ NOT NULL,
  end_date           TIMESTAMPTZ,
  all_day            BOOLEAN DEFAULT false,
  campaign_id        UUID REFERENCES mh_campaigns(id) ON DELETE CASCADE,
  content_id         UUID REFERENCES mh_content_studio(id) ON DELETE SET NULL,
  assignees          UUID[] DEFAULT '{}',
  status             TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  metadata           JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Knowledge Base ----------
CREATE TABLE IF NOT EXISTS mh_knowledge_articles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  content            TEXT NOT NULL,
  category           TEXT,
  tags               TEXT[] DEFAULT '{}',
  author_id          UUID REFERENCES users(id),
  status             TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  view_count         INTEGER DEFAULT 0,
  helpful_count      INTEGER DEFAULT 0,
  search_vector      TSVECTOR,
  metadata           JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Settings & Configuration ----------
CREATE TABLE IF NOT EXISTS mh_settings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  category           TEXT NOT NULL,
  key                TEXT NOT NULL,
  value              JSONB NOT NULL,
  description        TEXT,
  is_public          BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, category, key)
);

CREATE TABLE IF NOT EXISTS mh_integrations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider           TEXT NOT NULL,
  service_type       TEXT NOT NULL CHECK (service_type IN ('seo', 'analytics', 'social', 'crm', 'email', 'storage')),
  credentials        JSONB NOT NULL,
  configuration      JSONB DEFAULT '{}',
  status             TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  last_sync          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Additional indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_mh_assets_org_type ON mh_assets(organization_id, type);
CREATE INDEX IF NOT EXISTS idx_mh_templates_org_category ON mh_templates(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_mh_content_studio_org_status ON mh_content_studio(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_mh_seo_keywords_org ON mh_seo_keywords(organization_id);
CREATE INDEX IF NOT EXISTS idx_mh_competitors_org ON mh_competitors(organization_id);
CREATE INDEX IF NOT EXISTS idx_mh_calendar_events_org_date ON mh_calendar_events(organization_id, start_date);
CREATE INDEX IF NOT EXISTS idx_mh_knowledge_articles_search ON mh_knowledge_articles USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_mh_settings_org_category ON mh_settings(organization_id, category);

-- RLS Policies for new tables
ALTER TABLE mh_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_assets FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mh_assets
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

ALTER TABLE mh_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_templates FORCE ROW LEVEL SECURITY;  
CREATE POLICY tenant_isolation ON mh_templates
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

ALTER TABLE mh_content_studio ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_content_studio FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mh_content_studio
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

ALTER TABLE mh_seo_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_seo_keywords FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mh_seo_keywords
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

ALTER TABLE mh_seo_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_seo_audits FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mh_seo_audits
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

ALTER TABLE mh_aeo_optimization ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_aeo_optimization FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mh_aeo_optimization
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

ALTER TABLE mh_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_competitors FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mh_competitors
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

ALTER TABLE mh_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_calendar_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mh_calendar_events
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

ALTER TABLE mh_knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_knowledge_articles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mh_knowledge_articles
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

ALTER TABLE mh_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mh_settings
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

ALTER TABLE mh_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mh_integrations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mh_integrations
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);