/**
 * src/templates.js
 *
 * Message Templates — the Template Creation module surfaced at
 * sidebar > Automation > Templates (frontend/src/app/app/campaigns/templates).
 * Owned by campaign-service, same reasoning as products.js: a template is a
 * marketing object the Bulk Campaign builder consumes, so it lives next to
 * `campaigns` rather than behind a new service.
 *
 * GET /templates?channel=WHATSAPP&status=APPROVED is the contract the
 * existing Bulk Campaign screen's template picker uses to populate its
 * dropdown (see frontend/src/lib/queries/templates.js useTemplatesForCampaign).
 */

const express = require('express');
const { pool, requirePermission, logAudit } = require('@lead/shared');

const router = express.Router();
const canWrite = requirePermission('campaigns:write');

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const HEADER_TYPES = ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const BUTTON_TYPES = ['QUICK_REPLY', 'PHONE_NUMBER', 'URL'];
const FOOTER_MAX = 60;

// Mirrors the "Auto-slugified lowercase with underscores" requirement —
// applied server-side too since the client field is easy to bypass, and
// Meta's own template-name rules are exactly this shape.
function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 512);
}

function toChannelArray(value) {
  const allowed = new Set(['WHATSAPP', 'RCS', 'SMS', 'EMAIL']);
  const arr = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
  const cleaned = arr.map((v) => String(v).trim().toUpperCase()).filter((v) => allowed.has(v));
  return cleaned.length ? [...new Set(cleaned)] : ['WHATSAPP'];
}

function normalizeButtons(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((b) => b && BUTTON_TYPES.includes(b.type) && b.text)
    .map((b) => ({
      type: b.type,
      text: String(b.text).slice(0, 25),
      value: b.value != null ? String(b.value).slice(0, 2000) : undefined,
    }));
}

function validateBody(b) {
  if (!b.name || !String(b.name).trim()) return 'name is required.';
  if (b.category && !CATEGORIES.includes(b.category)) return `category must be one of ${CATEGORIES.join(', ')}.`;
  if (b.header_type && !HEADER_TYPES.includes(b.header_type)) return `header_type must be one of ${HEADER_TYPES.join(', ')}.`;
  if (b.header_type === 'IMAGE' || b.header_type === 'VIDEO' || b.header_type === 'DOCUMENT') {
    if (!b.header_media_url) return 'header_media_url is required for a media header.';
  }
  if (b.footer && String(b.footer).length > FOOTER_MAX) return `footer must be ${FOOTER_MAX} characters or fewer.`;
  if (!b.body || !String(b.body).trim()) return 'body is required.';
  return null;
}

/** GET /templates?channel=WHATSAPP&status=APPROVED&search=foo */
router.get('/templates', async (req, res) => {
  try {
    const { channel, status, search } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM message_templates
        WHERE organization_id = $1
          AND ($2::text IS NULL OR $2 = ANY(channels))
          AND ($3::text IS NULL OR status = $3)
          AND ($4::text IS NULL OR name ILIKE '%' || $4 || '%')
        ORDER BY updated_at DESC`,
      [req.user.organizationId, channel ? String(channel).toUpperCase() : null, status ? String(status).toUpperCase() : null, search || null]
    );
    res.json(rows);
  } catch (err) {
    console.error('[templates] list failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /templates/:id */
router.get('/templates/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM message_templates WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organizationId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /templates */
router.post('/templates', canWrite, async (req, res) => {
  const b = req.body || {};
  const error = validateBody(b);
  if (error) return res.status(400).json({ error });

  try {
    const { rows } = await pool.query(
      `INSERT INTO message_templates (
         organization_id, name, category, language, channels, status,
         header_type, header_text, header_media_url,
         body, body_variables, footer, buttons, created_by
       ) VALUES ($1,$2,COALESCE($3,'MARKETING'),COALESCE($4,'en_US'),$5,'PENDING',
                 COALESCE($6,'NONE'),$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        req.user.organizationId, slugify(b.name), b.category || null, b.language || null,
        toChannelArray(b.channels),
        b.header_type || null, b.header_text || null, b.header_media_url || null,
        String(b.body).trim(), JSON.stringify(b.body_variables || {}),
        b.footer || null, JSON.stringify(normalizeButtons(b.buttons)),
        req.user.userId || null,
      ]
    );
    logAudit(req, 'template.create', { id: rows[0].id, name: rows[0].name });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[templates] create failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /templates/:id — every field optional. Editing an APPROVED
 *  template drops it back to PENDING, same as Meta's own review model: an
 *  approved template's content is frozen, changing it requires re-review. */
router.patch('/templates/:id', canWrite, async (req, res) => {
  const b = req.body || {};
  if (b.category && !CATEGORIES.includes(b.category)) {
    return res.status(400).json({ error: `category must be one of ${CATEGORIES.join(', ')}.` });
  }
  if (b.footer && String(b.footer).length > FOOTER_MAX) {
    return res.status(400).json({ error: `footer must be ${FOOTER_MAX} characters or fewer.` });
  }
  const contentChanged = ['header_type', 'header_text', 'header_media_url', 'body', 'footer', 'buttons']
    .some((k) => k in b);

  try {
    const { rows } = await pool.query(
      `UPDATE message_templates SET
         name              = COALESCE($3, name),
         category          = COALESCE($4, category),
         language          = COALESCE($5, language),
         channels          = COALESCE($6, channels),
         header_type       = COALESCE($7, header_type),
         header_text       = COALESCE($8, header_text),
         header_media_url  = COALESCE($9, header_media_url),
         body              = COALESCE($10, body),
         body_variables    = COALESCE($11, body_variables),
         footer            = COALESCE($12, footer),
         buttons           = COALESCE($13, buttons),
         status            = CASE WHEN $14 AND status = 'APPROVED' THEN 'PENDING' ELSE status END,
         updated_at        = now()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [
        req.params.id, req.user.organizationId,
        b.name ? slugify(b.name) : null, b.category || null, b.language || null,
        'channels' in b ? toChannelArray(b.channels) : null,
        b.header_type || null, b.header_text ?? null, b.header_media_url ?? null,
        b.body ? String(b.body).trim() : null,
        'body_variables' in b ? JSON.stringify(b.body_variables || {}) : null,
        b.footer ?? null,
        'buttons' in b ? JSON.stringify(normalizeButtons(b.buttons)) : null,
        contentChanged,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found.' });
    logAudit(req, 'template.update', { id: req.params.id });
    res.json(rows[0]);
  } catch (err) {
    console.error('[templates] update failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /templates/:id/decision — { decision: 'APPROVED'|'REJECTED' }
 *  Stand-in for the real Meta review webhook until that sync exists —
 *  lets the Template Dashboard exercise the same status lifecycle by hand. */
router.post('/templates/:id/decision', canWrite, async (req, res) => {
  const decision = String(req.body?.decision || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'APPROVED' or 'REJECTED'." });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE message_templates SET status = $3, updated_at = now()
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [req.params.id, req.user.organizationId, decision]
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found.' });
    logAudit(req, `template.${decision.toLowerCase()}`, { id: req.params.id });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /templates/:id/clone — copies a template as a new PENDING draft,
 *  named `<original>_copy` (de-duplicated), matching the screenshot's
 *  Clone button in the template detail panel. */
router.post('/templates/:id/clone', canWrite, async (req, res) => {
  try {
    const { rows: src } = await pool.query(
      `SELECT * FROM message_templates WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organizationId]
    );
    if (!src.length) return res.status(404).json({ error: 'Template not found.' });
    const t = src[0];

    let baseName = `${t.name}_copy`;
    let name = baseName;
    for (let n = 2; ; n++) {
      const { rows: clash } = await pool.query(
        `SELECT 1 FROM message_templates WHERE organization_id = $1 AND name = $2`,
        [req.user.organizationId, name]
      );
      if (!clash.length) break;
      name = `${baseName}_${n}`;
    }

    const { rows } = await pool.query(
      `INSERT INTO message_templates (
         organization_id, name, category, language, channels, status,
         header_type, header_text, header_media_url,
         body, body_variables, footer, buttons, created_by
       ) VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        req.user.organizationId, name, t.category, t.language, t.channels,
        t.header_type, t.header_text, t.header_media_url,
        t.body, t.body_variables, t.footer, t.buttons,
        req.user.userId || null,
      ]
    );
    logAudit(req, 'template.clone', { sourceId: t.id, id: rows[0].id, name });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[templates] clone failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /templates/:id */
router.delete('/templates/:id', canWrite, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM message_templates WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [req.params.id, req.user.organizationId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found.' });
    logAudit(req, 'template.delete', { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
