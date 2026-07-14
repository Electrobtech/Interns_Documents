const express = require('express');
const cors = require('cors');
const { pool, authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

const asJson = (v) => (v == null || v === '' ? null : typeof v === 'string' ? v : JSON.stringify(v));

app.get('/health', (_req, res) => res.json({ service: 'ai', ok: true }));

// ai_agents has no created_at column — order by name.
app.get('/ai-agents', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM ai_agents WHERE organization_id=$1 ORDER BY name LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/ai-agents', async (req, res) => {
  const { name, type, status, config } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO ai_agents (organization_id, name, type, status, config)
     VALUES ($1,$2,COALESCE($3,'support'),COALESCE($4,'active'),COALESCE($5,'{}')) RETURNING *`,
    [req.user.organizationId, name, type, status, asJson(config)]
  );
  res.status(201).json(rows[0]);
});

app.get('/ai-agents/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM ai_agents WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/ai-agents/:id', async (req, res) => {
  const { name, type, status, config } = req.body;
  const { rows } = await pool.query(
    `UPDATE ai_agents SET name=COALESCE($1,name), type=COALESCE($2,type),
            status=COALESCE($3,status), config=COALESCE($4,config)
      WHERE id=$5 AND organization_id=$6 RETURNING *`,
    [name, type, status, asJson(config), req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.delete('/ai-agents/:id', async (req, res) => {
  await pool.query(`DELETE FROM ai_agents WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  res.json({ ok: true });
});

// ---- AI Assist: suggest a reply for a conversation ----
// Looks at the latest inbound message and returns a context-aware suggestion.
function craftReply(text) {
  const t = (text || '').toLowerCase();
  if (/track|where.*order|status/.test(t))
    return { suggestion: 'You can track your order any time here: https://track.electrobtech.com/orders. Could you share your order ID so I can check the latest status?', confidence: 0.92 };
  if (/size|available|stock|in stock/.test(t))
    return { suggestion: 'Thanks for reaching out! Yes, that item is in stock. Which size would you like — S, M, or L? I can reserve it for you right away.', confidence: 0.88 };
  if (/return|refund|exchange|policy/.test(t))
    return { suggestion: 'Absolutely — we offer easy 7-day returns and exchanges. Would you like me to start a return request for your recent order?', confidence: 0.9 };
  if (/cod|cash on delivery|payment|prepaid/.test(t))
    return { suggestion: 'Yes, both Cash on Delivery and prepaid options are available at checkout. Would you like me to send you a secure payment link?', confidence: 0.87 };
  if (/offer|discount|deal|coupon|price/.test(t))
    return { suggestion: 'Great timing! Use code WELCOME10 for 10% off your first order. Want me to apply it to your cart?', confidence: 0.85 };
  return { suggestion: 'Thanks for your message! I\'d be happy to help. Could you share a few more details so I can assist you better?', confidence: 0.7 };
}

app.post('/ai-agents/suggest', async (req, res) => {
  const org = req.user.organizationId;
  const { conversation_id, message } = req.body;
  let latest = message;
  if (!latest && conversation_id) {
    const { rows } = await pool.query(
      `SELECT m.body FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE m.conversation_id=$1 AND c.organization_id=$2 AND m.direction='inbound'
        ORDER BY m.created_at DESC LIMIT 1`,
      [conversation_id, org]
    );
    latest = rows[0]?.body;
  }
  const result = craftReply(latest);
  if (conversation_id) {
    await pool.query(
      `INSERT INTO ai_suggestions (organization_id, conversation_id, suggestion, confidence)
       VALUES ($1,$2,$3,$4)`,
      [org, conversation_id, result.suggestion, result.confidence]
    ).catch(() => {});
  }
  res.json(result);
});

const PORT = process.env.AI_PORT || 4005;
app.listen(PORT, () => console.log(`ai-service on :${PORT}`));
