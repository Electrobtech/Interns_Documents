const express = require('express');
const { pool } = require('@lead/shared');
const { CHANNELS } = require('./campaignsRouter');

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const router = express.Router();

// Real, derived per-channel campaign/broadcast counts for MHChannels.jsx —
// grouped straight off mh_campaigns, never hardcoded.
router.get('/stats', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT channel, kind, COUNT(*)::int AS count
       FROM mh_campaigns WHERE organization_id=$1
      GROUP BY channel, kind`,
    [req.user.organizationId]
  );
  const stats = Object.fromEntries(CHANNELS.map((c) => [c, { campaigns: 0, broadcasts: 0 }]));
  for (const r of rows) {
    if (!stats[r.channel]) continue;
    stats[r.channel][r.kind === 'broadcast' ? 'broadcasts' : 'campaigns'] = r.count;
  }
  res.json(stats);
}));

module.exports = router;
