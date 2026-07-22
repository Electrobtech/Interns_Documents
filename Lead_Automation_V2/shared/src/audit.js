const { pool } = require('./db');

// Fire-and-log audit trail entry. Never throws — a logging failure must not
// break the request that triggered it.
async function logAuditRaw(organizationId, userId, action, meta = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (organization_id, user_id, action, meta) VALUES ($1,$2,$3,$4)`,
      [organizationId || null, userId || null, action, JSON.stringify(meta)]
    );
  } catch (e) {
    console.error('[audit] failed to log', action, e.message);
  }
}

function logAudit(req, action, meta = {}) {
  return logAuditRaw(req.user?.organizationId, req.user?.userId, action, meta);
}

module.exports = { logAudit, logAuditRaw };
