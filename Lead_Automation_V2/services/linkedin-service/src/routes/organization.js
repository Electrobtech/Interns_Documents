import express from 'express';
import pool from '../db/client.js';

const router = express.Router();

// GET /organization/profile - Get organization profile
router.get('/organization/profile', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM linkedin_organizations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user?.id || 'default_user']
    );

    if (result.rows.length === 0) {
      return res.json({
        org_urn: null,
        description: null,
        logo_url: null,
        follower_count: null,
        last_synced_at: null
      });
    }

    const org = result.rows[0];
    res.json({
      org_urn: org.org_urn,
      description: org.description,
      logo_url: org.logo_url,
      follower_count: org.follower_count,
      last_synced_at: org.last_synced_at
    });
  } catch (error) {
    console.error('Get org profile error:', error);
    res.status(500).json({ error: 'Failed to fetch organization profile' });
  }
});

export default router;
