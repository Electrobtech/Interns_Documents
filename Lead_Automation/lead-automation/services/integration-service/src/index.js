const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'integration-service' }));

// --- CRM connection management ---

app.post('/crm/connections', async (req, res) => {
  try {
    const { workspace_id, provider, config, active } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO crm_connections (id, workspace_id, provider, config, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [crypto.randomUUID(), workspace_id, provider, JSON.stringify(config || {}), active !== false]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/crm/connections/:workspaceId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, provider, config, active, created_at FROM crm_connections
     WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [req.params.workspaceId]
  );
  res.json(rows);
});

app.delete('/crm/connections/:id', async (req, res) => {
  await pool.query(`DELETE FROM crm_connections WHERE id = $1`, [req.params.id]);
  res.json({ deleted: true });
});

// --- Outbound sync (internal -> CRM) ---

app.post('/crm/sync/outbound', async (req, res) => {
  try {
    const { workspace_id, connection_id, entity_type, entity_id, payload } = req.body;
    if (!workspace_id || !entity_type) {
      return res.status(400).json({ error: 'workspace_id and entity_type required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO crm_sync_jobs (id, workspace_id, connection_id, direction, entity_type, entity_id, payload, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'outbound', $4, $5, $6, 'pending', NOW(), NOW()) RETURNING *`,
      [crypto.randomUUID(), workspace_id, connection_id || null, entity_type, entity_id || null, JSON.stringify(payload || {})]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/crm/sync-jobs/:workspaceId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM crm_sync_jobs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.params.workspaceId]
  );
  res.json(rows);
});

// --- Inbound sync (CRM -> internal) ---

app.post('/crm/webhook/inbound', async (req, res) => {
  try {
    const { workspace_id, email, phone, instagram_id, updates } = req.body;
    if (!workspace_id || !(email || phone || instagram_id)) {
      return res.status(400).json({ error: 'workspace_id and at least one identifier required' });
    }

    await pool.query(
      `UPDATE ai_contacts
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           instagram_id = COALESCE($4, instagram_id),
           lead_score = COALESCE($5, lead_score),
           status = COALESCE($6, status),
           tags = CASE WHEN $7::text[] IS NULL THEN tags ELSE $7::text[] END,
           updated_at = NOW()
       WHERE workspace_id = $8
         AND (email = $2 OR phone = $3 OR instagram_id = $4)`,
      [
        updates?.name || null,
        email || null,
        phone || null,
        instagram_id || null,
        updates?.lead_score || null,
        updates?.status || null,
        updates?.tags || null,
        workspace_id,
      ]
    );

    res.json({ synced: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Background sync worker ---

async function processJobs() {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM crm_sync_jobs
       WHERE status = 'pending' AND attempts < 5
       ORDER BY created_at ASC
       LIMIT 10`
    );

    for (const job of rows) {
      await pool.query(
        `UPDATE crm_sync_jobs SET status = 'processing', attempts = attempts + 1, updated_at = NOW() WHERE id = $1`,
        [job.id]
      );

      try {
        // Here you would call the real CRM provider API.
        // For this scaffold, we simulate a successful push.
        await new Promise((r) => setTimeout(r, 200));
        console.log(`Synced ${job.entity_type} ${job.entity_id} to CRM`);

        await pool.query(
          `UPDATE crm_sync_jobs SET status = 'completed', updated_at = NOW() WHERE id = $1`,
          [job.id]
        );
      } catch (e) {
        await pool.query(
          `UPDATE crm_sync_jobs SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
          [e.message, job.id]
        );
      }
    }
  } catch (e) {
    console.error('Sync worker error:', e.message);
  }
}

setInterval(processJobs, 30000);

const PORT = process.env.PORT || 4008;
app.listen(PORT, () => console.log(`Integration service on ${PORT}`));
