// services/campaign-service/src/whatsappBilling.js
//
// WhatsApp campaign billing: pre-send cost estimate -> soft hold
// (reservation) -> post-send settle against actual delivered count ->
// per-message audit rows in meta_usage_charges for the invoice.
//
// REWIRED (see infra/db/migrations/025_channel_subscription_billing.sql):
// this file used to query `whatsapp_pricing` / `whatsapp_billing_ledger`
// as a flat per-org, per-category rate with no schema backing it — dead
// code implementing the flat "per conversation" model Meta phased out on
// July 1 2025. The reserve/settle/release *shape* was sound (a real
// pre-send hold that reconciles down to actual delivered count is exactly
// right for bulk sends), so it's kept — but pricing now comes from
// meta_rate_cards, keyed by (category, recipient country), with GST and
// a configurable markup % applied on top, and amounts are plain ₹
// NUMERIC(14,2) matching the rest of this schema (no more *_cents).
//
// This module is NOT wired into any HTTP route yet by itself — see
// index.js's POST /campaigns/:id/send, which calls estimate() before
// allowing a send and reserve()/settle() around it.
//
// FREE-WINDOW RULE: deliberately isolated in isFreeWindow() below so it's
// a single swappable function, not logic scattered through the cost
// math — Meta is set to start charging for in-window replies too from
// Oct 1 2026, so this function's body is expected to change (or start
// returning false unconditionally) without anything else here changing.
//
// FUTURE: Meta is also introducing usage-based billing for "Meta Business
// Agent" (their own AI reply tool) from Aug 1 2026, billed by token
// usage. Irrelevant here unless this platform ever proxies that specific
// feature — noted so a future dev isn't surprised by a new Meta billing
// line that doesn't fit this per-message-template model.

const { pool } = require('@lead/shared');

const GST_FALLBACK_PERCENT = 18.00;

// Minimal E.164 calling-code prefix table for recipient-country lookup.
// Deliberately small (the countries this platform's clients actually
// message) rather than a full ITU table — falls back to the rate card's
// '*' catch-all row for anything not listed, so an unrecognised prefix
// degrades to a reasonable default instead of throwing.
const CALLING_CODE_PREFIXES = [
  ['91', '91'],   // India
  ['1', '1'],     // US/Canada
  ['44', '44'],   // UK
  ['971', '971'], // UAE
  ['966', '966'], // Saudi Arabia
  ['65', '65'],   // Singapore
  ['61', '61'],   // Australia
];

function countryCodeFromPhone(phone) {
  if (!phone) return '*';
  const digits = String(phone).replace(/[^\d]/g, '');
  const match = CALLING_CODE_PREFIXES
    .filter(([prefix]) => digits.startsWith(prefix))
    .sort((a, b) => b[0].length - a[0].length)[0]; // longest-prefix match
  return match ? match[1] : '*';
}

// Meta's rate for (channel, category, country) as of today — falls back
// to the country-agnostic '*' row if no country-specific row exists yet.
async function getMetaRate(channelType, category, countryCode) {
  const { rows } = await pool.query(
    `SELECT * FROM meta_rate_cards
      WHERE channel_type = $1 AND category = $2
        AND country_code IN ($3, '*')
        AND active = true
        AND effective_from <= CURRENT_DATE
      ORDER BY (country_code = $3) DESC, effective_from DESC
      LIMIT 1`,
    [channelType, category, countryCode]
  );
  return rows[0] || { meta_rate: 0, currency: 'INR', gst_percent: GST_FALLBACK_PERCENT, bsp_markup: 0 };
}

// Markup % to add on top of Meta's actual cost — org-specific override if
// one exists, else the platform-wide default row. This is a product
// decision (pass-through carries a markup, not exact-cost) — see the
// billing_markup_config table comment for the lookup order.
async function getMarkupPercent(organizationId) {
  const { rows } = await pool.query(
    `SELECT markup_percent FROM billing_markup_config
      WHERE organization_id = $1
      UNION ALL
      SELECT markup_percent FROM billing_markup_config WHERE organization_id IS NULL
      LIMIT 1`,
    [organizationId]
  );
  return Number(rows[0]?.markup_percent || 0);
}

// True if this recipient currently has an open 24h customer-service
// window (they messaged us first within the last 24h) — Meta doesn't
// bill template sends inside that window today. See module header: this
// is the one function expected to change when Meta's Oct 1 2026 pricing
// update lands.
async function isFreeWindow(organizationId, contactId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
      WHERE c.organization_id = $1 AND c.contact_id = $2
        AND m.direction = 'inbound'
        AND m.created_at > now() - interval '24 hours'
      LIMIT 1`,
    [organizationId, contactId]
  );
  return rows.length > 0;
}

// Per-message ₹ cost including GST and markup, for one (category, country) combo.
function costFor(rateCardRow, markupPercent) {
  const base = Number(rateCardRow.meta_rate) + Number(rateCardRow.bsp_markup || 0);
  const marked = base * (1 + markupPercent / 100);
  const gstPercent = Number(rateCardRow.gst_percent ?? GST_FALLBACK_PERCENT);
  const gstAmount = marked * (gstPercent / 100);
  return {
    meta_rate: Number(rateCardRow.meta_rate),
    bsp_markup: Number(rateCardRow.bsp_markup || 0),
    markup_percent: markupPercent,
    gst_amount: gstAmount,
    unit_total: marked + gstAmount,
    currency: rateCardRow.currency || 'INR',
  };
}

// Pre-send estimate for a campaign. Recipients are mixed within one
// campaign (some may currently have an open free window) — see per-brief
// note: don't assume the whole campaign is billable, or the whole
// campaign is free. `recipients` is [{ contactId, phone }].
async function estimateFor(organizationId, recipients, category = 'marketing') {
  const markupPercent = await getMarkupPercent(organizationId);
  let billableCount = 0;
  let freeCount = 0;
  let totalAmount = 0;
  const byCountry = {};

  for (const r of recipients) {
    const free = await isFreeWindow(organizationId, r.contactId);
    if (free) { freeCount += 1; continue; }
    billableCount += 1;
    const countryCode = countryCodeFromPhone(r.phone);
    const rateCard = await getMetaRate('whatsapp', category, countryCode);
    const cost = costFor(rateCard, markupPercent);
    totalAmount += cost.unit_total;
    byCountry[countryCode] = (byCountry[countryCode] || 0) + 1;
  }

  return {
    recipient_count: recipients.length,
    billable_count: billableCount,
    free_window_count: freeCount,
    category,
    currency: 'INR',
    total_amount: Number(totalAmount.toFixed(2)),
    by_country: byCountry,
  };
}

// Places a soft hold for the estimated total. Doesn't check wallet
// balance here — WhatsApp campaign cost is a pass-through liability
// against the org's invoice, not a prepaid wallet debit (that's a
// separate, simpler mechanism — see walletModel.deduct() for ad-hoc 1:1
// sends). This hold exists so a concurrent second campaign send from the
// same org can be reasoned about, and so the campaign's own analytics
// page has an estimate to show before anything goes out.
async function reserve(organizationId, { campaignId, recipients, category = 'marketing' }) {
  const est = await estimateFor(organizationId, recipients, category);
  const { rows } = await pool.query(
    `INSERT INTO whatsapp_billing_ledger
       (organization_id, entry_type, amount, currency, campaign_id, category, recipient_count, status, note)
     VALUES ($1,'reservation',$2,$3,$4,$5,$6,'open',$7)
     RETURNING *`,
    [organizationId, est.total_amount, est.currency, campaignId || null, category,
     est.recipient_count, `Hold for ${est.billable_count} billable / ${est.recipient_count} total recipients`]
  );
  return { reservation: rows[0], estimate: est };
}

// Post-send reconciliation: only actually-delivered, actually-billable
// messages get charged. `deliveries` is [{ contactId, phone, delivered }].
// Writes one meta_usage_charges row per delivered+billable message
// (grouped by country+category for readability isn't done here — one row
// per message keeps the audit trail traceable back to a real send, per
// the task brief's "auditable back to an actual sent message" requirement;
// invoice generation aggregates these rows into a single line item).
async function settle(organizationId, reservationId, { deliveries, category = 'marketing', period }) {
  const markupPercent = await getMarkupPercent(organizationId);

  const { rows: resRows } = await pool.query(
    `UPDATE whatsapp_billing_ledger
        SET status='settled', settled_at=now()
      WHERE id=$1 AND organization_id=$2 AND status='open'
      RETURNING *`,
    [reservationId, organizationId]
  );
  const reservation = resRows[0];
  if (!reservation) return { ok: false, reason: 'reservation_not_open' };

  let chargedAmount = 0;
  let chargedCount = 0;
  const periodStart = period || new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  for (const d of deliveries) {
    if (!d.delivered) continue;
    const free = await isFreeWindow(organizationId, d.contactId);
    if (free) continue; // delivered, but landed in a free window — not billable

    const countryCode = countryCodeFromPhone(d.phone);
    const rateCard = await getMetaRate('whatsapp', category, countryCode);
    const cost = costFor(rateCard, markupPercent);

    await pool.query(
      `INSERT INTO meta_usage_charges
         (organization_id, channel_type, category, recipient_country, meta_rate,
          markup_percent, bsp_markup, gst_amount, quantity, total_amount, currency,
          period, campaign_id, reference_id)
       VALUES ($1,'whatsapp',$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$11,$12)`,
      [organizationId, category, countryCode, cost.meta_rate, cost.markup_percent,
       cost.bsp_markup, cost.gst_amount, cost.unit_total, cost.currency,
       periodStart, reservation.campaign_id, d.messageId || null]
    );
    chargedAmount += cost.unit_total;
    chargedCount += 1;
  }

  if (chargedAmount > 0) {
    await pool.query(
      `INSERT INTO whatsapp_billing_ledger
         (organization_id, entry_type, amount, currency, campaign_id, category, recipient_count, status, reserved_by_entry_id, note)
       VALUES ($1,'charge',$2,$3,$4,$5,$6,'settled',$7,$8)`,
      [organizationId, Number(chargedAmount.toFixed(2)), reservation.currency, reservation.campaign_id,
       category, chargedCount, reservation.id, `Charged ${chargedCount} delivered+billable of ${deliveries.length}`]
    );
  }

  return {
    ok: true,
    reserved_amount: Number(reservation.amount),
    charged_amount: Number(chargedAmount.toFixed(2)),
    charged_count: chargedCount,
  };
}

// Releases a hold without charging (send aborted before anything went out).
async function release(organizationId, reservationId, note) {
  const { rows } = await pool.query(
    `UPDATE whatsapp_billing_ledger
        SET status='released', settled_at=now(), note=COALESCE($3, note)
      WHERE id=$1 AND organization_id=$2 AND status='open'
      RETURNING *`,
    [reservationId, organizationId, note || null]
  );
  return { ok: !!rows[0], reservation: rows[0] };
}

async function history(organizationId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT * FROM whatsapp_billing_ledger
      WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [organizationId, limit]
  );
  return rows;
}

module.exports = {
  countryCodeFromPhone, getMetaRate, getMarkupPercent, isFreeWindow,
  estimateFor, reserve, settle, release, history,
};
