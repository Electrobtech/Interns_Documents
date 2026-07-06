const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());

const AUTH    = process.env.AUTH_SERVICE_URL    || 'http://localhost:4001';
const INBOX   = process.env.INBOX_SERVICE_URL   || 'http://localhost:4002';
const CONTACT = process.env.CONTACT_SERVICE_URL || 'http://localhost:4003';

app.get('/health', (_req, res) => res.json({ gateway: true, ok: true }));

// Route table — the single public entry point for the frontend.
// Add new services here as you build them (campaign, ai, analytics, ...).
const routes = [
  { path: '/auth',          target: AUTH },
  { path: '/conversations', target: INBOX },
  { path: '/contacts',      target: CONTACT },
  { path: '/leads',         target: CONTACT },
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
