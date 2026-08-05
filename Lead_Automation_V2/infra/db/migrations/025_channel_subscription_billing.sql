-- =====================================================================
-- 025_channel_subscription_billing.sql
--
-- Per-channel subscription billing (our own SaaS fee, priced per channel)
-- plus itemized pass-through of Meta's WhatsApp usage fees and SMS
-- carrier fees. Everything here is INR (payments/wallets are INR-only —
-- see wallet.js / 024_billing_payments.sql — so this stays consistent
-- rather than introducing USD anywhere).
--
-- IMPORTANT — Meta's 2026 pricing model (see channel-subscription-
-- billing-prompt.md for the full research): WhatsApp is billed per
-- TEMPLATE MESSAGE, by category (marketing/utility/authentication) and
-- by the RECIPIENT's country calling code, not per-conversation. That
-- structure is expected to change again (Meta is set to start charging
-- for in-window replies from Oct 1 2026) — so rates live in a data
-- table (meta_rate_cards), never as constants in application code, and
-- the "is this message free" rule stays swappable in the app layer
-- (see campaign-service/src/whatsappBilling.js `isFreeWindow`).
--
-- NOTE ON SCOPE: `channels`, `campaigns`, `campaign_recipients`,
-- `wallets`/`wallet_transactions`, `payments`, `invoices`, and
-- `subscriptions` already exist (schema.sql) — this migration extends
-- `invoices`, and adds the catalogue/subscription/usage/line-item
-- tables needed for real per-channel billing on top of them. It does
-- NOT touch `wallets` — that prepaid mechanism keeps working exactly as
-- it does today for ad-hoc 1:1 sends; this migration's ledger
-- (whatsapp_billing_ledger) is specifically for the reserve/settle flow
-- around bulk campaign sends, which needs a pre-send hold that plain
-- wallet.deduct() (single atomic debit, see walletModel.js) doesn't
-- give you.
-- =====================================================================

-- ---------- 1. Our own price catalogue, per channel (platform-admin managed) ----------
CREATE TABLE IF NOT EXISTS channel_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type    TEXT NOT NULL CHECK (channel_type IN
                    ('whatsapp','messenger','instagram','linkedin','email','sms')),
  our_fee_amount  NUMERIC(14,2) NOT NULL CHECK (our_fee_amount >= 0),
  currency        TEXT NOT NULL DEFAULT 'INR',
  billing_period  TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','annual')),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active catalogue row per (channel_type, billing_period) at a time —
-- superseding a price means deactivating the old row and inserting a new
-- one, never UPDATEing our_fee_amount in place, so
-- organization_channel_subscriptions' price snapshots stay meaningful
-- history rather than silently drifting.
CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_plans_active_channel_period
  ON channel_plans (channel_type, billing_period) WHERE active;

-- Seed one active monthly plan per channel type. Placeholder prices —
-- a platform admin sets real ones via the catalogue screen.
INSERT INTO channel_plans (channel_type, our_fee_amount, billing_period)
VALUES
  ('whatsapp',  1499.00, 'monthly'),
  ('messenger',  999.00, 'monthly'),
  ('instagram', 999.00, 'monthly'),
  ('linkedin',  1999.00, 'monthly'),
  ('email',      499.00, 'monthly'),
  ('sms',        799.00, 'monthly')
ON CONFLICT DO NOTHING;

-- ---------- 2. Which channels an org is subscribed to, at what (snapshotted) price ----------
CREATE TABLE IF NOT EXISTS organization_channel_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_type    TEXT NOT NULL CHECK (channel_type IN
                    ('whatsapp','messenger','instagram','linkedin','email','sms')),
  channel_plan_id UUID REFERENCES channel_plans(id),
  -- Snapshot of channel_plans.our_fee_amount at subscribe time — a later
  -- catalogue price change must never retroactively re-price an existing
  -- client (per the task brief). Changing an org's price means creating a
  -- new row (new started_at), not editing this one.
  price_amount    NUMERIC(14,2) NOT NULL CHECK (price_amount >= 0),
  currency        TEXT NOT NULL DEFAULT 'INR',
  billing_period  TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','annual')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  -- Explicit product decision (per task discussion): no proration on
  -- mid-cycle add/remove — a channel enabled or disabled mid-month still
  -- bills the full month either way. trial_ends_at is optional per-channel
  -- grace period; NULL means no trial for this subscription row.
  trial_ends_at   TIMESTAMPTZ,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active-or-paused subscription per org+channel at a time (a cancelled
-- row doesn't block re-subscribing — that inserts a fresh row instead).
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_channel_sub_live
  ON organization_channel_subscriptions (organization_id, channel_type)
  WHERE status IN ('active','paused');

CREATE INDEX IF NOT EXISTS idx_org_channel_sub_org
  ON organization_channel_subscriptions (organization_id);

-- ---------- 3. Meta's rate card (WhatsApp usage fees we pass through) ----------
-- One row per (channel_type, category, country_code, effective_from).
-- channel_type is included (not just implied "whatsapp") because the task
-- brief is explicit that Messenger/Instagram *can* carry a Meta fee even
-- though they mostly don't today — same table shape covers that without a
-- future migration.
CREATE TABLE IF NOT EXISTS meta_rate_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type    TEXT NOT NULL CHECK (channel_type IN ('whatsapp','messenger','instagram')),
  category        TEXT NOT NULL CHECK (category IN ('marketing','utility','authentication','service')),
  -- E.164 calling code of the RECIPIENT, e.g. '91' for India — Meta bills
  -- by the recipient's country, not the sending org's. '*' is the
  -- catch-all/default row used when no country-specific row exists.
  country_code    TEXT NOT NULL DEFAULT '*',
  meta_rate       NUMERIC(14,4) NOT NULL CHECK (meta_rate >= 0),
  currency        TEXT NOT NULL DEFAULT 'INR',
  gst_percent     NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  -- BSP markup, if this org's WhatsApp integration goes through a Business
  -- Solution Provider instead of direct Meta billing. 0 by default — this
  -- repo's whatsappService.js talks directly to graph.facebook.com today
  -- (see services/integration-service), so there's no BSP markup to add
  -- right now. Kept as a column so a future BSP integration doesn't need
  -- another migration.
  bsp_markup      NUMERIC(14,4) NOT NULL DEFAULT 0,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_rate_cards_lookup
  ON meta_rate_cards (channel_type, category, country_code, effective_from DESC)
  WHERE active;

-- Seed values are Meta's representative India rates as of the Jan 1 2026
-- rate update (see task brief). THESE WILL BE STALE — Meta revises this
-- roughly every 6 months per category/country. Update via the
-- platform-admin rate-card screen (super-admin/channel-billing/meta-rates),
-- never by editing a constant in code.
INSERT INTO meta_rate_cards (channel_type, category, country_code, meta_rate, currency, gst_percent)
VALUES
  ('whatsapp', 'marketing',      '*', 0.86, 'INR', 18.00),
  ('whatsapp', 'utility',        '*', 0.135, 'INR', 18.00),
  ('whatsapp', 'authentication', '*', 0.135, 'INR', 18.00),
  ('whatsapp', 'service',        '*', 0, 'INR', 18.00)
ON CONFLICT DO NOTHING;

-- ---------- 4. SMS rate card (separate from Meta — different carrier, different compliance fields) ----------
CREATE TABLE IF NOT EXISTS sms_rate_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_type      TEXT NOT NULL CHECK (route_type IN ('promotional','transactional','otp')),
  per_sms_rate    NUMERIC(14,4) NOT NULL CHECK (per_sms_rate >= 0),
  currency        TEXT NOT NULL DEFAULT 'INR',
  gst_percent     NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_rate_cards_lookup
  ON sms_rate_cards (route_type, effective_from DESC) WHERE active;

-- Representative current India per-SMS rates — same "seed, not constant" caveat as above.
INSERT INTO sms_rate_cards (route_type, per_sms_rate, currency, gst_percent)
VALUES
  ('promotional',   0.12, 'INR', 18.00),
  ('transactional', 0.15, 'INR', 18.00),
  ('otp',           0.15, 'INR', 18.00)
ON CONFLICT DO NOTHING;

-- ---------- 5. Markup config — the % we add on top of Meta's/SMS's actual cost ----------
-- Product decision from the task brief: pass-through carries a markup
-- (not exact-cost). organization_id = NULL is the platform-wide default
-- row; a specific org can get its own row to override it (e.g. a
-- different negotiated rate). Lookup order: org-specific row if present,
-- else the NULL default row. The seed default is 0% — a placeholder
-- until a platform admin sets the real markup percentage on the
-- super-admin channel-billing screen; nothing here is hardcoded into
-- application code.
CREATE TABLE IF NOT EXISTS billing_markup_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  markup_percent    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (markup_percent >= 0),
  updated_by_admin  UUID REFERENCES platform_admins(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_markup_default
  ON billing_markup_config ((organization_id IS NULL)) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_markup_org
  ON billing_markup_config (organization_id) WHERE organization_id IS NOT NULL;

INSERT INTO billing_markup_config (organization_id, markup_percent)
SELECT NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM billing_markup_config WHERE organization_id IS NULL);

-- ---------- 6. WhatsApp campaign billing ledger (reserve/settle holds) ----------
-- Rewired version of the table campaign-service/src/whatsappBilling.js
-- already assumed existed (it referenced this table and `whatsapp_pricing`
-- before this migration — neither actually existed in schema.sql, so that
-- module was dead code). The reserve → settle → charge shape is kept
-- (it's the right pattern: hold funds before a bulk send, reconcile to
-- actual delivered count afterward) but pricing now comes from
-- meta_rate_cards (per category + recipient country) instead of one flat
-- per-org rate, and amounts are plain ₹ NUMERIC(14,2) — matching the rest
-- of this schema (payments, wallets) — instead of the old *_cents fields.
CREATE TABLE IF NOT EXISTS whatsapp_billing_ledger (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_type            TEXT NOT NULL CHECK (entry_type IN ('reservation','charge','refund')),
  status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled','released')),
  amount                NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency              TEXT NOT NULL DEFAULT 'INR',
  campaign_id           UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  category              TEXT CHECK (category IN ('marketing','utility','authentication','service')),
  recipient_count       INT,
  reserved_by_entry_id  UUID REFERENCES whatsapp_billing_ledger(id),
  note                  TEXT,
  settled_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_ledger_org_created
  ON whatsapp_billing_ledger (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_ledger_campaign
  ON whatsapp_billing_ledger (campaign_id) WHERE campaign_id IS NOT NULL;

-- ---------- 7. Per-message Meta usage audit trail (feeds invoice line items) ----------
CREATE TABLE IF NOT EXISTS meta_usage_charges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_type      TEXT NOT NULL CHECK (channel_type IN ('whatsapp','messenger','instagram')),
  category          TEXT NOT NULL CHECK (category IN ('marketing','utility','authentication','service')),
  recipient_country TEXT,
  meta_rate         NUMERIC(14,4) NOT NULL,
  markup_percent    NUMERIC(5,2) NOT NULL DEFAULT 0,
  bsp_markup        NUMERIC(14,4) NOT NULL DEFAULT 0,
  gst_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantity          INT NOT NULL CHECK (quantity > 0),
  total_amount      NUMERIC(14,2) NOT NULL, -- (meta_rate + bsp_markup) * (1+markup_percent/100) * qty + gst_amount
  currency          TEXT NOT NULL DEFAULT 'INR',
  period            DATE NOT NULL,          -- first day of the billing month this charge belongs to
  campaign_id       UUID REFERENCES campaigns(id) ON DELETE SET NULL, -- NULL for 1:1 replies
  reference_id      TEXT,                   -- e.g. WhatsApp message id, for per-message audit
  invoiced          BOOLEAN NOT NULL DEFAULT false, -- true once rolled into an invoice_line_items row
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_usage_org_period
  ON meta_usage_charges (organization_id, period);
CREATE INDEX IF NOT EXISTS idx_meta_usage_campaign
  ON meta_usage_charges (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meta_usage_uninvoiced
  ON meta_usage_charges (organization_id) WHERE NOT invoiced;

-- ---------- 8. SMS usage audit trail — kept separate from meta_usage_charges ----------
-- (different compliance fields: DLT template id, sender id — not a Meta product).
CREATE TABLE IF NOT EXISTS sms_usage_charges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  route_type        TEXT NOT NULL CHECK (route_type IN ('promotional','transactional','otp')),
  per_sms_rate      NUMERIC(14,4) NOT NULL,
  markup_percent    NUMERIC(5,2) NOT NULL DEFAULT 0,
  gst_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantity          INT NOT NULL CHECK (quantity > 0),
  total_amount      NUMERIC(14,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'INR',
  period            DATE NOT NULL,
  campaign_id       UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  dlt_template_id   TEXT,
  sender_id         TEXT,
  reference_id      TEXT,
  invoiced          BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_usage_org_period
  ON sms_usage_charges (organization_id, period);
CREATE INDEX IF NOT EXISTS idx_sms_usage_campaign
  ON sms_usage_charges (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_usage_uninvoiced
  ON sms_usage_charges (organization_id) WHERE NOT invoiced;

-- ---------- 9. Extend the existing `invoices` stub ----------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_start DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_end   DATE;
ALTER TABLE invoices ALTER COLUMN amount SET DATA TYPE NUMERIC(14,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE invoices ALTER COLUMN status SET DEFAULT 'draft';

-- ---------- 10. Itemized invoice lines ----------
-- No organization_id of its own — scoped via invoice_id -> invoices.organization_id,
-- same indirect-scoping pattern campaign_audiences/campaign_recipients use (see rls.sql).
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN
                  ('saas_channel_fee','meta_passthrough','sms_passthrough','bsp_markup','other')),
  channel_type  TEXT,
  description   TEXT NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  unit_amount   NUMERIC(14,2) NOT NULL,
  total_amount  NUMERIC(14,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items (invoice_id);

-- ---------- 11. Let the existing payments/webhook machinery settle an invoice too ----------
-- Reuses payments + the webhook handler in webhooks.js (payment_link.paid)
-- instead of a bespoke invoice-payment table — same reconciliation path
-- WALKIN_SALE already uses. See webhooks.js's settlePayment() for the
-- INVOICE_SETTLEMENT case this adds.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN ('WALLET_RECHARGE', 'ECOMMERCE_ORDER', 'WALKIN_SALE', 'INVOICE_SETTLEMENT'));

-- ---------- 12. Row-Level Security ----------
-- Tenant-scoped tables with a direct organization_id column join the
-- existing loop-based policy set (see infra/db/rls.sql) — replicated
-- inline here so this migration is correct standalone, same convention
-- 024_billing_payments.sql used for `payments`.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization_channel_subscriptions',
    'whatsapp_billing_ledger',
    'meta_usage_charges',
    'sms_usage_charges'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING      (app_rls_bypass() OR organization_id = app_current_org())
         WITH CHECK (app_rls_bypass() OR organization_id = app_current_org())',
      t
    );
  END LOOP;
END $$;

-- invoice_line_items: indirectly scoped via invoices, EXISTS-check pattern.
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON invoice_line_items;
CREATE POLICY tenant_isolation ON invoice_line_items
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM invoices i
       WHERE i.id = invoice_line_items.invoice_id
         AND i.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM invoices i
       WHERE i.id = invoice_line_items.invoice_id
         AND i.organization_id = app_current_org()
    )
  );

-- billing_markup_config: a tenant may read the platform default row
-- (organization_id IS NULL) plus its own override row, but never another
-- org's override. Writes are platform-admin-only in practice (routes
-- gated by requireSuperAdmin under withSystemAccess), but the WITH CHECK
-- still only allows a tenant connection to write its own org's row, never
-- the shared default or another org's.
ALTER TABLE billing_markup_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_markup_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON billing_markup_config;
CREATE POLICY tenant_isolation ON billing_markup_config
  USING      (app_rls_bypass() OR organization_id IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_rls_bypass() OR organization_id = app_current_org());

-- channel_plans, meta_rate_cards, sms_rate_cards: global platform catalogue,
-- no organization_id at all — same category as `permissions`/`roles`,
-- deliberately left out of RLS (every tenant reads the same rows; only
-- platform admins under requireSuperAdmin write them).
