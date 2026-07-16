-- Phase 3 + 4: Support Agent run history, shared conversation memory,
-- and Phase 5 webhook subscriptions for agent events.
CREATE TABLE IF NOT EXISTS support_agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brief           TEXT NOT NULL,
  output          JSONB NOT NULL,
  knowledge_sources_used TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_support_runs_org ON support_agent_runs (organization_id, created_at DESC);

-- Shared conversation memory: one session spans multiple turns and can hop
-- between agents (the orchestrator appends every turn here, so each agent
-- sees prior context regardless of which agent handled earlier turns).
CREATE TABLE IF NOT EXISTS agent_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL,
  role            TEXT NOT NULL,             -- user | agent
  agent_type      TEXT,                      -- which agent produced/handled this turn
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_agent_conversations_session ON agent_conversations (organization_id, session_id, created_at);

-- Phase 5: outbound webhooks fired when an agent run completes.
CREATE TABLE IF NOT EXISTS agent_webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  events          TEXT[] NOT NULL DEFAULT '{run.completed}',
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_agent_webhooks_org ON agent_webhooks (organization_id) WHERE active;
