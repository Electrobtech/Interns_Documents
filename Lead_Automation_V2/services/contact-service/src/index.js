const express = require('express');
const cors = require('cors');
const { pool, authenticate, requirePermission, logAudit } = require('@lead/shared');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

const canWrite = requirePermission('contacts:write');
const canDelete = requirePermission('contacts:delete');

app.get('/health', (_req, res) => res.json({ service: 'contact', ok: true }));

app.get('/contacts', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM contacts WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.post('/contacts', canWrite, async (req, res) => {
  const { name, email, phone, source, tags } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO contacts (organization_id, name, email, phone, source, tags)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.organizationId, name, email, phone, source, tags || []]
  );
  logAudit(req, 'contact.create', { id: rows[0].id, email });
  res.status(201).json(rows[0]);
});

app.get('/contacts/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM contacts WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

app.put('/contacts/:id', canWrite, async (req, res) => {
  const { name, email, phone, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE contacts SET name=COALESCE($1,name), email=COALESCE($2,email),
            phone=COALESCE($3,phone), notes=COALESCE($4,notes)
      WHERE id=$5 AND organization_id=$6 RETURNING *`,
    [name, email, phone, notes, req.params.id, req.user.organizationId]
  );
  logAudit(req, 'contact.update', { id: req.params.id, changes: { name, email, phone, notes } });
  res.json(rows[0] || {});
});

app.delete('/contacts/:id', canDelete, async (req, res) => {
  await pool.query(`DELETE FROM contacts WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.user.organizationId]);
  logAudit(req, 'contact.delete', { id: req.params.id });
  res.json({ ok: true });
});

// Bulk-tags every contact matching a real, existing `source` value — used by
// the Marketing Agent's "Apply Segment Tags" action. Deliberately scoped to
// an actual contact attribute rather than an AI-guessed match: the agent's
// audience_segments are free-text personas with no contact_id mapping, so
// this only ever tags a real, queryable group, never a fabricated one.
app.post('/contacts/bulk-tag', canWrite, async (req, res) => {
  const { source, tag } = req.body;
  if (!source || !tag) return res.status(400).json({ error: 'source and tag required' });
  const { rows } = await pool.query(
    `UPDATE contacts SET tags = array_append(tags, $1::text)
      WHERE organization_id=$2 AND source=$3 AND NOT ($1::text = ANY(tags))
      RETURNING id`,
    [tag, req.user.organizationId, source]
  );
  logAudit(req, 'contact.bulk_tag', { source, tag, tagged: rows.length });
  res.json({ tagged: rows.length });
});

// Leads
app.get('/leads', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.*, c.name FROM leads l JOIN contacts c ON c.id=l.contact_id
      WHERE l.organization_id=$1 ORDER BY l.created_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows);
});

app.put('/leads/:id/stage', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE leads SET stage=$1 WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [req.body.stage, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

// Creates a lead from a name (e.g. the AI Sales Agent's "Save as Lead"
// action) — finds-or-creates the backing contact by name+source first,
// since these callers usually only have a free-text name/company, not an
// existing contact_id.
app.post('/leads', canWrite, async (req, res) => {
  const { name, company, email, phone, score, priority, stage, source } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const leadSource = source || 'ai-sales-agent';
  const { rows: existing } = await pool.query(
    `SELECT * FROM contacts WHERE organization_id=$1 AND name=$2 AND source=$3 LIMIT 1`,
    [req.user.organizationId, name, leadSource]
  );
  let contact = existing[0];
  if (!contact) {
    const { rows: created } = await pool.query(
      `INSERT INTO contacts (organization_id, name, email, phone, source, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.organizationId, name, email || null, phone || null, leadSource, company ? `Company: ${company}` : null]
    );
    contact = created[0];
    logAudit(req, 'contact.create', { id: contact.id, name });
  }

  const { rows } = await pool.query(
    `INSERT INTO leads (organization_id, contact_id, stage, priority, score)
     VALUES ($1,$2,COALESCE($3,'new'),COALESCE($4,'medium'),COALESCE($5,0))
     RETURNING *, (SELECT name FROM contacts WHERE id=$2) as name`,
    [req.user.organizationId, contact.id, stage, priority, score]
  );
  logAudit(req, 'lead.create', { id: rows[0].id, contact_id: contact.id, score });
  res.status(201).json(rows[0]);
});

const PORT = process.env.CONTACT_PORT || 4003;
app.listen(PORT, () => console.log(`contact-service on :${PORT}`));
