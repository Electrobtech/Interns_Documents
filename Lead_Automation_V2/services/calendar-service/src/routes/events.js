/**
 * src/routes/events.js
 *
 * Everything that touches actual calendar events, all authenticated
 * (mounted at /calendar/events — see index.js). Backs three call sites in
 * the frontend:
 *   - contacts/leads: "Book a meeting" dialog -> POST /calendar/events
 *   - campaigns: schedule-send date picker checks GET /calendar/events/freebusy
 *     before letting a send land on a slot the team is already booked in
 *   - automation flow builder: a "delay" node in "specific date" mode can
 *     optionally also create a calendar reminder via POST /calendar/events
 *
 * calendar_events is a local mirror row per Google event (id, contact,
 * campaign, or automation-node linkage + the Google eventId) so the rest
 * of the app can list/display "what's on the calendar" without an extra
 * live Google API round trip on every page load.
 */

const express = require('express');
const { pool } = require('@lead/shared');
const tokenStore = require('../services/tokenStore');
const calendarApi = require('../services/calendarApi');

const router = express.Router();

function requireConnected(err, res) {
  if (err.status === 404) {
    return res.status(404).json({ error: 'Google Calendar is not connected for this organization.', code: 'not_connected' });
  }
  if (err.status === 401) {
    return res.status(401).json({ error: 'Google Calendar connection expired — please reconnect.', code: 'reauth_required' });
  }
  return null;
}

/**
 * Google Calendar is an OPTIONAL enhancement, not a prerequisite for keeping
 * a calendar. Connecting it adds real invites and reminders; without it the
 * org still gets a working internal calendar backed by calendar_events.
 * Returns a token when connected, or null when the org has not connected
 * (or its grant expired) so callers can degrade to local-only instead of
 * failing the whole write.
 */
async function optionalAccessToken(organizationId) {
  try {
    return await tokenStore.getValidAccessToken(organizationId);
  } catch (err) {
    if (err.status === 404 || err.status === 401) return null;
    throw err;
  }
}

/**
 * GET /calendar/events/freebusy?start=ISO&end=ISO
 * Returns Google's busy[] intervals for the org's primary calendar in the
 * given window, so the UI can grey out taken slots before the user picks
 * a meeting time or a campaign send date.
 */
router.get('/freebusy', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end query params (ISO datetimes) are required.' });
  try {
    const accessToken = await tokenStore.getValidAccessToken(req.user.organizationId);
    const data = await calendarApi.freeBusy(accessToken, { timeMin: start, timeMax: end });
    res.json({ busy: data.calendars?.primary?.busy || [] });
  } catch (err) {
    if (requireConnected(err, res)) return;
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /calendar/events?start=ISO&end=ISO
 * Local mirror rows joined with a live Google fetch isn't necessary here —
 * calendar_events is kept in sync at write-time (create/update/cancel
 * below), so this just reads Postgres.
 */
router.get('/', async (req, res) => {
  const { start, end } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM calendar_events
       WHERE organization_id=$1 AND status <> 'cancelled'
         AND ($2::timestamptz IS NULL OR starts_at >= $2)
         AND ($3::timestamptz IS NULL OR starts_at <= $3)
       ORDER BY starts_at ASC`,
      [req.user.organizationId, start || null, end || null]
    );
    res.json({ events: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /calendar/events
 * Body: { title, description?, startISO, endISO, attendeeEmails?, location?,
 *         contactId?, campaignId?, automationNodeId? }
 * Creates the event on Google Calendar first (source of truth for
 * invites/reminders actually firing), then mirrors it locally.
 */
router.post('/', async (req, res) => {
  const { title, description, startISO, endISO, attendeeEmails, location, contactId, campaignId, automationNodeId } = req.body;
  if (!title || !startISO || !endISO) {
    return res.status(400).json({ error: 'title, startISO, and endISO are required.' });
  }
  try {
    // Push to Google when connected so invites/reminders actually fire;
    // otherwise create the event locally only.
    const accessToken = await optionalAccessToken(req.user.organizationId);
    let gEvent = { id: null, htmlLink: null };
    if (accessToken) {
      gEvent = await calendarApi.createEvent(accessToken, {
        summary: title,
        description,
        startISO,
        endISO,
        attendeeEmails,
        location,
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO calendar_events
         (organization_id, google_event_id, title, description, starts_at, ends_at, location,
          attendee_emails, contact_id, campaign_id, automation_node_id, status, html_link, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'confirmed',$12,$13)
       RETURNING *`,
      [
        req.user.organizationId, gEvent.id, title, description || null, startISO, endISO, location || null,
        attendeeEmails && attendeeEmails.length ? attendeeEmails : null,
        contactId || null, campaignId || null, automationNodeId || null,
        gEvent.htmlLink || null, req.user.userId || null,
      ]
    );
    res.status(201).json({ event: rows[0] });
  } catch (err) {
    if (requireConnected(err, res)) return;
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** PATCH /calendar/events/:id — reschedule/edit. Same body fields as POST, all optional. */
router.patch('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM calendar_events WHERE id=$1 AND organization_id=$2`, [req.params.id, req.user.organizationId]);
    const local = rows[0];
    if (!local) return res.status(404).json({ error: 'Event not found.' });

    const { title, description, startISO, endISO, attendeeEmails, location } = req.body;
    // Only mirror the edit to Google for events that actually exist there.
    const accessToken = await optionalAccessToken(req.user.organizationId);
    if (accessToken && local.google_event_id) {
      await calendarApi.updateEvent(accessToken, {
        eventId: local.google_event_id,
        summary: title,
        description,
        startISO,
        endISO,
        attendeeEmails,
        location,
      });
    }

    const { rows: updated } = await pool.query(
      `UPDATE calendar_events SET
         title=COALESCE($3,title), description=COALESCE($4,description),
         starts_at=COALESCE($5,starts_at), ends_at=COALESCE($6,ends_at),
         location=COALESCE($7,location),
         attendee_emails=COALESCE($8,attendee_emails), updated_at=now()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, req.user.organizationId, title || null, description || null, startISO || null, endISO || null, location || null, attendeeEmails || null]
    );
    res.json({ event: updated[0] });
  } catch (err) {
    if (requireConnected(err, res)) return;
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** DELETE /calendar/events/:id — cancels on Google, marks local row cancelled (kept for history). */
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM calendar_events WHERE id=$1 AND organization_id=$2`, [req.params.id, req.user.organizationId]);
    const local = rows[0];
    if (!local) return res.status(404).json({ error: 'Event not found.' });

    const accessToken = await optionalAccessToken(req.user.organizationId);
    if (accessToken && local.google_event_id) {
      await calendarApi.deleteEvent(accessToken, { eventId: local.google_event_id }).catch((e) => {
        // A 410/404 from Google just means it was already deleted there
        // (e.g. removed by the attendee) — still fine to cancel our copy.
        if (e.status !== 502) throw e;
      });
    }

    await pool.query(`UPDATE calendar_events SET status='cancelled', updated_at=now() WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    if (requireConnected(err, res)) return;
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
