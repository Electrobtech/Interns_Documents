import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

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
