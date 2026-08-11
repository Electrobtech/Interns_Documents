const express = require('express');
const { pool } = require('@lead/shared');
const { CHANNELS } = require('./campaignsRouter');

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const router = express.Router();

// Real, derived per-channel campaign/broadcast counts for MHChannels.jsx —
// grouped straight off mh_campaigns, never hardcoded. ?days=7|30|90 filters
// by created_at; omit for all-time.
router.get('/stats', ah(async (req, res) => {
  const days = parseInt(req.query.days, 10);
  const hasWindow = Number.isFinite(days) && days > 0;
  const { rows } = await pool.query(
    `SELECT channel, kind, COUNT(*)::int AS count
       FROM mh_campaigns
      WHERE organization_id=$1 ${hasWindow ? 'AND created_at >= now() - ($2 || \' days\')::interval' : ''}
      GROUP BY channel, kind`,
    hasWindow ? [req.user.organizationId, days] : [req.user.organizationId]
  );
  const stats = Object.fromEntries(CHANNELS.map((c) => [c, { campaigns: 0, broadcasts: 0 }]));
  for (const r of rows) {
    if (!stats[r.channel]) continue;
    stats[r.channel][r.kind === 'broadcast' ? 'broadcasts' : 'campaigns'] = r.count;
  }
  res.json(stats);
}));

module.exports = router;
