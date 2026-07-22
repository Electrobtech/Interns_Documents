import express from 'express';
import pool from '../db/client.js';

const router = express.Router();

// GET /approvals - List approvals
router.get('/approvals', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM linkedin_approvals WHERE user_id = $1';
    const params = [req.user?.id || 'default_user'];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    const approvals = result.rows.map(approval => ({
      id: approval.id,
      type: approval.type,
      title: approval.title,
      detail: approval.detail,
      status: approval.status,
      created_at: approval.created_at,
      payload_preview: approval.payload_preview
    }));

    res.json({ approvals });
  } catch (error) {
    console.error('Get approvals error:', error);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

// GET /approvals/:id - Get approval details
router.get('/approvals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM linkedin_approvals WHERE id = $1 AND user_id = $2',
      [id, req.user?.id || 'default_user']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get approval error:', error);
    res.status(500).json({ error: 'Failed to fetch approval' });
  }
});

// POST /approvals/:id/decision - Make decision on approval
router.post('/approvals/:id/decision', async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, note } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision' });
    }

    const result = await pool.query(
      `UPDATE linkedin_approvals 
       SET status = $1, decision_note = $2, decided_by = $3, decided_at = NOW() 
       WHERE id = $4 AND user_id = $5 
       RETURNING *`,
      [decision, note || null, req.user?.id || 'default_user', id, req.user?.id || 'default_user']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    // Log the decision
    await pool.query(
      `INSERT INTO linkedin_sync_logs (user_id, module, event, status, actor_type)
       VALUES ($1, 'approvals', $2, $3, 'user')`,
      [req.user?.id || 'default_user', `${decision}: ${result.rows[0].title}`, decision, req.user?.id || 'default_user']
    );

    res.json({
      id: result.rows[0].id,
      status: decision,
      decided_by: req.user?.id || 'default_user',
      decided_at: result.rows[0].decided_at
    });
  } catch (error) {
    console.error('Decision error:', error);
    res.status(500).json({ error: 'Failed to process decision' });
  }
});

export default router;
