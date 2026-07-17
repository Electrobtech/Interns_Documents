const express = require('express');
const cors = require('cors');
const { pool, authenticate } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate); // every inbox route requires a valid token

const INTEGRATION_SERVICE_URL = process.env.INTEGRATION_SERVICE_URL || 'http://localhost:4009';

/**
 * Actually delivers a reply on the conversation's channel via
 * integration-service, using the caller's own JWT so integration-service's
 * multi-tenant scoping (req.user.organizationId) still applies.
 * Returns { externalId } on success, or throws with a message safe to
 * surface to the user.
 */
async function deliverReply(authHeader, conversation, { body, mediaUrl, mediaType }) {
  const to = conversation.external_contact_id;
  const channel = conversation.channel_type;

  const callIntegration = async (path, payload) => {
    const resp = await fetch(`${INTEGRATION_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Failed to send message.');
    return data;
  };

  if (channel === 'whatsapp') {
    if (!to) throw new Error('This conversation has no WhatsApp number on file — cannot send.');
    const data = mediaUrl
      ? await callIntegration('/whatsapp/send-media', { to, mediaType: mediaType || 'image', link: mediaUrl, caption: body })
      : await callIntegration('/whatsapp/send', { to, text: body });
    return { externalId: data.messageId || null };
  }

  if (channel === 'instagram') {
    if (!to) throw new Error('This conversation has no Instagram sender id on file — cannot send.');
    // Instagram DMs don't support arbitrary media-by-link the same way; text only for now.
    const data = await callIntegration('/instagram/send-message', { recipientId: to, text: body });
    return { externalId: data.messageId || null };
  }

  if (channel === 'messenger' || channel === 'facebook') {
    if (!to) throw new Error('This conversation has no Messenger PSID on file — cannot send.');
    const data = await callIntegration('/facebook/send-message', { recipientId: to, text: body });
    return { externalId: data.messageId || null };
  }

  // sms / webchat / voice / email: no provider wired up in this codebase yet.
  // Fall back to just logging it, same as the previous behavior.
  return { externalId: null };
}

app.get('/health', (_req, res) => res.json({ service: 'inbox', ok: true }));

// List conversations for the caller's org, with optional filters.
app.get('/conversations', async (req, res) => {
  const org = req.user.organizationId;
  const { status, channel } = req.query;
  const params = [org];
  let sql = `SELECT c.id, c.channel_type, c.status, c.last_message_at,
                    ct.name AS contact_name,
                    (SELECT body FROM messages m WHERE m.conversation_id = c.id
                      ORDER BY created_at DESC LIMIT 1) AS last_body
               FROM conversations c
               LEFT JOIN contacts ct ON ct.id = c.contact_id
              WHERE c.organization_id = $1`;
  if (status)  { params.push(status);  sql += ` AND c.status = $${params.length}`; }
  if (channel) { params.push(channel); sql += ` AND c.channel_type = $${params.length}`; }
  sql += ` ORDER BY c.last_message_at DESC LIMIT 100`;
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

app.get('/conversations/:id', async (req, res) => {
  const org = req.user.organizationId;
  const conv = await pool.query(
    `SELECT * FROM conversations WHERE id=$1 AND organization_id=$2`,
    [req.params.id, org]
  );
  if (!conv.rows.length) return res.status(404).json({ error: 'Not found' });
  const msgs = await pool.query(
    `SELECT id, direction, body, sender, created_at FROM messages
      WHERE conversation_id=$1 ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json({ ...conv.rows[0], messages: msgs.rows });
});

// Post a reply (outbound message) — sends it on the real channel
// (WhatsApp / Instagram / Messenger) via integration-service, then logs it.
app.post('/conversations/:id/reply', async (req, res) => {
  const org = req.user.organizationId;
  const { body, mediaUrl, mediaType } = req.body;

  if (!body && !mediaUrl) {
    return res.status(400).json({ error: 'body or mediaUrl is required.' });
  }

  const { rows: convRows } = await pool.query(
    `SELECT * FROM conversations WHERE id=$1 AND organization_id=$2`,
    [req.params.id, org]
  );
  if (!convRows.length) return res.status(404).json({ error: 'Conversation not found.' });

  let externalId = null;
  try {
    const result = await deliverReply(req.headers.authorization, convRows[0], { body, mediaUrl, mediaType });
    externalId = result.externalId;
  } catch (err) {
    console.error('Reply delivery failed:', err.message);
    return res.status(502).json({ error: `Could not deliver reply: ${err.message}` });
  }

  const { rows } = await pool.query(
    `INSERT INTO messages (organization_id, conversation_id, direction, body, sender, media_url, media_type, external_id)
     VALUES ($1,$2,'outbound',$3,$4,$5,$6,$7) RETURNING *`,
    [org, req.params.id, body || null, req.user.userId, mediaUrl || null, mediaType || null, externalId]
  );
  await pool.query(`UPDATE conversations SET last_message_at=now() WHERE id=$1`, [req.params.id]);
  res.status(201).json(rows[0]);
});

app.put('/conversations/:id/status', async (req, res) => {
  const org = req.user.organizationId;
  const { rows } = await pool.query(
    `UPDATE conversations SET status=$1 WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [req.body.status, req.params.id, org]
  );
  res.json(rows[0] || {});
});

app.put('/conversations/:id/assign', async (req, res) => {
  const org = req.user.organizationId;
  const { rows } = await pool.query(
    `UPDATE conversations SET assigned_to=$1 WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [req.body.userId, req.params.id, org]
  );
  res.json(rows[0] || {});
});

const PORT = process.env.INBOX_PORT || 4002;
app.listen(PORT, () => console.log(`inbox-service on :${PORT}`));
