-- Adds the columns the Leads / CRM page (frontend/src/app/app/contacts/
-- page.jsx) needs that didn't previously exist on `leads`:
--
--   course          — which program/course the lead is interested in.
--   temperature     — hot | warm | cold, drives the coloured "Temp" badge
--                      and the Hot/Warm/Cold filter tabs. Separate from the
--                      existing pipeline `stage` column (new/qualified/
--                      active/won/lost) — temperature is "how promising",
--                      stage is "where in the funnel".
--   contact_status  — free-text engagement status (interested / no
--                      response / irrelevant / ...) shown in the "Status"
--                      column. Kept separate from `stage` for the same
--                      reason as temperature.
--   category        — active | onboarded | inactive. Backs the page's
--                      top-level Active/Onboarded/Inactive-Lost filter
--                      tabs. Left as free text rather than reusing `stage`
--                      so existing stage-based Pipeline/Dashboard/Analytics
--                      queries (won/lost) are untouched.
--
-- `mobile` is deliberately NOT duplicated here — the page reads/writes it
-- via the existing contacts.phone column (see contact-service's GET/POST
-- /leads, which now also select/insert c.phone), same as `name`.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS course TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS temperature TEXT NOT NULL DEFAULT 'warm';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_status TEXT NOT NULL DEFAULT 'no response';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'active';

ALTER TABLE leads ADD CONSTRAINT chk_leads_temperature
  CHECK (temperature IN ('hot', 'warm', 'cold'));
ALTER TABLE leads ADD CONSTRAINT chk_leads_category
  CHECK (category IN ('active', 'onboarded', 'inactive'));

COMMENT ON COLUMN leads.course IS 'Program/course the lead is interested in — Leads/CRM page "Course" column.';
COMMENT ON COLUMN leads.temperature IS 'hot | warm | cold — Leads/CRM page "Temp" badge + filter tabs.';
COMMENT ON COLUMN leads.contact_status IS 'Free-text engagement status (interested / no response / irrelevant / ...) — Leads/CRM page "Status" badge.';
COMMENT ON COLUMN leads.category IS 'active | onboarded | inactive — Leads/CRM page top-level filter tabs (Hot/Warm/Cold filter on temperature instead).';
