// src/calendar.js
//
// Marketing Hub Calendar — thin aggregation layer.
//
// Standalone events (meeting / reminder) live in marketing_calendar_events.
// Campaign and broadcast events are DERIVED from marketing_campaigns
// (start_date / end_date) and marketing_broadcasts (scheduled_at / sent_at)
// so the calendar stays in sync with Tasks 4/5 without dual writes.
//
// Mounted behind `authenticate` in index.js. Tenant-scoped via
// organization_id + RLS (app.current_org).

const express = require('express');
const { pool } = require('@lead/shared');

const router = express.Router();

const STANDALONE_TYPES = new Set(['meeting', 'reminder']);

const DEFAULT_COLORS = {
  campaign: '#6366f1',
  webinar: '#f59e0b',
  broadcast: '#10b981',
  meeting: '#3b82f6',
  reminder: '#8b5cf6',
};

function toDateOnly(v) {
  if (!v) return null;
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v);
  // timestamptz / date string → YYYY-MM-DD
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function parseRange(from, to) {
  // Defaults: current calendar month if not provided
  const now = new Date();
  let fromDate = from;
  let toDate = to;
  if (!fromDate || !toDate) {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    fromDate = fromDate || `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    toDate = toDate || `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }
  return { fromDate, toDate };
}

// GET /marketing-hub/calendar?from=&to=
// Merges standalone rows + derived campaign/broadcast events in [from, to].
router.get('/marketing-hub/calendar', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { fromDate, toDate } = parseRange(req.query.from, req.query.to);

    // 1) Standalone meeting / reminder
    const { rows: standalone } = await pool.query(
      `SELECT id, title, type, date, color, created_at, updated_at,
              'standalone' AS source
         FROM marketing_calendar_events
        WHERE organization_id = $1
          AND date >= $2::date
          AND date <= $3::date
        ORDER BY date ASC, created_at ASC`,
      [orgId, fromDate, toDate]
    );

    // 2) Derived from campaigns: start_date and end_date (if distinct)
    const { rows: campaigns } = await pool.query(
      `SELECT id, name, start_date, end_date, platform, status
         FROM marketing_campaigns
        WHERE organization_id = $1
          AND (
            (start_date IS NOT NULL AND start_date >= $2::date AND start_date <= $3::date)
            OR (end_date IS NOT NULL AND end_date >= $2::date AND end_date <= $3::date)
          )`,
      [orgId, fromDate, toDate]
    );

    // 3) Derived from broadcasts: scheduled_at or sent_at (date portion)
    const { rows: broadcasts } = await pool.query(
      `SELECT id, name, channel, status, scheduled_at, sent_at
         FROM marketing_broadcasts
        WHERE organization_id = $1
          AND (
            (scheduled_at IS NOT NULL
              AND (scheduled_at AT TIME ZONE 'UTC')::date >= $2::date
              AND (scheduled_at AT TIME ZONE 'UTC')::date <= $3::date)
            OR (sent_at IS NOT NULL
              AND (sent_at AT TIME ZONE 'UTC')::date >= $2::date
              AND (sent_at AT TIME ZONE 'UTC')::date <= $3::date)
          )`,
      [orgId, fromDate, toDate]
    );

    const events = [];

    for (const row of standalone) {
      events.push({
        id: row.id,
        title: row.title,
        type: row.type,
        date: toDateOnly(row.date),
        color: row.color || DEFAULT_COLORS[row.type] || '#3b82f6',
        source: 'standalone',
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }

    for (const c of campaigns) {
      const start = toDateOnly(c.start_date);
      const end = toDateOnly(c.end_date);
      if (start && start >= fromDate && start <= toDate) {
        events.push({
          id: `campaign-start-${c.id}`,
          title: c.name,
          type: 'campaign',
          date: start,
          color: DEFAULT_COLORS.campaign,
          source: 'campaign',
          source_id: c.id,
          meta: { platform: c.platform, status: c.status, role: 'start' },
        });
      }
      if (end && end !== start && end >= fromDate && end <= toDate) {
        events.push({
          id: `campaign-end-${c.id}`,
          title: `${c.name} (end)`,
          type: 'campaign',
          date: end,
          color: DEFAULT_COLORS.campaign,
          source: 'campaign',
          source_id: c.id,
          meta: { platform: c.platform, status: c.status, role: 'end' },
        });
      }
    }

    for (const b of broadcasts) {
      const scheduled = toDateOnly(b.scheduled_at);
      const sent = toDateOnly(b.sent_at);
      // Prefer sent_at if present, else scheduled_at; emit both only if different days
      const dates = new Set();
      if (scheduled && scheduled >= fromDate && scheduled <= toDate) dates.add(scheduled);
      if (sent && sent >= fromDate && sent <= toDate) dates.add(sent);
      for (const d of dates) {
        const isSent = sent === d;
        events.push({
          id: `broadcast-${isSent ? 'sent' : 'scheduled'}-${b.id}`,
          title: b.name,
          type: 'broadcast',
          date: d,
          color: DEFAULT_COLORS.broadcast,
          source: 'broadcast',
          source_id: b.id,
          meta: {
            channel: b.channel,
            status: b.status,
            role: isSent ? 'sent' : 'scheduled',
          },
        });
      }
    }

    events.sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return (a.title || '').localeCompare(b.title || '');
    });

    res.json(events);
  } catch (err) {
    console.error('[marketing-hub] list calendar', err);
    res.status(500).json({ error: err.message || 'Failed to list calendar events' });
  }
});

// POST /marketing-hub/calendar — create standalone meeting/reminder
router.post('/marketing-hub/calendar', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const b = req.body || {};
    const title = b.title != null ? String(b.title).trim() : '';
    const type = b.type;
    const date = b.date;
    let color = b.color != null ? String(b.color).trim() : null;

    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!STANDALONE_TYPES.has(type)) {
      return res.status(400).json({
        error: "type must be 'meeting' or 'reminder' (campaign/broadcast events are derived)",
      });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    }
    if (!color) color = DEFAULT_COLORS[type] || '#3b82f6';
    // Basic hex validation
    if (!/^#[0-9a-fA-F]{3,8}$/.test(color)) {
      return res.status(400).json({ error: 'color must be a hex string, e.g. #3b82f6' });
    }

    const { rows } = await pool.query(
      `INSERT INTO marketing_calendar_events (organization_id, title, type, date, color)
       VALUES ($1, $2, $3, $4::date, $5)
       RETURNING id, organization_id, title, type, date, color, created_at, updated_at`,
      [orgId, title, type, date, color]
    );
    const row = rows[0];
    res.status(201).json({
      id: row.id,
      title: row.title,
      type: row.type,
      date: toDateOnly(row.date),
      color: row.color,
      source: 'standalone',
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  } catch (err) {
    console.error('[marketing-hub] create calendar event', err);
    res.status(500).json({ error: err.message || 'Failed to create calendar event' });
  }
});

// DELETE /marketing-hub/calendar/:id — only standalone events (not derived)
router.delete('/marketing-hub/calendar/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const id = req.params.id;
    // Derived ids look like campaign-start-UUID / broadcast-sent-UUID
    if (String(id).startsWith('campaign-') || String(id).startsWith('broadcast-')) {
      return res.status(400).json({
        error: 'Derived campaign/broadcast events cannot be deleted here; update the source record instead',
      });
    }

    const { rows } = await pool.query(
      `DELETE FROM marketing_calendar_events
        WHERE id = $1 AND organization_id = $2
        RETURNING id`,
      [id, orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Calendar event not found' });
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('[marketing-hub] delete calendar event', err);
    res.status(500).json({ error: err.message || 'Failed to delete calendar event' });
  }
});

module.exports = router;
