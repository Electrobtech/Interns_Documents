-- Adds the deal-value field the Sales Agent dashboard's "Pipeline Value"
-- metric card has been waiting on (see SalesWorkspace.jsx: "no deal-value
-- field in CRM yet"). NUMERIC rather than INT/BIGINT-cents because leads are
-- entered manually by reps, not through a payments pipeline that already
-- normalizes to minor units.
--
-- Nullable + no default value: an unset deal value must stay unset (NULL),
-- not silently become 0, so aggregation (SUM) and the "not enough data"
-- empty state on the dashboard can each tell "unknown" apart from "zero".
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_value NUMERIC(14, 2);

COMMENT ON COLUMN leads.deal_value IS
  'Estimated/actual deal value in the organization''s billing currency. '
  'Set manually per lead, or via PUT /leads/:id. Aggregated by '
  'ai-agent-backend (SalesService._compute_metrics) into the Sales Agent '
  'dashboard''s Pipeline Value metric once sales_agent_config.deal_value_field '
  'is mapped to it.';

CREATE INDEX IF NOT EXISTS ix_leads_org_deal_value
  ON leads (organization_id)
  WHERE deal_value IS NOT NULL;
