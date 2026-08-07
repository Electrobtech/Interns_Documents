-- Adds leads.updated_at. Previously leads had no last-touched timestamp at
-- all — only created_at — so nothing downstream could tell "just created"
-- apart from "stage/score changed 3 weeks ago". This is what the Sales
-- Agent's Lead Timeline (Lead Intelligence tab), the Forecasting tab's
-- monthly-revenue bucketing (a won lead's month of close, approximated as
-- its last update), and the Analytics tab's sales-cycle-length metric all
-- need — see ai-agent-backend/app/services/sales_service.py's
-- _lead_closed_month() / get_analytics() for exactly how it's used, and the
-- comments there for why this is a documented proxy rather than a real
-- stage-transition-history column (which this schema doesn't have yet).
--
-- No trigger: this codebase's other "bumped on write" timestamp
-- (conversations.last_read_at) is bumped at the application layer too, not
-- via a Postgres trigger, so this follows the same convention — see
-- contact-service/src/index.js's PUT /leads/:id and PUT /leads/:id/stage,
-- both updated in this same change to set updated_at = now() explicitly.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN leads.updated_at IS
  'Last time this lead''s score/stage/deal_value was written via PUT '
  '/leads/:id or PUT /leads/:id/stage. Used as a close-date proxy for won '
  'leads (no dedicated stage-transition-history table exists yet) by '
  'ai-agent-backend''s Forecasting/Analytics endpoints.';
