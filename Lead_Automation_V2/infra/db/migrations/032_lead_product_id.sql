-- Adds the product/section a lead is associated with, closing the gap
-- flagged in the Sales Agent capability review: target setting, sales
-- tracking, and gap analysis all existed org-wide (sales_agent_config.
-- monthly_revenue_target, see migrations/030_lead_deal_value.sql /
-- 031_lead_updated_at.sql) but nothing tied a lead to a specific product,
-- so none of that could be broken down per product/section.
--
-- Nullable, no default: an unattached lead (organic/unmapped source, or an
-- org that never adopted the Products feature) must stay unattached, not
-- silently bucket into a default product. ai-agent-backend's SalesService
-- treats a NULL product_id lead as "unassigned" in per-product breakdowns,
-- same as it already treats a NULL deal_value as "unknown" rather than 0.
--
-- ON DELETE SET NULL (not CASCADE): deleting a product should not delete
-- the leads that were pursuing it — same choice already made for
-- campaigns.product_id and calendar_events.product_id.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

COMMENT ON COLUMN leads.product_id IS
  'Which product/offer (see products table) this lead/deal is for. NULL '
  'means unassigned. Set via PUT /leads/:id or POST /leads. Used by '
  'ai-agent-backend (SalesService.get_forecast/get_analytics) to break '
  'pipeline value, revenue targets, and gap analysis down per product.';

CREATE INDEX IF NOT EXISTS ix_leads_product
  ON leads (product_id)
  WHERE product_id IS NOT NULL;
