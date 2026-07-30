const { pool } = require('@lead/shared');

// WhatsApp is the one metered channel — Meta bills per 24h conversation, by
// category. Everything here is append-only ledger math: the balance is always
// derived from entries, never stored, so a bug can't silently corrupt an org's
// credit. See infra/db/schema.sql for the entry_type semantics.

const DEFAULT_PRICING = {
  currency: 'INR',
  marketing_cents: 88,
  utility_cents: 30,
  authentication_cents: 30,
  service_cents: 0,
};

async function getPricing(organizationId) {
  const { rows } = await pool.query(
    `SELECT * FROM whatsapp_pricing WHERE organization_id = $1`,
    [organizationId]
  );
  return rows[0] || DEFAULT_PRICING;
}

function rateFor(pricing, category) {
  switch (category) {
    case 'utility': return Number(pricing.utility_cents);
    case 'authentication': return Number(pricing.authentication_cents);
    case 'service': return Number(pricing.service_cents);
    case 'marketing':
    default: return Number(pricing.marketing_cents);
  }
}

// balance = topups + refunds - charges - open reservations.
// Open reservations are subtracted so two concurrent sends can't both pass the
// affordability check against the same underlying credit.
async function getBalance(organizationId) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='topup'), 0)
     + COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='refund'), 0)
     - COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='charge'), 0)
     - COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='reservation' AND status='open'), 0)
       AS available_cents,
       COALESCE(SUM(amount_cents) FILTER (WHERE entry_type='reservation' AND status='open'), 0)
       AS reserved_cents
     FROM whatsapp_billing_ledger
     WHERE organization_id = $1`,
    [organizationId]
  );
  const pricing = await getPricing(organizationId);
  return {
    available_cents: Number(rows[0]?.available_cents || 0),
    reserved_cents: Number(rows[0]?.reserved_cents || 0),
    currency: pricing.currency || 'INR',
  };
}

function estimate(pricing, recipientCount, category = 'marketing') {
  const rate = rateFor(pricing, category);
  return {
    recipient_count: recipientCount,
    conversation_category: category,
    rate_cents: rate,
    total_cents: rate * recipientCount,
    currency: pricing.currency || 'INR',
  };
}

async function estimateFor(organizationId, recipientCount, category = 'marketing') {
  const pricing = await getPricing(organizationId);
  const est = estimate(pricing, recipientCount, category);
  const balance = await getBalance(organizationId);
  return {
    ...est,
    available_cents: balance.available_cents,
    sufficient: balance.available_cents >= est.total_cents,
    shortfall_cents: Math.max(0, est.total_cents - balance.available_cents),
  };
}

// Places a soft hold. Returns { ok: false } rather than throwing when the org
// can't afford it, so the caller can turn it into a clean 402 with a top-up
// prompt instead of a 500.
async function reserve(organizationId, { campaignId, recipientCount, category = 'marketing' }) {
  const est = await estimateFor(organizationId, recipientCount, category);
  if (!est.sufficient) {
    return { ok: false, reason: 'insufficient_balance', estimate: est };
  }
  const { rows } = await pool.query(
    `INSERT INTO whatsapp_billing_ledger
       (organization_id, entry_type, amount_cents, currency, campaign_id,
        conversation_category, recipient_count, status, note)
     VALUES ($1,'reservation',$2,$3,$4,$5,$6,'open',$7)
     RETURNING *`,
    [organizationId, est.total_cents, est.currency, campaignId || null,
     category, recipientCount, `Hold for ${recipientCount} ${category} conversations`]
  );
  return { ok: true, reservation: rows[0], estimate: est };
}

// Post-send reconciliation: only actually-delivered messages get charged.
// The difference between the hold and the real cost is implicitly released
// when the reservation is closed, so failed sends never bill the customer.
async function settle(organizationId, reservationId, { deliveredCount, category = 'marketing' }) {
  const pricing = await getPricing(organizationId);
  const rate = rateFor(pricing, category);
  const actualCents = rate * deliveredCount;

  const { rows: resRows } = await pool.query(
    `UPDATE whatsapp_billing_ledger
        SET status='settled', settled_at=now()
      WHERE id=$1 AND organization_id=$2 AND status='open'
      RETURNING *`,
    [reservationId, organizationId]
  );
  const reservation = resRows[0];
  if (!reservation) return { ok: false, reason: 'reservation_not_open' };

  if (actualCents > 0) {
    await pool.query(
      `INSERT INTO whatsapp_billing_ledger
         (organization_id, entry_type, amount_cents, currency, campaign_id,
          conversation_category, recipient_count, status, reserved_by_entry_id, note)
       VALUES ($1,'charge',$2,$3,$4,$5,$6,'settled',$7,$8)`,
      [organizationId, actualCents, reservation.currency, reservation.campaign_id,
       category, deliveredCount, reservation.id,
       `Delivered ${deliveredCount}/${reservation.recipient_count}`]
    );
  }

  return {
    ok: true,
    reserved_cents: Number(reservation.amount_cents),
    charged_cents: actualCents,
    released_cents: Number(reservation.amount_cents) - actualCents,
    delivered_count: deliveredCount,
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

async function topup(organizationId, amountCents, note) {
  const pricing = await getPricing(organizationId);
  const { rows } = await pool.query(
    `INSERT INTO whatsapp_billing_ledger
       (organization_id, entry_type, amount_cents, currency, status, note)
     VALUES ($1,'topup',$2,$3,'settled',$4) RETURNING *`,
    [organizationId, amountCents, pricing.currency || 'INR', note || 'Manual top-up']
  );
  return rows[0];
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
  getPricing, getBalance, estimateFor, reserve, settle, release, topup, history,
};
