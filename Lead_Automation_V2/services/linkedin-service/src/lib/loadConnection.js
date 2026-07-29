import pool from '../db/client.js';

// Loads the caller's LinkedIn connection onto req.linkedinConnection so
// downstream handlers (and requireScope from ./scopes.js) can check
// granted_scopes / access_token without every route re-querying it.
export default async function loadConnection(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM linkedin_connections WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user?.id || 'default_user']
    );
    req.linkedinConnection = rows[0] || null;
    if (!req.linkedinConnection) {
      return res.status(409).json({ error: 'linkedin_not_connected', message: 'Connect LinkedIn first.' });
    }
    next();
  } catch (error) {
    console.error('loadConnection error:', error);
    res.status(500).json({ error: 'Failed to load LinkedIn connection' });
  }
}
