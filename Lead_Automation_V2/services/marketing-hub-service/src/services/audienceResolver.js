/**
 * Cross-service call to contact-service for real audience resolution.
 * contact-service already owns the `contacts` table (GET /contacts?tag=,
 * GET /contacts/segments) — this service does not duplicate it. Destination
 * fallback chain mirrors campaign-service's own POST /campaigns/:id/send.
 */
const CONTACT_SERVICE_URL = process.env.CONTACT_SERVICE_URL || 'http://localhost:4003';

function destinationFor(channel, contact) {
  if (channel === 'whatsapp' || channel === 'sms') return contact.phone || contact.external_id || null;
  if (channel === 'email') return contact.email || null;
  return contact.external_id || null; // messenger, instagram, linkedin
}

/** Fetches every contact carrying any of `tags`, deduped by id. */
async function fetchTaggedContacts(tags, authHeader) {
  if (!tags?.length) return [];
  const byId = new Map();
  for (const tag of tags) {
    const resp = await fetch(`${CONTACT_SERVICE_URL}/contacts?tag=${encodeURIComponent(tag)}`, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    if (!resp.ok) throw new Error(`contact-service returned ${resp.status} for tag "${tag}"`);
    const rows = await resp.json();
    for (const c of rows) byId.set(c.id, c);
  }
  return [...byId.values()];
}

async function fetchTagOptions(authHeader) {
  const resp = await fetch(`${CONTACT_SERVICE_URL}/contacts/segments`, {
    headers: authHeader ? { Authorization: authHeader } : {},
  });
  if (!resp.ok) throw new Error(`contact-service returned ${resp.status} for /contacts/segments`);
  return resp.json(); // [{ tag, contact_count }]
}

/** Real, derived count — never a hardcoded/fabricated number. Excludes opted-out contacts. */
async function estimateSize(filter, authHeader) {
  const contacts = await fetchTaggedContacts(filter?.tags || [], authHeader);
  return contacts.filter((c) => !c.opted_out).length;
}

/** Resolves an audience's real, sendable recipient list for a given channel. Drops opted-out contacts and any with no usable destination for this channel. */
async function resolveRecipients(filter, channel, authHeader) {
  const contacts = await fetchTaggedContacts(filter?.tags || [], authHeader);
  return contacts
    .filter((c) => !c.opted_out)
    .map((c) => ({ contactId: c.id, destination: destinationFor(channel, c), displayName: c.name || null }))
    .filter((r) => !!r.destination);
}

module.exports = { estimateSize, resolveRecipients, fetchTagOptions };
