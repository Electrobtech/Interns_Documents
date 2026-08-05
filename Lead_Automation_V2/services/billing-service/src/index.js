const express = require('express');
const cors = require('cors');
const { authenticate } = require('@lead/shared');

const app = express();
app.use(cors());

app.get('/health', (_req, res) => res.json({ service: 'billing', ok: true }));

// Razorpay webhooks are signed over the *raw* request body, so this route
// must be mounted before express.json() runs (a JSON.parse + re-stringify
// round trip can reorder keys/whitespace and break the HMAC check) and
// must NOT go through `authenticate` — Razorpay calls this endpoint
// directly with no tenant JWT. See routes/webhooks.js for the signature
// verification and lib/razorpay.js for how the raw body is captured.
app.use(
  '/billing/webhooks/razorpay',
  express.raw({ type: '*/*' }),
  require('./routes/webhooks')
);

// Everything else is a normal tenant-scoped, JSON API.
app.use(express.json());
app.use(authenticate);

app.use('/billing/wallet', require('./routes/wallet'));
app.use('/billing/orders', require('./routes/checkout'));
app.use('/billing/walkin', require('./routes/walkin'));
app.use('/billing/payments', require('./routes/payments'));
// Channel-subscription billing (SaaS fee per channel) + itemized invoices
// with Meta/SMS pass-through — see channels.js/invoices.js headers.
app.use('/billing', require('./routes/channels'));
app.use('/billing/invoices', require('./routes/invoices'));
// Tenant-level plan charge (registration wizard's Subscription step) —
// separate concern from the per-channel SaaS fees in ./channels.js.
app.use('/billing/subscription-plan', require('./routes/subscriptionPlan'));

app.use((err, _req, res, _next) => {
  console.error('[billing] unhandled error', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal billing error' });
});

const PORT = process.env.PORT || 4015;
app.listen(PORT, () => console.log(`billing-service on :${PORT}`));
