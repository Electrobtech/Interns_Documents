const express = require('express');
const cors = require('cors');
const { pool, authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

app.get('/health', (_req, res) => res.json({ service: 'analytics', ok: true }));

// Format a timestamp as a short "2m / 3h / 1d" relative label for the inbox list.
function relTime(ts) {
  if (!ts) return '';
  const secs = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

// Very small keyword heuristic — there's no stored sentiment column, so the
// "Sentiment tag" column on the dashboard's Recent Conversations table is
// derived on the fly from the most recent inbound-looking text. Good enough
// for an at-a-glance signal; not a substitute for real sentiment analysis.
const URGENT_WORDS = ['urgent', 'asap', 'immediately', 'emergency', 'angry', 'frustrated', 'complain', 'refund', 'cancel', 'not working', 'broken', 'worst', 'terrible', 'disappointed', 'unacceptable'];
const POSITIVE_WORDS = ['thanks', 'thank you', 'great', 'awesome', 'love', 'perfect', 'happy', 'excellent', 'amazing', 'good job'];
function detectSentiment(text) {
  if (!text) return 'neutral';
  const t = text.toLowerCase();
  if (URGENT_WORDS.some((w) => t.includes(w))) return 'urgent';
  if (POSITIVE_WORDS.some((w) => t.includes(w))) return 'positive';
  return 'neutral';
}

// Aggregated summary that powers the dashboard cards, chart, channels,
// funnel and inbox (see frontend/src/app/app/page.jsx).
app.get('/analytics/summary', async (req, res) => {
  const org = req.user.organizationId;
  const [totals, trendRows, channelRows, inboxRows, funnelRows] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*) FROM conversations WHERE organization_id=$1) AS total,
         (SELECT COUNT(*) FROM conversations WHERE organization_id=$1 AND status='open') AS open,
         (SELECT COUNT(*) FROM conversations c WHERE c.organization_id=$1
            AND NOT EXISTS (SELECT 1 FROM messages m
                             WHERE m.conversation_id=c.id AND m.direction='outbound')) AS unreplied,
         (SELECT COALESCE(SUM(amount),0) FROM ecommerce_orders
            WHERE organization_id=$1 AND status IN ('paid','completed')) AS revenue,
         (SELECT COUNT(*) FROM conversations WHERE organization_id=$1 AND handled_by='human') AS human_handled,
         -- Avg seconds between an inbound message and the next bot-authored
         -- outbound reply in the same thread, over the last 30 days.
         (SELECT AVG(response_seconds) FROM (
            SELECT EXTRACT(EPOCH FROM (m_out.created_at - m_in.created_at)) AS response_seconds
              FROM messages m_in
              JOIN LATERAL (
                SELECT created_at FROM messages m2
                 WHERE m2.conversation_id = m_in.conversation_id
                   AND m2.direction = 'outbound' AND m2.sender = 'bot'
                   AND m2.created_at > m_in.created_at
                 ORDER BY m2.created_at ASC LIMIT 1
              ) m_out ON true
             WHERE m_in.organization_id=$1 AND m_in.direction='inbound'
               AND m_in.created_at >= now() - interval '30 days'
          ) r) AS avg_response_seconds`,
      [org]
    ),
    pool.query(
      `SELECT to_char(day,'Dy') AS d, count::int AS v FROM (
         SELECT date_trunc('day', last_message_at) AS day, COUNT(*) AS count
           FROM conversations
          WHERE organization_id=$1 AND last_message_at >= now() - interval '6 days'
          GROUP BY day ORDER BY day
       ) t`,
      [org]
    ),
    pool.query(
      `SELECT channel_type AS name, COUNT(*)::int AS count
         FROM conversations WHERE organization_id=$1
        GROUP BY channel_type ORDER BY count DESC`,
      [org]
    ),
    pool.query(
      `SELECT c.id, c.channel_type, c.status, c.handled_by, c.last_message_at, ct.name AS contact_name,
              (SELECT body FROM messages m WHERE m.conversation_id=c.id
                ORDER BY created_at DESC LIMIT 1) AS last_body,
              (SELECT score FROM leads
                WHERE contact_id=c.contact_id AND organization_id=c.organization_id
                ORDER BY created_at DESC LIMIT 1) AS lead_score
         FROM conversations c LEFT JOIN contacts ct ON ct.id=c.contact_id
        WHERE c.organization_id=$1 ORDER BY c.last_message_at DESC LIMIT 8`,
      [org]
    ),
    // Conversion Funnel & Revenue Matrix: Inquiries Captured -> Qualified
    // Leads -> Meetings Scheduled -> Deals Closed.
    pool.query(
      `SELECT
         (SELECT COUNT(*) FROM leads WHERE organization_id=$1) AS inquiries,
         (SELECT COUNT(*) FROM leads WHERE organization_id=$1 AND stage IN ('qualified','active','won')) AS qualified,
         (SELECT COUNT(DISTINCT contact_id) FROM calendar_events
            WHERE organization_id=$1 AND contact_id IS NOT NULL) AS meetings,
         (SELECT COUNT(*) FROM leads WHERE organization_id=$1 AND stage='won') AS closed`,
      [org]
    ),
  ]);

  const t = totals.rows[0];
  const f = funnelRows.rows[0];
  const channelTotal = channelRows.rows.reduce((s, r) => s + r.count, 0) || 1;

  res.json({
    totalConversations: Number(t.total),
    openConversations: Number(t.open),
    unreplied: Number(t.unreplied),
    revenueImpact: Number(t.revenue),
    humanHandoffRate: Number(t.total) > 0 ? Math.round((Number(t.human_handled) / Number(t.total)) * 1000) / 10 : 0,
    avgResponseSeconds: t.avg_response_seconds != null ? Math.round(Number(t.avg_response_seconds) * 10) / 10 : null,
    trend: trendRows.rows,
    topChannels: channelRows.rows.map((r) => [r.name, Math.round((r.count / channelTotal) * 100)]),
    funnel: {
      inquiries: Number(f.inquiries),
      qualified: Number(f.qualified),
      meetings: Number(f.meetings),
      closed: Number(f.closed),
    },
    recentInbox: inboxRows.rows.map((r) => ({
      id: r.id,
      name: r.contact_name || 'Unknown',
      channel: r.channel_type,
      message: r.last_body || '',
      status: r.status,
      handledBy: r.handled_by,
      leadScore: r.lead_score != null ? Number(r.lead_score) : null,
      sentiment: detectSentiment(r.last_body),
      time: relTime(r.last_message_at),
    })),
  });
});

// Raw analytics events feed.
app.get('/analytics/events', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM analytics_events WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

// Leads grouped by pipeline stage.
app.get('/analytics/leads-by-stage', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT stage AS d, COUNT(*)::int AS v FROM leads
      WHERE organization_id=$1 GROUP BY stage ORDER BY stage`,
    [req.user.organizationId]
  );
  res.json(rows);
});

// Order revenue per day (last 30 days).
app.get('/analytics/orders-by-day', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT to_char(day,'Mon DD') AS d, total::float AS v FROM (
       SELECT date_trunc('day', created_at) AS day, SUM(amount) AS total
         FROM ecommerce_orders
        WHERE organization_id=$1 AND created_at >= now() - interval '30 days'
        GROUP BY day ORDER BY day
     ) t`,
    [req.user.organizationId]
  );
  res.json(rows);
});

// Revenue & ecommerce metrics for the Ecommerce & Revenue module.
app.get('/analytics/revenue', async (req, res) => {
  const org = req.user.organizationId;
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM carts WHERE organization_id=$1) AS total_carts,
       (SELECT COUNT(*) FROM carts WHERE organization_id=$1 AND recovered) AS recovered_carts,
       (SELECT COALESCE(SUM(value),0) FROM carts WHERE organization_id=$1 AND recovered) AS recovered_value,
       (SELECT COUNT(*) FROM ecommerce_orders WHERE organization_id=$1 AND payment_type='cod') AS cod_orders,
       (SELECT COUNT(*) FROM ecommerce_orders WHERE organization_id=$1 AND payment_type='prepaid') AS prepaid_orders,
       (SELECT COALESCE(SUM(amount),0) FROM ecommerce_orders
          WHERE organization_id=$1 AND status IN ('paid','completed')) AS revenue,
       (SELECT COUNT(*) FROM campaigns WHERE organization_id=$1 AND status='sent') AS campaigns_sent`,
    [org]
  );
  const r = rows[0];
  const revenue = Number(r.revenue);
  // Approximate ad spend from sent campaigns to derive an illustrative ROAS.
  const adSpend = Math.max(1, Number(r.campaigns_sent) * 25000);
  res.json({
    totalCarts: Number(r.total_carts),
    recoveredCarts: Number(r.recovered_carts),
    recoveredValue: Number(r.recovered_value),
    codOrders: Number(r.cod_orders),
    prepaidOrders: Number(r.prepaid_orders),
    revenue,
    roas: Math.round((revenue / adSpend) * 100) / 100,
  });
});

// Open conversations that have gone longest without a reply — the "needs
// follow-up" queue for the Analytics dashboard's Upcoming Follow-ups widget.
app.get('/analytics/follow-ups', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.channel_type, c.last_message_at, ct.name AS contact_name, ct.phone AS contact_phone
       FROM conversations c LEFT JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.organization_id=$1 AND c.status='open'
        AND NOT EXISTS (SELECT 1 FROM messages m
                         WHERE m.conversation_id=c.id AND m.direction='outbound')
      ORDER BY c.last_message_at ASC LIMIT 5`,
    [req.user.organizationId]
  );
  res.json(rows.map((r) => ({
    id: r.id,
    name: r.contact_name || r.contact_phone || 'Unknown contact',
    channel: r.channel_type,
    waiting: relTime(r.last_message_at),
  })));
});

const PORT = process.env.ANALYTICS_PORT || 4008;
app.listen(PORT, () => console.log(`analytics-service on :${PORT}`));