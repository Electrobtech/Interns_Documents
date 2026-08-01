// Thin wrapper around the Razorpay SDK + the two signature checks the
// integration needs (checkout handoff + async webhook). Kept in one file
// so every route imports the same instance instead of re-reading env vars.
const Razorpay = require('razorpay');
const crypto = require('crypto');

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

if (!KEY_ID || !KEY_SECRET) {
  // Don't crash the process at import time (lets `docker compose up` boot
  // the rest of the stack even before keys are configured) — but every
  // route that actually calls Razorpay will fail loudly with this message
  // rather than a cryptic SDK error.
  console.warn('[billing] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set — payment routes will fail until configured in .env');
}

const razorpay = new Razorpay({ key_id: KEY_ID || 'missing', key_secret: KEY_SECRET || 'missing' });

// Convert a rupee amount (e.g. 499.50) to paise (49950) the way Razorpay's
// API requires — always an integer, always round to the nearest paisa.
function toPaise(rupeeAmount) {
  return Math.round(Number(rupeeAmount) * 100);
}
function toRupees(paiseAmount) {
  return Number(paiseAmount) / 100;
}

// Verifies the signature Razorpay Checkout hands back to the browser after
// a successful payment (order_id|payment_id signed with the *key secret*).
// This is the client-side confirmation — still just a hint, never trusted
// alone; routes must treat this as "mark pending, webhook confirms" in
// spirit, but since we also verify here server-side it's safe to act on
// immediately as long as this check passes.
function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return timingSafeEqual(expected, signature);
}

// Verifies the X-Razorpay-Signature header on webhook deliveries (signed
// with the *webhook secret*, configured separately in the Razorpay
// dashboard — never the API key secret). Must run against the raw request
// body bytes, not a re-serialized JSON.parse(...) of it, or the hash won't
// match on any payload with different key ordering/whitespace.
function verifyWebhookSignature({ rawBody, signature }) {
  if (!WEBHOOK_SECRET) {
    console.error('[billing] RAZORPAY_WEBHOOK_SECRET not set — refusing to trust webhook');
    return false;
  }
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { razorpay, toPaise, toRupees, verifyCheckoutSignature, verifyWebhookSignature, KEY_ID };
