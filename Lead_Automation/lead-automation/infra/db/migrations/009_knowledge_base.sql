-- Knowledge base for the AI Agents RAG pipeline (Marketing/Sales/Support).
-- pgvector for semantic search + tsvector for keyword search = hybrid retrieval.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_type      TEXT NOT NULL,              -- marketing | sales | support | shared
  name            TEXT NOT NULL,
  source_type     TEXT NOT NULL,              -- pdf | docx | txt | csv | web | note
  status          TEXT NOT NULL DEFAULT 'processing',  -- processing | ready | failed
  chunk_count     INTEGER NOT NULL DEFAULT 0,
  version         INTEGER NOT NULL DEFAULT 1,
  error_detail    TEXT,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  knowledge_source_id UUID NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  agent_type         TEXT NOT NULL,
  chunk_index        INTEGER NOT NULL,
  content            TEXT NOT NULL,
  embedding          VECTOR(768),             -- nomic-embed-text dimension
  content_tsv        TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- page, heading, section
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_knowledge_chunks_org_agent ON knowledge_chunks (organization_id, agent_type);
CREATE INDEX IF NOT EXISTS ix_knowledge_chunks_tsv ON knowledge_chunks USING GIN (content_tsv);
CREATE INDEX IF NOT EXISTS ix_knowledge_chunks_embedding ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS ix_knowledge_sources_org_agent ON knowledge_sources (organization_id, agent_type);

-- Marketing Agent generation history — every structured output the agent
-- produces, so "Campaign performance summary" / dashboard cards have
-- something real to read instead of being generated fresh every render.
CREATE TABLE IF NOT EXISTS marketing_agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brief           TEXT NOT NULL,
  output          JSONB NOT NULL,
  knowledge_sources_used TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_marketing_runs_org ON marketing_agent_runs (organization_id, created_at DESC);
