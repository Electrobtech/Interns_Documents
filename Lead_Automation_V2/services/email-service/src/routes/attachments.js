/**
 * src/routes/attachments.js
 *
 * Inbound attachments are only ever synced as metadata stubs
 * (email_attachments.gmail_attachment_id, see syncService.js) — actual
 * bytes are fetched from Gmail lazily, on first download request, then
 * cached to local disk so repeat views don't re-hit the Gmail API.
 *
 * Mounted in index.js as: app.use('/email/attachments', attachmentsRoutes)
 */

const express = require('express');
const router = express.Router();
const { pool } = require('@lead/shared');
const gmailApi = require('../services/gmailApi');
const { getValidAccessToken } = require('../services/tokenStore');
const { saveBuffer } = require('../services/attachmentStorage');

router.get('/:id/download', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ea.*, em.email_account_id, em.message_id AS gmail_message_id, m.organization_id
         FROM email_attachments ea
         JOIN email_messages em ON em.id = ea.message_id
         JOIN email_accounts m ON m.id = em.email_account_id
        WHERE ea.id = $1`,
      [req.params.id]
    );
    const att = rows[0];
    if (!att || att.organization_id !== req.user.organizationId) {
      return res.status(404).json({ error: 'Attachment not found.' });
    }

    // Already cached to local storage from a previous download — redirect
    // straight to the static file instead of re-fetching from Gmail.
    if (att.url) return res.redirect(att.url);

    if (!att.gmail_attachment_id) {
      return res.status(404).json({ error: 'Attachment has no retrievable content.' });
    }

    const accessToken = await getValidAccessToken(att.email_account_id);
    const raw = await gmailApi.getAttachment(accessToken, att.gmail_message_id, att.gmail_attachment_id);
    const buffer = Buffer.from(raw.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    const url = saveBuffer(buffer, att.filename);
    await pool.query(`UPDATE email_attachments SET url=$1 WHERE id=$2`, [url, att.id]);

    res.redirect(url);
  } catch (err) {
    console.error('[email-attachments] download failed:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
