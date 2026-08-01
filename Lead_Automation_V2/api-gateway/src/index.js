const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());

const AUTH        = process.env.AUTH_SERVICE_URL        || 'http://localhost:4001';
const INBOX       = process.env.INBOX_SERVICE_URL       || 'http://localhost:4002';
const CONTACT     = process.env.CONTACT_SERVICE_URL     || 'http://localhost:4003';
const CAMPAIGN    = process.env.CAMPAIGN_SERVICE_URL    || 'http://localhost:4004';
const AI          = process.env.AI_SERVICE_URL          || 'http://localhost:4005';
const ECOMMERCE   = process.env.ECOMMERCE_SERVICE_URL   || 'http://localhost:4006';
const REVIEW      = process.env.REVIEW_SERVICE_URL      || 'http://localhost:4007';
const ANALYTICS   = process.env.ANALYTICS_SERVICE_URL   || 'http://localhost:4008';
const INTEGRATION = process.env.INTEGRATION_SERVICE_URL || 'http://localhost:4009';
const LINKEDIN     = process.env.LINKEDIN_SERVICE_URL    || 'http://localhost:4009';
const TEAM        = process.env.TEAM_SERVICE_URL        || 'http://localhost:4010';
const AUTOMATION  = process.env.AUTOMATION_SERVICE_URL  || 'http://localhost:4011';
const NOTIFICATION = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4012';
// Gmail Pub/Sub push handler. 4013 matches email-service's own EMAIL_PORT
// default and the EMAIL_SERVICE_URL set in docker-compose.
const EMAIL       = process.env.EMAIL_SERVICE_URL       || 'http://localhost:4013';
const CALENDAR    = process.env.CALENDAR_SERVICE_URL    || 'http://localhost:4014';

app.get('/health', (_req, res) => res.json({ gateway: true, ok: true }));

// Required by Meta before an app can go Live (App Settings -> Basic ->
// Privacy Policy URL). Meta crawls this URL to confirm it resolves and
// contains real content, so it must be reachable from the public internet
// (works via the Cloudflare tunnel pointed at this gateway).
app.get('/privacy-policy', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Privacy Policy - Electrobtech Innovations</title>
  <style>
    body { font-family: -apple-system, Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    h1 { font-size: 1.6em; }
    h2 { font-size: 1.2em; margin-top: 1.5em; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p>Last updated: ${new Date().toISOString().slice(0, 10)}</p>

  <p>Electrobtech Innovations ("we", "us") provides tools to manage customer
  conversations across Facebook Messenger, Instagram Direct, and WhatsApp.
  This page explains what data we collect and how it is used.</p>

  <h2>What we collect</h2>
  <p>When you message our connected Facebook Page, Instagram account, or
  WhatsApp number, we receive and store your message content, your
  platform-provided sender ID, and timestamps, in order to respond to you
  and maintain a record of the conversation.</p>

  <h2>How we use it</h2>
  <p>Message data is used solely to respond to inbound messages (including
  automated replies), maintain conversation history, and improve our
  customer communication. We do not sell this data to third parties.</p>

  <h2>Data retention and deletion</h2>
  <p>You may request deletion of your data at any time by contacting us.
  Facebook/Instagram users can also trigger deletion via Meta's standard
  data deletion request flow.</p>

  <h2>Contact</h2>
  <p>For privacy questions or deletion requests, contact us through the
  same channel you messaged us on.</p>
</body>
</html>`);
});

// Route table — the single public entry point for the frontend.
//
// NOTE: integration-service mounts its own OAuth sub-routes under /auth
// (see services/integration-service/src/routes/auth.js: /auth/connect-url,
// /auth/facebook, /auth/facebook/callback, /auth/refresh-tokens,
// /auth/deauthorize, /auth/data-deletion*) — distinct from auth-service's
// /auth/login and /auth/register. Express matches app.use() middleware in
// registration order and the first match wins, so these more specific
// /auth/* entries MUST be listed before the generic '/auth' -> AUTH entry
// below, or they'd be swallowed by it and 404 against auth-service instead.
const routes = [
  // integration-service owns these specific /auth/* paths; they MUST precede
  // the generic '/auth' -> AUTH entry or that entry swallows them.
  { path: '/auth/connect-url',    target: INTEGRATION },
  { path: '/auth/facebook',       target: INTEGRATION }, // covers /auth/facebook and /auth/facebook/callback
  { path: '/auth/refresh-tokens', target: INTEGRATION },
  { path: '/auth/deauthorize',    target: INTEGRATION },
  { path: '/auth/data-deletion',  target: INTEGRATION }, // covers /auth/data-deletion and /auth/data-deletion-status
  { path: '/auth/unlock',         target: INTEGRATION }, // admin-only: lifts the lock on the Instagram/Facebook connection
  { path: '/instagram',           target: INTEGRATION },
  { path: '/facebook',            target: INTEGRATION },
  { path: '/whatsapp',            target: INTEGRATION },
  { path: '/credentials',         target: INTEGRATION }, // manual API key / App ID / App Secret entry (routes/credentials.js)
  // linkedin-service mounts its own routes under this prefix (see
  // services/linkedin-service/src/index.js).
  { path: '/api/v1/integrations/linkedin', target: LINKEDIN },
  { path: '/auth',                target: AUTH },
  { path: '/company',             target: AUTH },
  { path: '/super-admin',         target: AUTH }, // Platform Super Admin API: superAdminController.js — separate requireSuperAdmin auth, not tenant `authenticate` // Company Registration wizard: companyController.js + gstController.js
  { path: '/conversations',       target: INBOX },
  { path: '/socket.io',           target: INBOX, ws: true }, // live message delivery — see services/inbox-service/src/realtime.js
  { path: '/contacts',            target: CONTACT },
  { path: '/leads',               target: CONTACT },
  { path: '/campaigns',           target: CAMPAIGN },
  { path: '/products',            target: CAMPAIGN }, // offers the marketing agent sells against

  { path: '/ai-agents',           target: AI },
  { path: '/orders',              target: ECOMMERCE },
  { path: '/carts',               target: ECOMMERCE },
  { path: '/recovery-flows',      target: ECOMMERCE },
  { path: '/reviews',             target: REVIEW },
  { path: '/social',              target: REVIEW },
  { path: '/google',              target: REVIEW },
  { path: '/analytics',           target: ANALYTICS },
  { path: '/integrations',        target: INTEGRATION },
  { path: '/api-keys',            target: INTEGRATION },
  { path: '/webhooks',            target: INTEGRATION },
  { path: '/webhook/gmail',       target: EMAIL },       // Gmail Pub/Sub push — must precede the generic '/webhook' below
  { path: '/webhook/sms',         target: INTEGRATION },  // SMS-forwarder-app webhook — must precede the generic '/webhook' below
  { path: '/webhook',             target: INTEGRATION },  // Meta webhook callback (/webhook/meta)
  { path: '/sms',                 target: INTEGRATION },  // device management (list/add/remove connected phones) — routes/smsDevices.js
  { path: '/channels',            target: INTEGRATION },
  { path: '/users',               target: TEAM },
  { path: '/teams',               target: TEAM },
  { path: '/automation',          target: AUTOMATION },
  { path: '/notifications',       target: NOTIFICATION },
  { path: '/email',               target: EMAIL },
  { path: '/calendar',            target: CALENDAR },
];

const wsProxies = [];
for (const r of routes) {
  const proxy = createProxyMiddleware(r.path, {
    target: r.target,
    changeOrigin: true,
    ws: r.ws || false,
    // keep the original path (e.g. /auth/login -> AUTH/auth/login)
  });
  app.use(r.path, proxy);
  if (r.ws) wsProxies.push(proxy);
}

const PORT = process.env.GATEWAY_PORT || 8080;
const server = app.listen(PORT, () => console.log(`api-gateway on :${PORT}`));

// http-proxy-middleware only forwards WebSocket upgrades if the raw HTTP
// server's 'upgrade' event is wired to it directly — Express routing alone
// (app.use above) only ever sees regular HTTP requests, so without this a
// socket.io client's initial ws:// handshake through the gateway would just
// hang. Each ws:true proxy in the routes table gets attached here.
for (const proxy of wsProxies) {
  server.on('upgrade', proxy.upgrade);
}
