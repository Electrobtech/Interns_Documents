const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());

const AUTH         = process.env.AUTH_SERVICE_URL        || 'http://auth-service:4001';
const INBOX        = process.env.INBOX_SERVICE_URL       || 'http://inbox-service:4002';
const CONTACT      = process.env.CONTACT_SERVICE_URL     || 'http://contact-service:4003';
const CAMPAIGN     = process.env.CAMPAIGN_SERVICE_URL    || 'http://campaign-service:4004';
const AI           = process.env.AI_SERVICE_URL          || 'http://ai-overview-service:4020';
const AI_MARKETING = process.env.AI_MARKETING_URL        || 'http://ai-marketing-service:4021';
const AI_SALES     = process.env.AI_SALES_URL            || 'http://ai-sales-service:4022';
const AI_SUPPORT   = process.env.AI_SUPPORT_URL          || 'http://ai-support-service:4023';
const ECOMMERCE    = process.env.ECOMMERCE_SERVICE_URL   || 'http://ecommerce-service:4006';
const REVIEW       = process.env.REVIEW_SERVICE_URL      || 'http://review-service:4007';
const ANALYTICS    = process.env.ANALYTICS_SERVICE_URL   || 'http://analytics-service:4008';
const INTEGRATION  = process.env.INTEGRATION_SERVICE_URL || 'http://integration-service:4008';
const LINKEDIN     = process.env.LINKEDIN_SERVICE_URL    || 'http://linkedin-service:4009';
const TEAM         = process.env.TEAM_SERVICE_URL        || 'http://team-service:4010';
const AUTOMATION   = process.env.AUTOMATION_SERVICE_URL  || 'http://automation-service:4011';
const NOTIFICATION = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4012';
const EMAIL        = process.env.EMAIL_SERVICE_URL       || 'http://email-service:4013';
const CALENDAR     = process.env.CALENDAR_SERVICE_URL    || 'http://calendar-service:4014';
const BILLING      = process.env.BILLING_SERVICE_URL     || 'http://billing-service:4015';
const FINANCE      = process.env.FINANCE_SERVICE_URL     || 'http://finance-service:4016';

app.get('/health', (_req, res) => res.json({ gateway: true, ok: true }));

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

const routes = [
  { path: '/auth/connect-url',    target: INTEGRATION },
  { path: '/auth/facebook',       target: INTEGRATION },
  { path: '/auth/refresh-tokens', target: INTEGRATION },
  { path: '/auth/deauthorize',    target: INTEGRATION },
  { path: '/auth/data-deletion',  target: INTEGRATION },
  { path: '/auth/unlock',         target: INTEGRATION },
  { path: '/instagram',           target: INTEGRATION },
  { path: '/facebook',            target: INTEGRATION },
  { path: '/whatsapp',            target: INTEGRATION },
  { path: '/credentials',         target: INTEGRATION },
  { path: '/api/v1/integrations/linkedin', target: LINKEDIN },
  { path: '/auth',                target: AUTH },
  { path: '/super-admin',         target: AUTH },
  { path: '/company',             target: AUTH },
  { path: '/conversations',       target: INBOX },
  { path: '/socket.io',           target: INBOX, ws: true },
  { path: '/contacts',            target: CONTACT },
  { path: '/leads',               target: CONTACT },
  { path: '/follow-ups',          target: CONTACT },
  { path: '/campaigns',           target: CAMPAIGN },
  { path: '/templates',           target: CAMPAIGN },
  { path: '/products',            target: CAMPAIGN },
  { path: '/uploads',             target: CAMPAIGN },
  { path: '/ai-agents/marketing', target: AI_MARKETING },
  { path: '/ai-agents/sales',     target: AI_SALES },
  { path: '/ai-agents/support',   target: AI_SUPPORT },
  { path: '/agents/marketing',    target: AI_MARKETING },
  { path: '/agents/sales',        target: AI_SALES },
  { path: '/agents/support',      target: AI_SUPPORT },
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
  { path: '/webhook/gmail',       target: EMAIL },
  { path: '/webhook/sms',         target: INTEGRATION },
  { path: '/webhook',             target: INTEGRATION },
  { path: '/sms',                 target: INTEGRATION },
  { path: '/channels',            target: INTEGRATION },
  { path: '/users',               target: TEAM },
  { path: '/teams',               target: TEAM },
  { path: '/automation',          target: AUTOMATION },
  { path: '/notifications',       target: NOTIFICATION },
  { path: '/email',               target: EMAIL },
  { path: '/calendar',            target: CALENDAR },
  { path: '/billing',             target: BILLING },
  { path: '/finances',            target: FINANCE },
];

const wsProxies = [];
for (const r of routes) {
  const proxy = createProxyMiddleware(r.path, {
    target: r.target,
    changeOrigin: true,
    ws: r.ws || false,
  });
  app.use(r.path, proxy);
  if (r.ws) wsProxies.push(proxy);
}

const PORT = process.env.GATEWAY_PORT || 8080;
const server = app.listen(PORT, () => console.log(`api-gateway on :${PORT}`));

for (const proxy of wsProxies) {
  server.on('upgrade', proxy.upgrade);
}