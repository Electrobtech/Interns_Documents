# Channel Subscription Billing — What Changed

Implements per-channel subscription billing (our SaaS fee) plus itemized
Meta/SMS usage pass-through, per the task brief.

## Product decisions locked in (confirmed with you before building)
- Meta/SMS pass-through carries a **configurable markup %** (not exact
  cost) — stored in `billing_markup_config`, editable by a platform admin,
  applied dynamically at charge time. No percentage is hardcoded.
- Mid-cycle channel add/remove: **no proration** — full month either way.
- Per-channel **`trial_ends_at`** field added; invoice generation skips
  subscriptions still inside their trial.
- The orphaned `whatsappBilling.js` reserve/settle ledger was **rewired**,
  not deleted or left alone — same hold->settle->charge shape, now backed
  by real tables and real per-message/per-country/per-category pricing.

## Files touched
- `infra/db/migrations/025_channel_subscription_billing.sql` — new
  migration (idempotent, re-run-safe, tested against a real Postgres 16
  instance both standalone and layered on the pre-existing schema).
- `infra/db/schema.sql` — same tables added for fresh installs, placed
  after `platform_admins` (FK ordering).
- `infra/db/rls.sql` — new org-scoped tables added to the RLS loop;
  `invoice_line_items` (EXISTS-based, like `campaign_audiences`) and
  `billing_markup_config` (nullable-org, platform-default-row) get
  bespoke policies. **RLS isolation was actually tested** — a
  non-superuser `app_user` role, two orgs, cross-tenant read/write
  attempts, bypass mode, and the nullable-org default-row case all
  verified against a live database, not just eyeballed.
- `services/campaign-service/src/whatsappBilling.js` — rewritten.
  Rate lookups from `meta_rate_cards` (category x recipient country),
  configurable markup, GST, and a swappable `isFreeWindow()` — isolated
  on purpose since Meta is set to start charging for in-window replies
  from Oct 1 2026 and this is the one function that'll need to change.
- `services/campaign-service/src/index.js` — new
  `GET /campaigns/:id/cost-estimate`; `POST /campaigns/:id/send` now
  reserves a hold before sending WhatsApp and settles it against actual
  deliveries afterward.
- `services/billing-service/src/routes/channels.js` (new) —
  `GET /billing/plans`, `GET /billing/subscription`,
  `PUT /billing/subscription/channels` (blocks silently disabling a
  still-connected channel unless explicitly confirmed).
- `services/billing-service/src/routes/invoices.js` (new) —
  `GET /billing/invoices`, `GET /billing/invoices/:id` (itemized, each
  line explicitly labeled "Platform fee" vs "Meta usage fee - passed
  through at our published rate"), `POST /billing/invoices/generate`
  (monthly job: aggregates subscriptions + usage charges, settles from
  wallet if it covers the total, else issues a Razorpay payment link
  through the *existing* payments/webhook reconciliation path).
- `services/billing-service/src/routes/webhooks.js` — added the
  `INVOICE_SETTLEMENT` case to the existing `payment_link.paid` handler.
- `services/auth-service/src/controllers/superAdminController.js` —
  platform-admin endpoints for the channel-plan catalogue, Meta/SMS rate
  cards, and markup config. Superseding a price never `UPDATE`s in
  place — deactivates the old row, inserts a new one, so already-
  subscribed orgs keep their snapshotted price.
- `frontend/src/components/billing/ChannelSubscriptions.jsx` (new),
  `InvoiceView.jsx` (new), wired into the existing tenant Billing page
  as two new tabs.

## Verified, not just written
Spun up a real Postgres 16 locally and ran: `schema.sql` fresh-install
path end to end; the original (pre-change) `schema.sql` from your zip
followed by the new migration, simulating a real upgrade; `rls.sql`
fresh and layered; and hands-on RLS isolation tests (two fake orgs,
cross-tenant read blocked, cross-tenant write silently no-ops, system
bypass sees both, the nullable-org default markup row is visible to
every tenant). All passed. Every JS file was `node --check`ed.

## Follow-up: real payment on subscribe + per-message rate display
Added after the initial build, per your request:
- **`infra/db/migrations/026_channel_subscription_payment.sql`** — new
  `pending_payment` status on `organization_channel_subscriptions`
  (tested: the rebuilt unique index correctly blocks a duplicate
  subscribe attempt while one's still pending) + `CHANNEL_SUBSCRIPTION`
  added to `payments.purpose`.
- **`channels.js`** — saving now creates `pending_payment` rows (not
  `active`) for newly toggled-on channels, then `POST
  /billing/subscription/checkout` + `POST /billing/subscription/verify`
  run the exact same Razorpay order → Checkout.js → signature-verify
  flow wallet recharge already uses. A channel only goes `active` once
  the charge actually clears. New `GET /billing/usage-rates` returns the
  effective per-message rate (Meta/carrier cost + this org's markup % +
  GST — verified against seed data) for every channel/category so the
  UI shows what actually lands on the invoice, not the wholesale rate.
- **`webhooks.js`** — `CHANNEL_SUBSCRIPTION` case activates every
  `pending_payment` row for that org (webhook is the source of truth,
  same as the other purposes; `/verify` is just the faster same-tab path).
- **`ChannelSubscriptions.jsx`** — Save now opens the Razorpay Checkout
  sheet for anything newly enabled; a "Pending payment" badge + banner
  appears if a charge didn't complete, with a retry button. Each card
  shows the per-message usage rate (or "No usage fees" for
  LinkedIn/Email, "No usage fees currently" for Messenger/Instagram,
  since Meta doesn't charge those today).

All of this was re-verified against a live Postgres instance the same
way as the original build: fresh-install schema, the real upgrade path
(pre-existing schema → 025 → 026), both migrations re-run for
idempotency, and the new unique-index behavior tested with actual insert
attempts.

1. **`campaignSendController.js` sends plain text, not real Meta
   template messages** — so today, campaigns can only reach contacts with
   an open 24h window, meaning the marketing-fee billing path this task
   built won't actually charge anything until real template sending
   exists. Per your direction, the billing/metering layer is built now;
   wiring in real template sends is separate follow-up work.
2. **No outbound SMS carrier integration exists** in this repo —
   `sms_devices` is inbound-forwarding only (a person's own phone
   forwarding received SMS). `sms_rate_cards`/`sms_usage_charges` are in
   place and billing-service can invoice against them, but nothing
   currently writes usage rows into `sms_usage_charges` because there's
   no outbound SMS send path yet.
3. Country-code detection for WhatsApp recipients
   (`countryCodeFromPhone` in `whatsappBilling.js`) is a small prefix
   table for the countries this platform's clients actually message, not
   a full E.164 table — falls back to the rate card's `*` catch-all row
   for anything unrecognized.
