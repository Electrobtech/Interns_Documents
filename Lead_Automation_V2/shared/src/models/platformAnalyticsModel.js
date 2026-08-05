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

// Very small keyword heuristic, identical in spirit to the one already
// used per-org in analytics-service/src/index.js (detectSentiment) — the
// schema has no stored sentiment/intent column, so "Lead Sentiment &
// Intent Breakdown" below is derived on the fly from the most recent
// inbound-looking text on each lead's contact. An at-a-glance signal,
// not a substitute for real NLU.
const HIGH_INTENT_WORDS = ['buy', 'purchase', 'sign up', 'get started', 'ready', 'when can we', 'contract'];
const PRICING_WORDS = ['price', 'pricing', 'cost', 'quote', 'how much', 'plan'];
function classifyIntent(text) {
  if (!text) return 'unresponsive';
  const t = text.toLowerCase();
  if (HIGH_INTENT_WORDS.some((w) => t.includes(w))) return 'high_intent';
  if (PRICING_WORDS.some((w) => t.includes(w))) return 'pricing';
  return 'general_query';
}

// ---------- Sales AI Agent Performance ----------
// SCOPE NOTE ON "Pipeline Value": leads has no deal-value column (see
// schema.sql) — there is nothing resembling a deal size stored anywhere
// on a lead. Rather than invent a number, this reports an *estimated*
// pipeline value using a configurable assumed-deal-value, the same
// honest-estimate pattern the ecommerce/revenue endpoint already uses
// for ROAS (approximating ad spend from campaigns sent). Treat
// `pipelineValueEstimated` as illustrative, not a real financial figure.
const ASSUMED_AVG_DEAL_VALUE = 15000; // INR — see scope note above
async function salesPerformance({ start, end }) {
  const funnelRes = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM leads WHERE created_at >= $1 AND created_at < $2) AS discovered,
       (SELECT COUNT(*) FROM leads WHERE created_at >= $1 AND created_at < $2 AND score > 0) AS engaged,
       (SELECT COUNT(*) FROM leads WHERE created_at >= $1 AND created_at < $2
          AND stage IN ('qualified','active','won')) AS qualified,
       (SELECT COUNT(DISTINCT l.id) FROM leads l JOIN calendar_events ce ON ce.contact_id = l.contact_id
          WHERE l.created_at >= $1 AND l.created_at < $2) AS demo_booked,
       (SELECT COUNT(*) FROM leads WHERE created_at >= $1 AND created_at < $2 AND stage = 'won') AS closed_won`,
    [start, end]
  );
  const f = funnelRes.rows[0];
  const discovered = Number(f.discovered);
  const qualified = Number(f.qualified);
  const closedWon = Number(f.closed_won);

  const byOrgRes = await pool.query(
    `SELECT o.id AS organization_id, o.name AS organization_name,
            COUNT(*)::int AS leads, COUNT(*) FILTER (WHERE l.stage = 'won')::int AS won,
            COUNT(*) FILTER (WHERE l.stage IN ('qualified','active','won'))::int AS qualified
       FROM leads l JOIN organizations o ON o.id = l.organization_id
      WHERE l.created_at >= $1 AND l.created_at < $2
      GROUP BY o.id, o.name
      HAVING COUNT(*) > 0
      ORDER BY leads DESC
      LIMIT 15`,
    [start, end]
  );

  // Intent classification needs each lead's most recent inbound message —
  // pulled per-lead via its contact's conversations, same join shape as
  // the per-org inbox query in analytics-service/index.js.
  const intentRes = await pool.query(
    `SELECT
       (SELECT body FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
         WHERE c.contact_id = l.contact_id AND m.direction = 'inbound'
         ORDER BY m.created_at DESC LIMIT 1) AS last_inbound
       FROM leads l WHERE l.created_at >= $1 AND l.created_at < $2`,
    [start, end]
  );
  const intentCounts = { high_intent: 0, pricing: 0, general_query: 0, unresponsive: 0 };
  for (const row of intentRes.rows) intentCounts[classifyIntent(row.last_inbound)] += 1;

  return {
    kpis: {
      leadsEngaged: Number(f.engaged),
      leadsQualified: qualified,
      conversionRatePct: discovered ? Math.round((closedWon / discovered) * 1000) / 10 : 0,
      pipelineValueEstimated: closedWon * ASSUMED_AVG_DEAL_VALUE + qualified * ASSUMED_AVG_DEAL_VALUE * 0.3,
      meetingBookingRatePct: discovered ? Math.round((Number(f.demo_booked) / discovered) * 1000) / 10 : 0,
    },
    funnel: {
      discovered,
      engaged: Number(f.engaged),
      qualified,
      demoBooked: Number(f.demo_booked),
      closedWon,
    },
    agentPerformance: byOrgRes.rows.map((r) => ({
      organizationId: r.organization_id,
      organizationName: r.organization_name,
      leads: r.leads,
      qualified: r.qualified,
      won: r.won,
      conversionRatePct: r.leads ? Math.round((r.won / r.leads) * 1000) / 10 : 0,
    })),
    intentBreakdown: [
      { intent: 'high_intent', label: 'High Intent', count: intentCounts.high_intent },
      { intent: 'pricing', label: 'Looking for Pricing', count: intentCounts.pricing },
      { intent: 'general_query', label: 'General Query', count: intentCounts.general_query },
      { intent: 'unresponsive', label: 'Unresponsive', count: intentCounts.unresponsive },
    ],
  };
}

// ---------- Marketing AI Agent Performance ----------
// SCOPE NOTE ON "Cost Per Acquisition / ROAS": same estimate pattern as
// analytics-service's /analytics/revenue endpoint — there's no stored ad
// spend, so spend is approximated from campaigns sent. Treat `roas` /
// `cpaEstimated` here as illustrative, consistent with that endpoint.
const ASSUMED_SPEND_PER_CAMPAIGN = 2500; // INR — see scope note above
async function marketingPerformance({ start, end }) {
  const totalsRes = await pool.query(
    `SELECT
       (SELECT COALESCE(SUM(total_recipients),0) FROM campaigns WHERE created_at >= $1 AND created_at < $2) AS reach,
       (SELECT COUNT(*) FROM campaign_logs WHERE event IN ('clicked','replied') AND created_at >= $1 AND created_at < $2) AS engagements,
       (SELECT COALESCE(SUM(sent_count),0) FROM campaigns WHERE created_at >= $1 AND created_at < $2) AS sent,
       (SELECT COUNT(*) FROM campaign_logs WHERE event = 'converted' AND created_at >= $1 AND created_at < $2) AS inbound_leads,
       (SELECT COUNT(*) FROM campaigns WHERE created_at >= $1 AND created_at < $2) AS campaigns_run`,
    [start, end]
  );
  const t = totalsRes.rows[0];
  const sent = Number(t.sent);
  const engagements = Number(t.engagements);
  const spendEstimated = Number(t.campaigns_run) * ASSUMED_SPEND_PER_CAMPAIGN;
  const inboundLeads = Number(t.inbound_leads);

  const byChannelRes = await pool.query(
    `SELECT COALESCE(c.channel_type, 'unknown') AS channel,
            COUNT(*)::int AS campaigns,
            COALESCE(SUM(c.sent_count),0)::int AS sent,
            COUNT(cl.id) FILTER (WHERE cl.event IN ('clicked','replied'))::int AS engagements
       FROM campaigns c
       LEFT JOIN campaign_logs cl ON cl.campaign_id = c.id AND cl.created_at >= $1 AND cl.created_at < $2
      WHERE c.created_at >= $1 AND c.created_at < $2
      GROUP BY c.channel_type
      ORDER BY sent DESC`,
    [start, end]
  );

  const byPlaybookRes = await pool.query(
    `SELECT p.id AS playbook_id, p.name,
            COUNT(DISTINCT c.id)::int AS campaigns,
            COALESCE(SUM(c.sent_count),0)::int AS sent,
            COUNT(cl.id) FILTER (WHERE cl.event = 'opened')::int AS opens,
            COUNT(cl.id) FILTER (WHERE cl.event = 'converted')::int AS conversions,
            COUNT(cl.id) FILTER (WHERE cl.event = 'replied' AND cl.created_at >= $1 AND cl.created_at < $2)::int AS unsubscribe_proxy
       FROM playbooks p
       JOIN campaigns c ON c.flow_playbook_id = p.id
       LEFT JOIN campaign_logs cl ON cl.campaign_id = c.id
      WHERE c.created_at >= $1 AND c.created_at < $2
      GROUP BY p.id, p.name
      HAVING COALESCE(SUM(c.sent_count),0) > 0
      ORDER BY sent DESC
      LIMIT 10`,
    [start, end]
  );

  // Peak engagement by hour-of-day (UTC) across all campaign_logs
  // "clicked"/"replied" events in range.
  const heatmapRes = await pool.query(
    `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS engagements
       FROM campaign_logs
      WHERE event IN ('clicked','replied') AND created_at >= $1 AND created_at < $2
      GROUP BY hour
      ORDER BY hour`,
    [start, end]
  );

  return {
    kpis: {
      reach: Number(t.reach),
      engagementRatePct: sent ? Math.round((engagements / sent) * 1000) / 10 : 0,
      inboundLeadsGenerated: inboundLeads,
      cpaEstimated: inboundLeads ? Math.round((spendEstimated / inboundLeads) * 100) / 100 : null,
      roasEstimated: spendEstimated ? Math.round((inboundLeads * ASSUMED_AVG_DEAL_VALUE / spendEstimated) * 100) / 100 : null,
    },
    byChannel: byChannelRes.rows.map((r) => ({
      channel: r.channel,
      campaigns: r.campaigns,
      sent: r.sent,
      engagements: r.engagements,
      engagementRatePct: r.sent ? Math.round((r.engagements / r.sent) * 1000) / 10 : 0,
    })),
    playbookComparison: byPlaybookRes.rows.map((r) => ({
      playbookId: r.playbook_id,
      name: r.name,
      campaigns: r.campaigns,
      sent: r.sent,
      openRatePct: r.sent ? Math.round((r.opens / r.sent) * 1000) / 10 : 0,
      conversionRatePct: r.sent ? Math.round((r.conversions / r.sent) * 1000) / 10 : 0,
    })),
    peakEngagement: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      engagements: heatmapRes.rows.find((r) => r.hour === hour)?.engagements || 0,
    })),
  };
}

// ---------- Support AI Agent Performance ----------
// SCOPE NOTE ON "CSAT": the schema has no CSAT/rating column anywhere
// (see schema.sql) — no survey table, no rating field on conversations
// or messages. Rather than fabricate a satisfaction score, `csatPct` is
// reported as null with this note, matching how the overview endpoint
// already handles "message delivery rate" for the same reason (data
// that isn't there shouldn't be invented as a percentage).
async function supportPerformance({ start, end }) {
  const totalsRes = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE handled_by = 'human')::int AS human_handled,
       AVG(r.response_seconds) AS avg_response_seconds
       FROM conversations c
       LEFT JOIN LATERAL (
         SELECT EXTRACT(EPOCH FROM (m_out.created_at - m_in.created_at)) AS response_seconds
           FROM messages m_in
           JOIN LATERAL (
             SELECT created_at FROM messages m2
              WHERE m2.conversation_id = m_in.conversation_id
                AND m2.direction = 'outbound' AND m2.sender = 'bot'
                AND m2.created_at > m_in.created_at
              ORDER BY m2.created_at ASC LIMIT 1
           ) m_out ON true
          WHERE m_in.conversation_id = c.id AND m_in.direction = 'inbound'
          ORDER BY m_in.created_at DESC LIMIT 1
       ) r ON true
      WHERE c.created_at >= $1 AND c.created_at < $2`,
    [start, end]
  );
  const t = totalsRes.rows[0];
  const total = Number(t.total);
  const humanHandled = Number(t.human_handled);

  // "Resolution time" = how long a conversation_session ran before it
  // finished (completed or handed_off) — the closest real analogue to
  // ticket resolution time given conversation_sessions is the
  // execution-log table (see comment on automationMetrics above).
  const resolutionRes = await pool.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - started_at))) AS avg_resolution_seconds
       FROM conversation_sessions
      WHERE started_at >= $1 AND started_at < $2 AND status IN ('completed','handed_off')`,
    [start, end]
  );

  const deflectionTrendRes = await pool.query(
    `SELECT to_char(day,'Mon DD') AS d,
            COUNT(*) FILTER (WHERE handled_by = 'bot')::int AS bot,
            COUNT(*) FILTER (WHERE handled_by = 'human')::int AS human
       FROM (SELECT date_trunc('day', created_at) AS day, handled_by
               FROM conversations WHERE created_at >= $1 AND created_at < $2) t
      GROUP BY day ORDER BY day`,
    [start, end]
  );

  // "Query categories" — the schema has no ticket-category column, so
  // this groups by the playbook that handled the session, which is the
  // closest real proxy for "what topic was this conversation about"
  // (each playbook models one intent/flow, e.g. billing, login, returns).
  const categoriesRes = await pool.query(
    `SELECT p.name AS category, COUNT(*)::int AS conversations,
            COUNT(*) FILTER (WHERE cs.status = 'completed')::int AS ai_resolved
       FROM conversation_sessions cs JOIN playbooks p ON p.id = cs.playbook_id
      WHERE cs.started_at >= $1 AND cs.started_at < $2
      GROUP BY p.name
      ORDER BY conversations DESC
      LIMIT 8`,
    [start, end]
  );

  // Flags any conversation where a human is already involved AND the
  // latest inbound message trips the same urgent-keyword heuristic used
  // per-org in analytics-service/index.js — a real, if blunt, signal for
  // "needs a human look", not a model-scored escalation.
  const escalationsRes = await pool.query(
    `SELECT c.id, o.name AS organization_name, c.channel_type, c.last_message_at,
            (SELECT body FROM messages m WHERE m.conversation_id = c.id
              ORDER BY created_at DESC LIMIT 1) AS last_body
       FROM conversations c JOIN organizations o ON o.id = c.organization_id
      WHERE c.handled_by = 'human' AND c.created_at >= $1 AND c.created_at < $2
      ORDER BY c.last_message_at DESC
      LIMIT 50`,
    [start, end]
  );
  const URGENT_WORDS = ['urgent', 'asap', 'immediately', 'emergency', 'angry', 'frustrated', 'complain', 'refund', 'cancel', 'not working', 'broken', 'worst', 'terrible', 'disappointed', 'unacceptable'];
  const escalations = escalationsRes.rows
    .filter((r) => r.last_body && URGENT_WORDS.some((w) => r.last_body.toLowerCase().includes(w)))
    .slice(0, 20)
    .map((r) => ({
      conversationId: r.id,
      organizationName: r.organization_name,
      channel: r.channel_type,
      lastMessageAt: r.last_message_at,
    }));

  return {
    kpis: {
      totalConversations: total,
      firstResponseSeconds: t.avg_response_seconds != null ? Math.round(Number(t.avg_response_seconds) * 10) / 10 : null,
      resolutionSeconds: resolutionRes.rows[0].avg_resolution_seconds != null
        ? Math.round(Number(resolutionRes.rows[0].avg_resolution_seconds) * 10) / 10 : null,
      csatPct: null, // see SCOPE NOTE above — no CSAT data exists in the schema
      humanHandoffRatePct: total ? Math.round((humanHandled / total) * 1000) / 10 : 0,
    },
    deflectionTrend: deflectionTrendRes.rows,
    queryCategories: categoriesRes.rows.map((r) => ({
      category: r.category,
      conversations: r.conversations,
      aiResolutionRatePct: r.conversations ? Math.round((r.ai_resolved / r.conversations) * 1000) / 10 : 0,
    })),
    escalations,
  };
}

// ---------- Platform & Tenant Financials ----------
async function financePerformance({ start, end }) {
  const mrrRes = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN billing_cycle = 'yearly' THEN amount / 12 ELSE amount END), 0) AS mrr,
            COUNT(*)::int AS active_subscriptions
       FROM subscriptions WHERE status = 'active'`
  );
  const mrr = Number(mrrRes.rows[0].mrr);
  const activeSubs = Number(mrrRes.rows[0].active_subscriptions);

  const churnRes = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'canceled' AND canceled_at >= $1 AND canceled_at < $2)::int AS churned,
       COUNT(*) FILTER (WHERE status = 'active')::int AS active_now`,
    [start, end]
  );
  const churned = Number(churnRes.rows[0].churned);
  const activeNow = Number(churnRes.rows[0].active_now);
  // Simple monthly churn-rate → LTV approximation (ARPU / churn rate),
  // the standard SaaS shorthand — not a cohort-based LTV model.
  const churnRatePct = activeNow ? Math.round((churned / activeNow) * 1000) / 10 : 0;
  const arpu = activeSubs ? Math.round((mrr / activeSubs) * 100) / 100 : 0;
  const ltvEstimated = churnRatePct ? Math.round((arpu / (churnRatePct / 100)) * 100) / 100 : null;

  const usageCostRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS usage_cost
       FROM wallet_transactions
      WHERE type = 'USAGE_DEDUCTION' AND created_at >= $1 AND created_at < $2`,
    [start, end]
  );
  // wallet_transactions stores USAGE_DEDUCTION as a negative amount (a
  // debit) — normalize to a positive "cost" figure for display.
  const usageCost = Math.abs(Number(usageCostRes.rows[0].usage_cost));

  const revenueRes = await pool.query(
    `SELECT to_char(day,'Mon DD') AS d, revenue::float, cost::float FROM (
       SELECT date_trunc('day', gs) AS day,
              COALESCE((SELECT SUM(amount) FROM payments
                         WHERE purpose = 'WALLET_RECHARGE' AND status = 'paid'
                           AND date_trunc('day', created_at) = gs), 0)
              + COALESCE((SELECT SUM(amount) FROM invoices
                         WHERE status = 'paid' AND date_trunc('day', updated_at) = gs), 0) AS revenue,
              COALESCE((SELECT SUM(ABS(amount)) FROM wallet_transactions
                         WHERE type = 'USAGE_DEDUCTION' AND date_trunc('day', created_at) = gs), 0) AS cost
         FROM generate_series($1::date, ($2::date - interval '1 day'), interval '1 day') gs
     ) t
     ORDER BY day`,
    [start, end]
  );

  const tierRes = await pool.query(
    `SELECT
       CASE WHEN subscription_plan IN ('starter','professional','enterprise') THEN subscription_plan ELSE 'custom' END AS tier,
       COUNT(*)::int AS tenants
       FROM organizations
      GROUP BY tier
      ORDER BY tenants DESC`
  );

  const overdueRes = await pool.query(
    `SELECT i.id, o.name AS organization_name, i.amount, i.due_date, i.status
       FROM invoices i JOIN organizations o ON o.id = i.organization_id
      WHERE i.status = 'issued' AND i.due_date < CURRENT_DATE
      ORDER BY i.due_date ASC
      LIMIT 25`
  );
  const statusCountsRes = await pool.query(
    `SELECT status, COUNT(*)::int AS count FROM invoices
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY status`,
    [start, end]
  );

  return {
    kpis: {
      mrr,
      arr: Math.round(mrr * 12 * 100) / 100,
      arpu,
      ltvEstimated,
      churnRatePct,
      usageCost,
      revenueMarginPct: mrr ? Math.round(((mrr - usageCost) / mrr) * 1000) / 10 : null,
    },
    revenueTrend: revenueRes.rows.map((r) => ({ date: r.d, revenue: r.revenue, cost: r.cost, net: r.revenue - r.cost })),
    tierBreakdown: tierRes.rows,
    invoiceStatusCounts: statusCountsRes.rows,
    overdueInvoices: overdueRes.rows.map((r) => ({
      invoiceId: r.id,
      organizationName: r.organization_name,
      amount: Number(r.amount),
      dueDate: r.due_date,
      status: r.status,
    })),
  };
}

module.exports = {
  RANGE_KEYS,
  resolveRange,
  overview,
  channelDistribution,
  automationMetrics,
  salesPerformance,
  marketingPerformance,
  supportPerformance,
  financePerformance,
};
