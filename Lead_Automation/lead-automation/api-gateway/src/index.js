const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());

const AUTH        = process.env.AUTH_SERVICE_URL        || 'http://localhost:4001';
const INBOX       = process.env.INBOX_SERVICE_URL       || 'http://localhost:4006';
const CONTACT     = process.env.CONTACT_SERVICE_URL     || 'http://localhost:4003';
const CAMPAIGN    = process.env.CAMPAIGN_SERVICE_URL    || 'http://localhost:4004';
const AI          = process.env.AI_SERVICE_URL          || 'http://localhost:4005';
const ECOMMERCE   = process.env.ECOMMERCE_SERVICE_URL   || 'http://localhost:4006';
const REVIEW      = process.env.REVIEW_SERVICE_URL      || 'http://localhost:4007';
const ANALYTICS   = process.env.ANALYTICS_SERVICE_URL   || 'http://localhost:4007';
const INTEGRATION = process.env.INTEGRATION_SERVICE_URL || 'http://localhost:4008';
const LINKEDIN    = process.env.LINKEDIN_SERVICE_URL    || 'http://localhost:4009';
const TEAM        = process.env.TEAM_SERVICE_URL        || 'http://localhost:4010';
const AUTOMATION   = process.env.AUTOMATION_SERVICE_URL  || 'http://localhost:4011';

app.get('/health', (_req, res) => res.json({ gateway: true, ok: true }));

// Route table — the single public entry point for the frontend.
const routes = [
  { path: '/auth',            target: AUTH },
  { path: '/conversations',   target: INBOX },
  { path: '/contacts',        target: CONTACT },
  { path: '/leads',           target: CONTACT },
  { path: '/campaigns',       target: CAMPAIGN },
  { path: '/ai-agents',       target: AI },
  { path: '/orders',          target: ECOMMERCE },
  { path: '/carts',           target: ECOMMERCE },
  { path: '/recovery-flows',  target: ECOMMERCE },
  { path: '/reviews',         target: REVIEW },
  { path: '/social',          target: REVIEW },
  { path: '/analytics',       target: ANALYTICS },
  { path: '/integrations',    target: INTEGRATION },
  { path: '/api-keys',        target: INTEGRATION },
  { path: '/webhooks',        target: INTEGRATION },
  { path: '/channels',        target: INTEGRATION },
  { path: '/linkedin',        target: LINKEDIN },
  { path: '/users',           target: TEAM },
  { path: '/teams',           target: TEAM },
  { path: '/audit-logs',      target: TEAM },
  { path: '/roles',           target: TEAM },
  { path: '/permissions',     target: TEAM },
  { path: '/notifications',   target: TEAM },
  // Lead Automation module (WhatsApp > Automation): flow engine, its
  // simulate/reset helpers, and its own inbound webhook receiver — all
  // namespaced under /automation so they never collide with the CRM's own
  // /webhooks (subscription management, routed to INTEGRATION above).
  { path: '/automation',      target: AUTOMATION },
  // Phase 2 Operations Layer routes
  { path: '/inbox',          target: INBOX },
  { path: '/workflows',      target: AUTOMATION },
];

for (const r of routes) {
  app.use(r.path, createProxyMiddleware({
    target: r.target,
    changeOrigin: true,
    // keep the original path (e.g. /auth/login -> AUTH/auth/login)
  }));
}

const PORT = process.env.GATEWAY_PORT || 8080;
app.listen(PORT, () => console.log(`api-gateway on :${PORT}`));
