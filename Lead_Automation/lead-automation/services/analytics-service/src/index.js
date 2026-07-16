import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { authenticate } from '@lead/shared';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(cors());

const q = (text, params) => pool.query(text, params);

const noop = () => {};

async function getDashboard(workspaceId) {
  const [
    convRes,
    msgRes,
    inboxTotalRes,
    handoffRes,
    agentRes,
    leadScoreRes,
    topTagsRes,
    trendRes,
  ] = await Promise.all([
    q(
      `SELECT COUNT(*) as total FROM ai_conversations WHERE workspace_id = $1`,
      [workspaceId]
    ),
    q(
      `SELECT direction, COUNT(*) as count
       FROM ai_messages m
       JOIN ai_conversations c ON m.conversation_id = c.id
       WHERE c.workspace_id = $1
       GROUP BY direction`,
      [workspaceId]
    ),
    q(
      `SELECT COUNT(*) as count FROM ai_conversations
       WHERE workspace_id = $1 AND status IN ('new','open','pending','handoff')`,
      [workspaceId]
    ),
    q(
      `SELECT COUNT(*) as count FROM ai_conversations
       WHERE workspace_id = $1 AND status = 'handoff'`,
      [workspaceId]
    ),
    q(
      `SELECT r.selected_agent as agent, COUNT(*) as count
       FROM agent_runs r
       JOIN ai_conversations c ON r.conversation_id = c.id
       WHERE c.workspace_id = $1 GROUP BY r.selected_agent`,
      [workspaceId]
    ),
    q(
      `SELECT AVG(lead_score) as avg, MAX(lead_score) as max FROM ai_contacts
       WHERE workspace_id = $1`,
      [workspaceId]
    ),
    q(
      `SELECT UNNEST(tags) as tag, COUNT(*) as count
       FROM ai_contacts
       WHERE workspace_id = $1 AND array_length(tags, 1) > 0
       GROUP BY tag
       ORDER BY count DESC
       LIMIT 10`,
      [workspaceId]
    ),
    q(
      `SELECT DATE_TRUNC('day', m.created_at) as day, COUNT(*) as count
       FROM ai_messages m
       JOIN ai_conversations c ON m.conversation_id = c.id
       WHERE c.workspace_id = $1 AND m.created_at > NOW() - INTERVAL '7 days'
       GROUP BY day
       ORDER BY day ASC`,
      [workspaceId]
    ),
  ]);

  const messages = msgRes.rows;
  const inbound = messages.find((m) => m.direction === 'inbound')?.count || 0;
  const outbound = messages.find((m) => m.direction === 'outbound')?.count || 0;

  const trend = trendRes.rows.map((r) => ({
    date: r.day.toISOString().slice(0, 10),
    count: Number(r.count),
  }));

  return {
    workspace_id: workspaceId,
    conversations_total: Number(convRes.rows[0].total),
    messages_inbound: Number(inbound),
    messages_outbound: Number(outbound),
    inbox_open: Number(inboxTotalRes.rows[0].count),
    handoffs: Number(handoffRes.rows[0].count),
    agents: agentRes.rows,
    lead_score_avg: Number(leadScoreRes.rows[0]?.avg || 0).toFixed(1),
    lead_score_max: Number(leadScoreRes.rows[0]?.max || 0),
    top_tags: topTagsRes.rows,
    messages_trend: trend,
  };
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'analytics-service' }));

// GET /summary — real CRM-schema dashboard summary (conversations, revenue,
// message trend, channel mix, recent inbox activity) for the main Dashboard.
// Separate from getDashboard() above, which queries a different (unused)
// ai_conversations/ai_contacts schema from an earlier prototype.
app.get('/analytics/summary', authenticate, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const [convRes, openRes, unrepliedRes, revenueRes, trendRes, channelRes, inboxRes] = await Promise.all([
      q(`SELECT COUNT(*)::int as count FROM conversations WHERE organization_id=$1`, [orgId]),
      q(`SELECT COUNT(*)::int as count FROM conversations WHERE organization_id=$1 AND status IN ('open','pending','new')`, [orgId]),
      q(
        `SELECT COUNT(*)::int as count FROM conversations c
          WHERE c.organization_id=$1 AND c.status='open'
            AND EXISTS (
              SELECT 1 FROM messages m WHERE m.conversation_id = c.id
                AND m.direction = 'inbound'
                AND m.created_at = (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id)
            )`,
        [orgId]
      ),
      q(`SELECT COALESCE(SUM(amount), 0) as total FROM ecommerce_orders WHERE organization_id=$1 AND status != 'cancelled'`, [orgId]),
      q(
        `SELECT DATE_TRUNC('day', created_at) as day, COUNT(*)::int as count
           FROM messages WHERE organization_id=$1 AND created_at > NOW() - INTERVAL '7 days'
          GROUP BY day ORDER BY day ASC`,
        [orgId]
      ),
      q(`SELECT channel_type, COUNT(*)::int as count FROM conversations WHERE organization_id=$1 GROUP BY channel_type ORDER BY count DESC`, [orgId]),
      q(
        `SELECT ct.name, c.channel_type, c.status, c.last_message_at,
                (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
           FROM conversations c JOIN contacts ct ON ct.id = c.contact_id
          WHERE c.organization_id=$1
          ORDER BY c.last_message_at DESC NULLS LAST LIMIT 5`,
        [orgId]
      ),
    ]);

    const totalChannelConvos = channelRes.rows.reduce((sum, r) => sum + Number(r.count), 0) || 1;
    const topChannels = channelRes.rows.map((r) => [
      r.channel_type,
      Math.round((Number(r.count) / totalChannelConvos) * 100),
    ]);

    const trend = trendRes.rows.map((r) => ({
      d: r.day.toISOString().slice(5, 10),
      v: Number(r.count),
    }));

    const recentInbox = inboxRes.rows.map((r) => ({
      name: r.name,
      channel: r.channel_type,
      message: r.last_message || '',
      status: r.status,
      time: r.last_message_at
        ? new Date(r.last_message_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : '',
    }));

    res.json({
      totalConversations: convRes.rows[0].count,
      revenueImpact: Number(revenueRes.rows[0].total),
      openConversations: openRes.rows[0].count,
      unreplied: unrepliedRes.rows[0].count,
      trend,
      topChannels,
      recentInbox,
    });
  } catch (e) {
    console.error('[analytics-service] /summary failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/dashboard/:workspaceId', async (req, res) => {
  try {
    const data = await getDashboard(req.params.workspaceId);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/sse/:workspaceId', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = async () => {
    try {
      const data = await getDashboard(req.params.workspaceId);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: e.message })}\n\n`);
    }
  };

  send();
  const interval = setInterval(send, 5000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });

  req.on('error', noop);
});

const PORT = process.env.PORT || 4007;
app.listen(PORT, () => console.log(`Analytics service on ${PORT}`));
