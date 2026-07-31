// shared/src/models/leadModel.js
//
// Data-access layer for `leads`, used by Sales Agent Metrics (section B).
//
// IMPORTANT: `leads` itself has no `assigned_to` column — only
// `conversations` does (schema.sql). So "leads assigned to an agent" is
// derived by joining leads -> contacts -> conversations.assigned_to,
// not a direct column lookup. Flagging this so nobody adds a duplicate
// assigned_to column to `leads` without realizing the join already
// covers it.

const { pool } = require('../db');

async function listByOrg(organizationId, { stage } = {}) {
  const params = [organizationId];
  let where = 'WHERE l.organization_id = $1';
  if (stage) {
    params.push(stage);
    where += ` AND l.stage = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT l.*, c.name AS contact_name
       FROM leads l
       LEFT JOIN contacts c ON c.id = l.contact_id
      ${where}
      ORDER BY l.created_at DESC`,
    params
  );
  return rows;
}

// Per-agent lead metrics: total assigned, and a conversion rate defined
// as (leads in stage 'won') / (total leads touched by that agent).
async function agentMetrics(organizationId) {
  const { rows } = await pool.query(
    `SELECT
       conv.assigned_to AS user_id,
       COUNT(DISTINCT l.id)::int AS total_leads,
       COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'won')::int AS won_leads,
       COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'lost')::int AS lost_leads,
       CASE WHEN COUNT(DISTINCT l.id) = 0 THEN 0
            ELSE ROUND(COUNT(DISTINCT l.id) FILTER (WHERE l.stage = 'won')::numeric
                       / COUNT(DISTINCT l.id) * 100, 2)
       END AS conversion_rate_pct
     FROM leads l
     JOIN contacts c ON c.id = l.contact_id
     JOIN conversations conv ON conv.contact_id = c.id AND conv.organization_id = l.organization_id
     WHERE l.organization_id = $1 AND conv.assigned_to IS NOT NULL
     GROUP BY conv.assigned_to`,
    [organizationId]
  );
  return rows;
}

async function pipelineSummary(organizationId) {
  const { rows } = await pool.query(
    `SELECT stage, COUNT(*)::int AS count
       FROM leads
      WHERE organization_id = $1
      GROUP BY stage`,
    [organizationId]
  );
  return rows;
}

module.exports = { listByOrg, agentMetrics, pipelineSummary };
