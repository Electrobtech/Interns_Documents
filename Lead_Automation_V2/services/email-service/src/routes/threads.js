/**
 * src/routes/threads.js
 *
 * Read routes over the full-fidelity email_threads/email_messages tables
 * — the Unified Inbox (services/inbox-service's /conversations) is the
 * primary place a user browses email day-to-day, but these give a
 * dedicated "Mail" view access to the full thread (all headers, HTML
 * bodies, attachments) that the summarized conversations/messages copy
 * intentionally leaves out.
 *
 * Mounted in index.js as: app.use('/email/threads', threadsRoutes)
 */

const express = require('express');
const router = express.Router();
const { pool } = require('@lead/shared');

router.get('/', async (req, res) => {
  const { accountId, limit = 50, offset = 0 } = req.query;
  const params = [req.user.organizationId];
  let sql = `SELECT t.*, ea.email AS account_email
               FROM email_threads t
               JOIN email_accounts ea ON ea.id = t.email_account_id
              WHERE t.organization_id = $1`;
  if (accountId) { params.push(accountId); sql += ` AND t.email_account_id = $${params.length}`; }
  params.push(Number(limit), Number(offset));
  sql += ` ORDER BY t.last_message_time DESC NULLS LAST LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows: threadRows } = await pool.query(
    `SELECT t.*, ea.email AS account_email
       FROM email_threads t JOIN email_accounts ea ON ea.id = t.email_account_id
      WHERE t.id=$1 AND t.organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  const thread = threadRows[0];
  if (!thread) return res.status(404).json({ error: 'Thread not found.' });

  const { rows: messages } = await pool.query(
    `SELECT * FROM email_messages WHERE thread_id=$1 ORDER BY received_at ASC`,
    [thread.id]
  );

  const messageIds = messages.map((m) => m.id);
  let attachmentsByMessage = {};
  if (messageIds.length) {
    const { rows: attachments } = await pool.query(
      `SELECT * FROM email_attachments WHERE message_id = ANY($1::uuid[])`,
      [messageIds]
    );
    attachmentsByMessage = attachments.reduce((acc, a) => {
      (acc[a.message_id] ||= []).push(a);
      return acc;
    }, {});
  }

  res.json({
    ...thread,
    messages: messages.map((m) => ({ ...m, attachments: attachmentsByMessage[m.id] || [] })),
  });
});

module.exports = router;
