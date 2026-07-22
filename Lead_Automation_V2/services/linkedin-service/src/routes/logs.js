import express from 'express';
import pool from '../db/client.js';

const router = express.Router();

// GET /logs - Get sync logs
router.get('/logs', async (req, res) => {
  try {
    const { module, status, cursor } = req.query;
    let query = 'SELECT * FROM linkedin_sync_logs WHERE user_id = $1';
    const params = [req.user?.id || 'default_user'];

    if (module) {
      query += ' AND module = $2';
      params.push(module);
    }

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const result = await pool.query(query, params);

    const logs = result.rows.map(log => ({
      id: log.id,
      time: log.created_at,
      module: log.module,
      event: log.event,
      status: log.status,
      actor: { type: log.actor_type }
    }));

    res.json({ logs, next_cursor: null });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
