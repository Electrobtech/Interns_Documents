/**
 * src/routes/accounts.js
 *
 * Management routes for connected mailboxes — listing, manual re-sync,
 * and small settings like the reply signature. Connecting/disconnecting
 * itself lives in routes/auth.js (the OAuth flow).
 *
 * Mounted in index.js as: app.use('/email/accounts', accountsRoutes)
 * (after authenticate, so req.user.organizationId scopes every query).
 */

const express = require('express');
const router = express.Router();
const { pool } = require('@lead/shared');
const { incrementalSync } = require('../services/syncService');

// Never return access_token/refresh_token to the browser — everything
// downstream (sending, syncing) resolves them server-side via tokenStore.js.
const SAFE_COLUMNS = `id, provider, email, connected, history_id IS NOT NULL AS synced,
                       watch_expires_at, last_synced_at, last_sync_error, signature_html, created_at`;

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM email_accounts WHERE organization_id=$1 ORDER BY created_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM email_accounts WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

router.put('/:id', async (req, res) => {
  const { signatureHtml } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE email_accounts SET signature_html=COALESCE($1, signature_html), updated_at=now()
      WHERE id=$2 AND organization_id=$3 RETURNING ${SAFE_COLUMNS}`,
    [signatureHtml, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

/**
 * POST /email/accounts/:id/sync
 * Manually triggers an incremental sync (or a full initial sync, if this
 * mailbox has never been synced). Useful for testing without waiting for
 * the polling interval, and as a "Refresh" button in the UI.
 */
router.post('/:id/sync', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM email_accounts WHERE id=$1 AND organization_id=$2`,
      [req.params.id, req.user.organizationId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Email account not found.' });

    const result = await incrementalSync(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
