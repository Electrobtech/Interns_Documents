const { pool } = require('@lead/shared');

// --- Sub-shapes kept loose (plain JSON, no schema) for node `data` because
// shape varies wildly by node type. Strict validation of `data` is done at
// the application layer (see src/schemas/flow-schema.md and the flow
// builder itself) rather than in the database, so adding a new node type
// never requires a migration. `nodes` and `global_limits` are stored as
// JSONB — see the design note above the `playbooks` table in
// infra/db/schema.sql for why the node graph isn't normalized further.

/** Maps a raw `playbooks` row to the camelCase shape the engine expects. */
function toPlaybook(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.organization_id,
    name: row.name,
    channels: row.channels || [],
    playbookType: row.playbook_type,
    triggerKeywords: row.trigger_keywords || [],
    status: row.status,
    version: row.version,
    entryNodeId: row.entry_node_id,
    globalLimits: row.global_limits || {},
    nodes: row.nodes || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Builds a Map for O(1) node lookup at runtime — avoids Array.find() on every step of every conversation. */
function getNodeMap(playbook) {
  return new Map(playbook.nodes.map((n) => [n.id, n]));
}

/** Playbook.findById(id) equivalent — no status filter. */
async function findById(id) {
  const { rows } = await pool.query(`SELECT * FROM playbooks WHERE id = $1`, [id]);
  return toPlaybook(rows[0]);
}

/** Playbook.findOne({ _id: id, status: 'active' }) equivalent. */
async function findActiveById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM playbooks WHERE id = $1 AND status = 'active'`,
    [id]
  );
  return toPlaybook(rows[0]);
}

/**
 * Playbook.findOne({ clientId, channels: channel, playbookType, status: 'active' })
 * equivalent — resolves the single active playbook for a client/channel/role
 * (used for the unsubscribe / default / fallback / gen_ai_default roles).
 */
async function findActiveByRole({ clientId, channel, playbookType }) {
  const { rows } = await pool.query(
    `SELECT * FROM playbooks
      WHERE organization_id = $1
        AND $2 = ANY(channels)
        AND playbook_type = $3
        AND status = 'active'
      LIMIT 1`,
    [clientId, channel, playbookType]
  );
  return toPlaybook(rows[0]);
}

/**
 * Playbook.find({ clientId, channels: channel, playbookType: 'standard', status: 'active' })
 * equivalent — every candidate 'standard' playbook that could be triggered
 * by a free-text keyword match on this channel.
 */
async function findActiveStandardCandidates({ clientId, channel }) {
  const { rows } = await pool.query(
    `SELECT * FROM playbooks
      WHERE organization_id = $1
        AND $2 = ANY(channels)
        AND playbook_type = 'standard'
        AND status = 'active'`,
    [clientId, channel]
  );
  return rows.map(toPlaybook);
}

/**
 * Playbook.find({ clientId, channels: channel }).select('id name status').sort('-updated_at')
 * equivalent — every playbook this org has for a channel, newest first.
 * Powers the Bulk Campaign tab's "Flow / Template" dropdown
 * (BulkCampaignTab.jsx): a broadcast picks an existing flow rather than
 * authoring a new message body, so recipients get the flow's actual first
 * outbound node (with each recipient's mapped variables substituted in),
 * not a one-off string. `channel` is optional so the dropdown can also list
 * every flow across channels if the caller omits it.
 */
async function findAllByOrg({ clientId, channel }) {
  const { rows } = await pool.query(
    channel
      ? `SELECT id, name, channels, playbook_type, status, updated_at FROM playbooks
          WHERE organization_id = $1 AND $2 = ANY(channels)
          ORDER BY updated_at DESC`
      : `SELECT id, name, channels, playbook_type, status, updated_at FROM playbooks
          WHERE organization_id = $1
          ORDER BY updated_at DESC`,
    channel ? [clientId, channel] : [clientId]
  );
  // Deliberately not routed through toPlaybook() — that shape includes the
  // full `nodes` JSONB graph, which the dropdown never needs and would just
  // bloat the response for orgs with large flows.
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    channels: r.channels || [],
    playbookType: r.playbook_type,
    status: r.status,
    updatedAt: r.updated_at,
  }));
}

/**
 * Generic upsert-by-id. Used by both the seed script (upsertFromSeed below)
 * and the flow builder's autosave endpoint (playbookController.js) — same
 * "write the whole graph atomically" shape either way, so one query does
 * both jobs. `version` auto-increments on every update (rather than trusting
 * whatever the caller passes) so builder autosaves get a real edit counter
 * for free, while a first-ever insert still starts at whatever `doc.version`
 * was given (defaulting to 1).
 */
async function upsert(doc) {
  const { rows } = await pool.query(
    `INSERT INTO playbooks (
       id, organization_id, name, channels, playbook_type, trigger_keywords,
       status, version, entry_node_id, global_limits, nodes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       organization_id  = EXCLUDED.organization_id,
       name             = EXCLUDED.name,
       channels         = EXCLUDED.channels,
       playbook_type    = EXCLUDED.playbook_type,
       trigger_keywords = EXCLUDED.trigger_keywords,
       status           = EXCLUDED.status,
       version          = playbooks.version + 1,
       entry_node_id    = EXCLUDED.entry_node_id,
       global_limits    = EXCLUDED.global_limits,
       nodes            = EXCLUDED.nodes,
       updated_at       = now()
     RETURNING *`,
    [
      doc.id,
      doc.clientId,
      doc.name,
      doc.channels || [],
      doc.playbookType || 'standard',
      doc.triggerKeywords || [],
      doc.status || 'draft',
      doc.version || 1,
      doc.entryNodeId,
      JSON.stringify(doc.globalLimits || {}),
      JSON.stringify(doc.nodes || []),
    ]
  );
  return toPlaybook(rows[0]);
}

/**
 * Upserts a playbook by its explicit id (used by seed scripts). Mirrors the
 * old `Playbook.findOneAndUpdate({ clientId, name }, doc, { upsert: true })`
 * but keys off `id` instead: the bundled seed/demo flows already carry a
 * stable human-chosen id (e.g. "pb_project_details"), and the frontend's
 * Diagnostic Bench offline-mock fallback references that same id, so using
 * it as the natural upsert key keeps re-running the seed script idempotent
 * without relying on (organization, name) uniqueness.
 */
async function upsertFromSeed(doc) {
  return upsert(doc);
}

module.exports = {
  toPlaybook,
  getNodeMap,
  findById,
  findActiveById,
  findActiveByRole,
  findActiveStandardCandidates,
  findAllByOrg,
  upsert,
  upsertFromSeed,
};
