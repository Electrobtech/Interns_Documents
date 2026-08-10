const express = require('express');
const cors = require('cors');
const { pool, authenticate, requirePermission, logAudit } = require('@lead/shared');
const importRoutes = require('./importRoutes');
const followUpRoutes = require('./followUpRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

const canWrite = requirePermission('contacts:write');
const canDelete = requirePermission('contacts:delete');

app.get('/health', (_req, res) => res.json({ service: 'contact', ok: true }));

// CSV/XLSX import. Mounted before the /contacts/:id routes below so
// /contacts/import is not swallowed by :id, and it parses its own
// multipart body via multer (express.json above ignores multipart).
app.use(importRoutes);

// Follow-ups: manual reminders (Follow-ups page, Contact/Lead detail views)
// plus rows created automatically by the Automation Builder's Handoff node
// (services/automation-service writes those directly to the shared
// follow_ups table — see followUpRepository.js — so nothing here needs to
// call out to automation-service).
app.use(followUpRoutes);

app.get('/contacts', async (req, res) => {
  // ?tag=vip lets the Bulk Campaign tab's "Contact Segment" dropdown
  // (BulkCampaignTab.jsx) pull every contact carrying a given tag as the
  // broadcast's recipient list — same `tags` column used elsewhere (e.g.
  // /contacts/bulk-tag below), just filterable here instead of write-only.
  const { tag } = req.query;
  const { rows } = await pool.query(
    tag
      ? `SELECT * FROM contacts WHERE organization_id=$1 AND $2 = ANY(tags) ORDER BY created_at DESC LIMIT 5000`
      : `SELECT * FROM contacts WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200`,
    tag ? [req.user.organizationId, tag] : [req.user.organizationId]
  );
  res.json(rows);
});

// GET /contacts/segments
// Every distinct tag this org currently has on at least one contact, with
// how many contacts carry it — powers the Bulk Campaign tab's segment
// picker without it needing to know tag names in advance. Registered
// before /contacts/:id so it's never mistaken for an id lookup.
app.get('/contacts/segments', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT tag, COUNT(*)::int AS contact_count
       FROM contacts, UNNEST(tags) AS tag
      WHERE organization_id = $1
      GROUP BY tag
      ORDER BY tag`,
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
    // c.source is the lead's real inbound channel (email/whatsapp/linkedin/
    // etc — see contacts.source) — joined in so the Sales Agent workspace
    // has a real channel to show/default the Fit Scorer's pills to, instead
    // of guessing one. p.name/p.category are joined in from products (see
    // migrations/032_lead_product_id.sql) so per-product forecasting has a
    // real label to show without a second round-trip.
    `SELECT l.*, c.name, c.source, p.name AS product_name, p.category AS product_category
       FROM leads l
       JOIN contacts c ON c.id=l.contact_id
       LEFT JOIN products p ON p.id=l.product_id
      WHERE l.organization_id=$1 ORDER BY l.created_at DESC`,
    [req.user.organizationId]
  );
  res.json(rows);
});

// GET /leads/fields — the real numeric columns on `leads` a dashboard could
// aggregate into a dollar figure. Backs the "Configure Deal Field" modal's
// dropdown so it only ever offers a field that actually exists on the
// table, rather than a hardcoded/fabricated list of CRM field names.
app.get('/leads/fields', (_req, res) => {
  res.json([
    { key: 'deal_value', label: 'Deal Value', type: 'numeric', description: 'Manually entered per-lead deal value' },
    { key: 'score', label: 'Lead Score', type: 'numeric', description: '0-100 fit score — not a dollar figure, but selectable for relative pipeline weighting' },
  ]);
});

app.put('/leads/:id/stage', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE leads SET stage=$1, updated_at=now() WHERE id=$2 AND organization_id=$3 RETURNING *`,
    [req.body.stage, req.params.id, req.user.organizationId]
  );
  res.json(rows[0] || {});
});

// Generic lead update — score + stage + deal_value + product_id, used by
// the Sales Agent's "Apply to CRM" action (random-forest fit score +
// AI-recommended stage get written back to the real record), the Pipeline
// Value "Set Up Deal Values" flow (see migrations/030_lead_deal_value.sql),
// and product assignment (see migrations/032_lead_product_id.sql).
// COALESCE so a caller that only sends one field doesn't null out the rest
// — EXCEPT product_id, which needs to support being explicitly *cleared*
// (unassigning a lead from a product), so it uses a sentinel: omit the key
// entirely to leave it untouched, send null/'' to clear it, send a uuid to
// set it. This mirrors ai-agent-backend's Ellipsis-sentinel PATCH pattern
// (SalesConfigRepository.upsert) since a bare COALESCE can't distinguish
// "not sent" from "sent as null" the way this field needs.
app.put('/leads/:id', canWrite, async (req, res) => {
  const { score, stage, deal_value } = req.body;
  const hasProductId = Object.prototype.hasOwnProperty.call(req.body, 'product_id');
  const productId = hasProductId ? (req.body.product_id || null) : undefined;
  const { rows } = await pool.query(
    `UPDATE leads SET score=COALESCE($1, score), stage=COALESCE($2, stage),
            deal_value=COALESCE($3, deal_value),
            product_id=CASE WHEN $4 THEN $5::uuid ELSE product_id END,
            updated_at=now()
      WHERE id=$6 AND organization_id=$7
      RETURNING *, (SELECT name FROM contacts WHERE id=leads.contact_id) as name,
                   (SELECT source FROM contacts WHERE id=leads.contact_id) as source,
                   (SELECT name FROM products WHERE id=leads.product_id) as product_name`,
    [score ?? null, stage ?? null, deal_value ?? null, hasProductId, productId, req.params.id, req.user.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'lead not found' });
  logAudit(req, 'lead.update', { id: req.params.id, score, stage, deal_value, product_id: hasProductId ? productId : undefined });
  res.json(rows[0]);
});

// Creates a lead from a name (e.g. the AI Sales Agent's "Save as Lead"
// action) — finds-or-creates the backing contact by name+source first,
// since these callers usually only have a free-text name/company, not an
// existing contact_id.
app.post('/leads', canWrite, async (req, res) => {
  const { name, company, email, phone, score, priority, stage, source, deal_value, product_id } = req.body;
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
    `INSERT INTO leads (organization_id, contact_id, stage, priority, score, deal_value, product_id)
     VALUES ($1,$2,COALESCE($3,'new'),COALESCE($4,'medium'),COALESCE($5,0),$6,$7)
     RETURNING *, (SELECT name FROM contacts WHERE id=$2) as name,
                  (SELECT source FROM contacts WHERE id=$2) as source,
                  (SELECT name FROM products WHERE id=$7) as product_name`,
    [req.user.organizationId, contact.id, stage, priority, score, deal_value ?? null, product_id || null]
  );
  logAudit(req, 'lead.create', { id: rows[0].id, contact_id: contact.id, score, deal_value, product_id });
  res.status(201).json(rows[0]);
});

const PORT = process.env.CONTACT_PORT || 4003;
app.listen(PORT, () => console.log(`contact-service on :${PORT}`));
