/**
 * src/products.js
 *
 * Products / offers — what the company actually sells. Owned by
 * campaign-service because an offer is a marketing object: campaigns promote
 * one, and performance is reported per offer.
 *
 * The Marketing Agent reads these (via ai-agent-backend's service client) so
 * generated content, SEO briefs, and broadcasts are grounded in real pricing,
 * value props, and objections instead of a free-text brief retyped each time.
 */

const express = require('express');
const { pool, requirePermission, logAudit } = require('@lead/shared');

const router = express.Router();
const canWrite = requirePermission('campaigns:write');

// Text[] columns must receive arrays; the UI sends either an array or a
// newline/comma separated string depending on the field, so normalise here
// rather than trusting the client.
function toArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** GET /products?status=active */
router.get('/products', async (req, res) => {
  try {
    const { status } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM products
        WHERE organization_id = $1
          AND ($2::text IS NULL OR status = $2)
        ORDER BY is_primary DESC, created_at DESC`,
      [req.user.organizationId, status || null]
    );
    res.json(rows);
  } catch (err) {
    console.error('[products] list failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /products/:id */
router.get('/products/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM products WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organizationId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /products */
router.post('/products', canWrite, async (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) {
    return res.status(400).json({ error: 'name is required.' });
  }
  // NOTE: deliberately NOT pool.connect() for this transaction — that
  // checks out a fresh, unscoped connection that bypasses the single
  // tenant-scoped connection shared/src/auth.js's `authenticate` already
  // pinned to this request (see shared/src/db.js's AsyncLocalStorage
  // comment). Confirmed live: with that pattern, RLS's WITH CHECK rejects
  // this INSERT with "new row violates row-level security policy" every
  // time, since the fresh connection never had app.current_org set.
  // pool.query() is already routed onto the pinned connection, so BEGIN/
  // COMMIT/ROLLBACK on it just extends the request's existing scope.
  try {
    await pool.query('BEGIN');
    // Only one primary offer per org — clear the old one first so the partial
    // unique index can never reject the insert.
    if (b.is_primary) {
      await pool.query(
        `UPDATE products SET is_primary = false, updated_at = now()
          WHERE organization_id = $1 AND is_primary`,
        [req.user.organizationId]
      );
    }
    const { rows } = await pool.query(
      `INSERT INTO products (
         organization_id, name, category, status, tagline, description,
         price_display, price_amount, currency, billing_period,
         value_props, target_segments, objections, differentiators, keywords,
         tone, claims_to_avoid, landing_url, is_primary, created_by
       ) VALUES ($1,$2,$3,COALESCE($4,'active'),$5,$6,$7,$8,COALESCE($9,'INR'),$10,
                 $11,$12,$13,$14,$15,$16,$17,$18,COALESCE($19,false),$20)
       RETURNING *`,
      [
        req.user.organizationId, String(b.name).trim(), b.category || null, b.status || null,
        b.tagline || null, b.description || null,
        b.price_display || null, toNumberOrNull(b.price_amount), b.currency || null, b.billing_period || null,
        toArray(b.value_props), toArray(b.target_segments), toArray(b.objections),
        toArray(b.differentiators), toArray(b.keywords),
        b.tone || null, toArray(b.claims_to_avoid), b.landing_url || null,
        !!b.is_primary, req.user.userId || null,
      ]
    );
    await pool.query('COMMIT');
    logAudit(req, 'product.create', { id: rows[0].id, name: rows[0].name });
    res.status(201).json(rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('[products] create failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /products/:id — every field optional */
router.patch('/products/:id', canWrite, async (req, res) => {
  const b = req.body || {};
  // See POST /products above for why this is pool.query('BEGIN') rather
  // than a pool.connect()'d client — same live-confirmed RLS bug.
  try {
    await pool.query('BEGIN');
    if (b.is_primary) {
      await pool.query(
        `UPDATE products SET is_primary = false, updated_at = now()
          WHERE organization_id = $1 AND is_primary AND id <> $2`,
        [req.user.organizationId, req.params.id]
      );
    }
    // COALESCE on scalars so an omitted field keeps its stored value; arrays
    // are replaced only when the caller actually sent the key, since an empty
    // array is a legitimate "clear this" instruction.
    const { rows } = await pool.query(
      `UPDATE products SET
         name            = COALESCE($3, name),
         category        = COALESCE($4, category),
         status          = COALESCE($5, status),
         tagline         = COALESCE($6, tagline),
         description     = COALESCE($7, description),
         price_display   = COALESCE($8, price_display),
         price_amount    = COALESCE($9, price_amount),
         currency        = COALESCE($10, currency),
         billing_period  = COALESCE($11, billing_period),
         value_props     = COALESCE($12, value_props),
         target_segments = COALESCE($13, target_segments),
         objections      = COALESCE($14, objections),
         differentiators = COALESCE($15, differentiators),
         keywords        = COALESCE($16, keywords),
         tone            = COALESCE($17, tone),
         claims_to_avoid = COALESCE($18, claims_to_avoid),
         landing_url     = COALESCE($19, landing_url),
         is_primary      = COALESCE($20, is_primary),
         updated_at      = now()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [
        req.params.id, req.user.organizationId,
        b.name ?? null, b.category ?? null, b.status ?? null, b.tagline ?? null, b.description ?? null,
        b.price_display ?? null, toNumberOrNull(b.price_amount), b.currency ?? null, b.billing_period ?? null,
        'value_props' in b ? toArray(b.value_props) : null,
        'target_segments' in b ? toArray(b.target_segments) : null,
        'objections' in b ? toArray(b.objections) : null,
        'differentiators' in b ? toArray(b.differentiators) : null,
        'keywords' in b ? toArray(b.keywords) : null,
        b.tone ?? null,
        'claims_to_avoid' in b ? toArray(b.claims_to_avoid) : null,
        b.landing_url ?? null,
        'is_primary' in b ? !!b.is_primary : null,
      ]
    );
    await pool.query('COMMIT');
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });
    logAudit(req, 'product.update', { id: req.params.id });
    res.json(rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('[products] update failed', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /products/:id — archives rather than deletes, so campaigns that
 *  referenced the offer keep a resolvable name in reporting. */
router.delete('/products/:id', canWrite, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE products SET status = 'archived', is_primary = false, updated_at = now()
        WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [req.params.id, req.user.organizationId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });
    logAudit(req, 'product.archive', { id: req.params.id });
    res.json({ ok: true, archived: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
