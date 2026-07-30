/**
 * src/services/calendarApi.js
 *
 * Thin wrapper around the Google Calendar v3 REST API — no googleapis SDK
 * dependency, same "plain fetch" approach as review-service/src/google
 * and email-service's gmailApi.js use for their Google calls.
 */

const BASE = 'https://www.googleapis.com/calendar/v3';

async function call(accessToken, path, { method = 'GET', body, query } = {}) {
  const url = new URL(`${BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Google Calendar API error (${res.status})`);
    err.status = res.status === 401 ? 401 : 502;
    throw err;
  }
  return data;
}

/** GET https://www.googleapis.com/oauth2/v2/userinfo — used right after token exchange to know which mailbox connected. */
async function getUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

function listCalendars(accessToken) {
  return call(accessToken, '/users/me/calendarList');
}

/**
 * FreeBusy query — used by the "Book a meeting" dialog to grey out
 * already-busy slots before the user picks a time, and by the automation
 * delay-node "specific date" mode to warn if the resolved date lands on a
 * day the org's calendar is already fully booked.
 */
function freeBusy(accessToken, { timeMin, timeMax, calendarId = 'primary' }) {
  return call(accessToken, '/freeBusy', {
    method: 'POST',
    body: { timeMin, timeMax, items: [{ id: calendarId }] },
  });
}

function createEvent(accessToken, { calendarId = 'primary', summary, description, startISO, endISO, attendeeEmails = [], location }) {
  return call(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    query: { sendUpdates: 'all' },
    body: {
      summary,
      description,
      location,
      start: { dateTime: startISO },
      end: { dateTime: endISO },
      attendees: attendeeEmails.filter(Boolean).map((email) => ({ email })),
      reminders: { useDefault: true },
    },
  });
}

function updateEvent(accessToken, { calendarId = 'primary', eventId, ...patch }) {
  const body = {};
  if (patch.summary != null) body.summary = patch.summary;
  if (patch.description != null) body.description = patch.description;
  if (patch.location != null) body.location = patch.location;
  if (patch.startISO) body.start = { dateTime: patch.startISO };
  if (patch.endISO) body.end = { dateTime: patch.endISO };
  if (patch.attendeeEmails) body.attendees = patch.attendeeEmails.filter(Boolean).map((email) => ({ email }));
  return call(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    query: { sendUpdates: 'all' },
    body,
  });
}

function deleteEvent(accessToken, { calendarId = 'primary', eventId }) {
  return call(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    query: { sendUpdates: 'all' },
  });
}

function listEvents(accessToken, { calendarId = 'primary', timeMin, timeMax }) {
  return call(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    query: { timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime' },
  });
}

module.exports = { getUserInfo, listCalendars, freeBusy, createEvent, updateEvent, deleteEvent, listEvents };
