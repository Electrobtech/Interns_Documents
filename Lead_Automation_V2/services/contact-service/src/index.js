const express = require('express');
const cors = require('cors');
const { pool, authenticate, requirePermission, logAudit } = require('@lead/shared');
const importRoutes = require('./importRoutes');
const followUpRoutes = require('./followUpRoutes');
const sheetsRoutes = require('./sheetsRoutes');

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

// Google Sheets import preview (Support Agent "Import" tab) — public-CSV-
// export only, display-only, no CRM writes. See sheetsRoutes.js.
app.use(sheetsRoutes);

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
//
// ?created_after / ?created_before (ISO datetimes) — added for the Support
// Agent's Daily Report tab, which scopes "all leads" to a single day/week.
// Optional and additive: existing callers with no date params get exactly
// the same rows/order as before.
//
// Also left-joins in `source` (from contacts — leads itself has no source
// column) and a best-effort `assigned_to`/`last_activity` derived from the
// most recent conversation for that contact, since the leads table itself
// has neither column. Per this codebase's convention (see
// frontend/src/lib/queries/aiAgents.js's fmt() helper), a lead whose
// contact has no conversation yet gets NULL for these — the frontend
// renders that as "—" rather than fabricating a value.
app.get('/leads', async (req, res) => {
  const { created_after, created_before } = req.query;
  const where = ['l.organization_id = $1'];
  const params = [req.user.organizationId];

  if (created_after) {
    params.push(created_after);
    where.push(`l.created_at >= $${params.length}`);
  }
  if (created_before) {
    params.push(created_before);
    where.push(`l.created_at <= $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT l.*, c.name, c.source,
            conv.assigned_to_name, conv.last_activity
       FROM leads l
       JOIN contacts c ON c.id = l.contact_id
       LEFT JOIN LATERAL (
         SELECT u.name AS assigned_to_name, co.last_message_at AS last_activity
           FROM conversations co
           LEFT JOIN users u ON u.id = co.assigned_to
          WHERE co.contact_id = l.contact_id
          ORDER BY co.last_message_at DESC
          LIMIT 1
       ) conv ON true
      WHERE ${where.join(' AND ')}
      ORDER BY l.created_at DESC`,
    params
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

// Generic lead update — score + stage + deal_value, used by the Sales
// Agent's "Apply to CRM" action (random-forest fit score + AI-recommended
// stage get written back to the real record) and by the Pipeline Value
// "Set Up Deal Values" flow (see migrations/030_lead_deal_value.sql).
// COALESCE so a caller that only sends one field doesn't null out the rest.
app.put('/leads/:id', canWrite, async (req, res) => {
  const { score, stage, deal_value, course, temperature, contact_status, category } = req.body;
  const { rows } = await pool.query(
    `UPDATE leads SET score=COALESCE($1, score), stage=COALESCE($2, stage),
            deal_value=COALESCE($3, deal_value), course=COALESCE($4, course),
            temperature=COALESCE($5, temperature), contact_status=COALESCE($6, contact_status),
            category=COALESCE($7, category), updated_at=now()
      WHERE id=$8 AND organization_id=$9
      RETURNING *, (SELECT name FROM contacts WHERE id=leads.contact_id) as name,
                   (SELECT source FROM contacts WHERE id=leads.contact_id) as source,
                   (SELECT phone FROM contacts WHERE id=leads.contact_id) as phone`,
    [score ?? null, stage ?? null, deal_value ?? null, course ?? null, temperature ?? null,
     contact_status ?? null, category ?? null, req.params.id, req.user.organizationId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'lead not found' });
  logAudit(req, 'lead.update', { id: req.params.id, score, stage, deal_value, course, temperature, contact_status, category });
  res.json(rows[0]);
});

// Creates a lead from a name (e.g. the AI Sales Agent's "Save as Lead"
// action) — finds-or-creates the backing contact by name+source first,
// since these callers usually only have a free-text name/company, not an
// existing contact_id.
app.post('/leads', canWrite, async (req, res) => {
  const {
    name, company, email, phone, mobile, score, priority, stage, source, deal_value,
    // Leads/CRM page fields (see migrations/032_lead_crm_fields.sql). `mobile`
    // is accepted as an alias for `phone` since that's what the page's
    // "Add Lead" form and mock dataset both call it.
    course, temperature, contact_status, category,
  } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const contactPhone = phone || mobile || null;
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
      [req.user.organizationId, name, email || null, contactPhone, leadSource, company ? `Company: ${company}` : null]
    );
    contact = created[0];
    logAudit(req, 'contact.create', { id: contact.id, name });
  }

  const { rows } = await pool.query(
    `INSERT INTO leads (organization_id, contact_id, stage, priority, score, deal_value,
                         course, temperature, contact_status, category)
     VALUES ($1,$2,COALESCE($3,'new'),COALESCE($4,'medium'),COALESCE($5,0),$6,
             $7,COALESCE($8,'warm'),COALESCE($9,'no response'),COALESCE($10,'active'))
     RETURNING *, (SELECT name FROM contacts WHERE id=$2) as name,
                  (SELECT source FROM contacts WHERE id=$2) as source,
                  (SELECT phone FROM contacts WHERE id=$2) as phone`,
    [req.user.organizationId, contact.id, stage, priority, score, deal_value ?? null,
     course || null, temperature, contact_status, category]
  );
  logAudit(req, 'lead.create', { id: rows[0].id, contact_id: contact.id, score, deal_value });
  res.status(201).json(rows[0]);
});

const PORT = process.env.CONTACT_PORT || 4003;
app.listen(PORT, () => console.log(`contact-service on :${PORT}`));
