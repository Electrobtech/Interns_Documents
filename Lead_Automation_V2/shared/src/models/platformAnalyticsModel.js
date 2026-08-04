// shared/src/models/platformAnalyticsModel.js
//
// Module 3 — Aggregated Analytics Dashboard. Cross-tenant counterpart to
// analytics-service/src/index.js (which is per-org/RLS-scoped and stays
// that way). Every query here intentionally spans every tenant, so
// callers must run under withSystemAccess() the same way the rest of
// superAdminController.js does.
//
// SCOPE NOTE ON "message delivery rates": the schema (see `messages` in
// schema.sql) does not record a per-message delivery/read status —
// there's no sent/delivered/failed column, only that a row exists.
// Rather than fabricate a delivery-rate percentage from data that isn't
// there, this module reports message *volume* (a real, verifiable
// number) and leaves true delivery-rate tracking as a schema gap for
// whoever wires provider delivery webhooks (WhatsApp/Meta status
// callbacks) into `messages` later.

const { pool } = require('../db');

const RANGE_KEYS = Object.freeze(['today', '7d', '30d', 'this_month', 'custom']);

// Turns a range key (+ optional custom from/to) into concrete UTC bounds.
// `end` is always exclusive-of-tomorrow (i.e. "through the end of today"),
// matching how a human reads "Last 7 Days" as including today.
function resolveRange({ range = '7d', from, to } = {}) {
  if (!RANGE_KEYS.includes(range)) {
    throw new Error(`Unknown range "${range}". Expected one of: ${RANGE_KEYS.join(', ')}`);
  }

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endExclusive = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  if (range === 'custom') {
    if (!from || !to) throw new Error('range=custom requires both "from" and "to" (ISO dates)');
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('"from"/"to" must be valid dates');
    }
    if (start > end) throw new Error('"from" must be before "to"');
    // end is a calendar date the caller picked ("through Aug 3") — make it
    // exclusive-of-the-next-day so that day's rows are included.
    return { start, end: new Date(end.getTime() + 24 * 60 * 60 * 1000), label: 'Custom Range' };
  }
  if (range === 'today') {
    return { start: startOfToday, end: endExclusive, label: 'Today' };
  }
  if (range === '7d') {
    return { start: new Date(endExclusive.getTime() - 7 * 24 * 60 * 60 * 1000), end: endExclusive, label: 'Last 7 Days' };
  }
  if (range === '30d') {
    return { start: new Date(endExclusive.getTime() - 30 * 24 * 60 * 60 * 1000), end: endExclusive, label: 'Last 30 Days' };
  }
  // this_month
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, end: endExclusive, label: 'This Month' };
}

// Platform-wide headline numbers for the selected range.
async function overview({ start, end }) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM organizations WHERE created_at >= $1 AND created_at < $2) AS new_tenants,
       (SELECT COUNT(*) FROM conversations WHERE created_at >= $1 AND created_at < $2) AS new_conversations,
       (SELECT COUNT(*) FROM messages WHERE created_at >= $1 AND created_at < $2) AS messages,
       (SELECT COUNT(*) FROM messages WHERE direction = 'outbound' AND created_at >= $1 AND created_at < $2) AS messages_outbound,
       -- Platform revenue = money the *platform* collected from tenants:
       -- wallet top-ups (prepaid credit purchases) plus paid subscription
       -- invoices. Deliberately excludes ECOMMERCE_ORDER/WALKIN_SALE in
       -- payments, which is a tenant's own customers paying that
       -- tenant, not revenue to the platform.
       (SELECT COALESCE(SUM(amount), 0) FROM payments
          WHERE purpose = 'WALLET_RECHARGE' AND status = 'paid'
            AND created_at >= $1 AND created_at < $2) AS wallet_topups,
       -- invoices has no paid_at column (see schema.sql) — updated_at is
       -- the closest available proxy for "when this was marked paid".
       (SELECT COALESCE(SUM(amount), 0) FROM invoices
          WHERE status = 'paid' AND updated_at >= $1 AND updated_at < $2) AS invoices_paid
    `,
    [start, end]
  );
  const r = rows[0];
  const walletTopups = Number(r.wallet_topups);
  const invoicesPaid = Number(r.invoices_paid);
  return {
    newTenants: Number(r.new_tenants),
    newConversations: Number(r.new_conversations),
    messages: Number(r.messages),
    messagesOutbound: Number(r.messages_outbound),
    walletTopups,
    invoicesPaid,
    platformRevenue: walletTopups + invoicesPaid,
  };
}

// Multi-Channel Distribution — conversation & message volume per channel,
// across every tenant, in range, plus how many tenants currently have
// that channel enabled (from Module 1's channel_quotas).
async function channelDistribution({ start, end }) {
  const { rows } = await pool.query(
    `WITH conv AS (
       SELECT channel_type AS channel, COUNT(*)::int AS conversations
         FROM conversations
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY channel_type
     ),
     msg AS (
       SELECT c.channel_type AS channel, COUNT(*)::int AS messages
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE m.created_at >= $1 AND m.created_at < $2
        GROUP BY c.channel_type
     ),
     quota AS (
       SELECT channel, COUNT(*) FILTER (WHERE enabled)::int AS tenants_enabled
         FROM channel_quotas
        GROUP BY channel
     )
     SELECT
       COALESCE(conv.channel, msg.channel, quota.channel) AS channel,
       COALESCE(conv.conversations, 0) AS conversations,
       COALESCE(msg.messages, 0) AS messages,
       COALESCE(quota.tenants_enabled, 0) AS tenants_enabled
     FROM conv
     FULL OUTER JOIN msg ON msg.channel = conv.channel
     FULL OUTER JOIN quota ON quota.channel = COALESCE(conv.channel, msg.channel)
     ORDER BY conversations DESC NULLS LAST`,
    [start, end]
  );
  const totalConversations = rows.reduce((s, r) => s + r.conversations, 0) || 1;
  const totalMessages = rows.reduce((s, r) => s + r.messages, 0) || 1;
  return rows.map((r) => ({
    channel: r.channel,
    conversations: r.conversations,
    messages: r.messages,
    tenantsEnabled: r.tenants_enabled,
    pctOfConversations: Math.round((r.conversations / totalConversations) * 1000) / 10,
    pctOfMessages: Math.round((r.messages / totalMessages) * 1000) / 10,
  }));
}

// AI & Automation Metrics — playbook executions (conversation_sessions is
// the execution-log table: one row per playbook run against one
// contact), resolution rate, top playbooks, and how much of the
// conversation volume in range was bot- vs human-handled.
async function automationMetrics({ start, end }) {
  // NOTE: these three queries are deliberately sequential, not
  // Promise.all'd. Inside withSystemAccess()/withTenantScope(), pool.query
  // routes through one pg Client pinned to the async context (see db.js) —
  // running several queries on it concurrently is not safe (confirmed:
  // triggered pg's "client already executing a query" warning under real
  // load in testing) and is deprecated in node-postgres.
  const byStatusRes = await pool.query(
    `SELECT status, COUNT(*)::int AS count
       FROM conversation_sessions
      WHERE started_at >= $1 AND started_at < $2
      GROUP BY status`,
    [start, end]
  );
  const topPlaybooksRes = await pool.query(
    `SELECT cs.playbook_id, p.name, p.organization_id, o.name AS organization_name, COUNT(*)::int AS executions
       FROM conversation_sessions cs
       JOIN playbooks p ON p.id = cs.playbook_id
       JOIN organizations o ON o.id = p.organization_id
      WHERE cs.started_at >= $1 AND cs.started_at < $2
      GROUP BY cs.playbook_id, p.name, p.organization_id, o.name
      ORDER BY executions DESC
      LIMIT 10`,
    [start, end]
  );
  const handledByRes = await pool.query(
    `SELECT handled_by, COUNT(*)::int AS count
       FROM conversations
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY handled_by`,
    [start, end]
  );

  const byStatus = { active: 0, completed: 0, handed_off: 0, expired: 0 };
  for (const row of byStatusRes.rows) byStatus[row.status] = row.count;
  const totalExecutions = Object.values(byStatus).reduce((a, b) => a + b, 0);
  // "Resolved by AI" = completed without a human handoff, out of every
  // execution that has actually finished one way or the other (completed
  // or handed_off) — excludes still-`active`/`expired` sessions, which
  // aren't a resolution outcome yet.
  const finished = byStatus.completed + byStatus.handed_off;
  const aiResolutionRatePct = finished ? Math.round((byStatus.completed / finished) * 1000) / 10 : null;

  const handledBy = { bot: 0, human: 0 };
  for (const row of handledByRes.rows) handledBy[row.handled_by] = row.count;

  return {
    totalExecutions,
    byStatus,
    aiResolutionRatePct,
    handledBy,
    topPlaybooks: topPlaybooksRes.rows.map((r) => ({
      playbookId: r.playbook_id,
      name: r.name,
      organizationId: r.organization_id,
      organizationName: r.organization_name,
      executions: r.executions,
    })),
  };
}

module.exports = { RANGE_KEYS, resolveRange, overview, channelDistribution, automationMetrics };
