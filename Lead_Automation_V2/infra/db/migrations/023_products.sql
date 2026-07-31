-- 023_products.sql
--
-- The Marketing Agent had no concept of what the company actually sells.
-- Every panel (content, SEO, personas, broadcast, competitor intel) started
-- from a free-text brief typed in by the user, so nothing could reason about
-- pricing, positioning, or objections, and nothing carried between screens.
--
-- A product/offer is the primitive the whole marketing lifecycle derives
-- from: content is written FOR an offer, SEO briefs target ITS buyers,
-- broadcasts promote IT, competitor intel positions AGAINST alternatives to
-- it, and performance is measured per offer.

CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name              TEXT NOT NULL,
  category          TEXT,                       -- e.g. saas, service, course, physical
  status            TEXT NOT NULL DEFAULT 'active',  -- active | draft | archived
  tagline           TEXT,                       -- one-line positioning
  description       TEXT,

  -- Pricing kept as text + optional numeric: real offers are often "from
  -- Rs. 4,999/seat/mo" or "custom", which a strict numeric column cannot hold,
  -- but a numeric is still wanted for sorting/analytics when one exists.
  price_display     TEXT,
  price_amount      NUMERIC(12,2),
  currency          TEXT DEFAULT 'INR',
  billing_period    TEXT,                       -- monthly | annual | one_time | usage

  -- The marketing substance. Arrays rather than prose so the agent can use
  -- them individually (one value prop per ad, one objection per FAQ answer).
  value_props       TEXT[] NOT NULL DEFAULT '{}',
  target_segments   TEXT[] NOT NULL DEFAULT '{}',
  objections        TEXT[] NOT NULL DEFAULT '{}',
  differentiators   TEXT[] NOT NULL DEFAULT '{}',
  keywords          TEXT[] NOT NULL DEFAULT '{}',

  -- Compliance/tone guardrails the agent must respect when writing for this
  -- offer (e.g. "never promise guaranteed placement").
  tone              TEXT,
  claims_to_avoid   TEXT[] NOT NULL DEFAULT '{}',

  landing_url       TEXT,
  is_primary        BOOLEAN NOT NULL DEFAULT false,  -- the default offer for new campaigns

  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_products_org        ON products (organization_id);
CREATE INDEX IF NOT EXISTS ix_products_org_status ON products (organization_id, status);

-- At most one primary offer per organization. Partial unique index rather
-- than a constraint so archiving/unsetting stays a plain UPDATE.
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_one_primary
  ON products (organization_id) WHERE is_primary;

-- Campaigns and calendar events can point at the offer they promote, so
-- performance is attributable per product. Nullable: plenty of sends are not
-- offer-specific.
ALTER TABLE campaigns       ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_campaigns_product ON campaigns (product_id) WHERE product_id IS NOT NULL;
