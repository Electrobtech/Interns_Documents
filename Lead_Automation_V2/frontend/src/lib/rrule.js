/**
 * Minimal RFC 5545 RRULE expansion — the common subset only.
 *
 * `CalendarEvent.recurrence_rule` has always been stored and never expanded:
 * a marketer could set "weekly forever" and the month grid would show exactly
 * one event. A field that silently does nothing is worse than no field, since
 * it looks supported.
 *
 * Supports FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL, COUNT, UNTIL, and
 * BYDAY for weekly rules. Deliberately not a full RFC 5545 implementation —
 * pulling in a complete library for a month grid would be far more surface
 * area than the feature needs. Anything it cannot parse expands to the single
 * original occurrence, so an exotic rule degrades to today's behaviour rather
 * than throwing.
 */

const DAY_INDEX = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// A weekly-forever rule over a wide range would otherwise generate unbounded
// instances. The grid never shows more than a few months at a time.
const MAX_INSTANCES = 400;

export function parseRRule(rule) {
  if (!rule || typeof rule !== 'string') return null;
  const parts = {};
  rule
    .replace(/^RRULE:/i, '')
    .split(';')
    .forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k && v) parts[k.trim().toUpperCase()] = v.trim();
    });

  const freq = parts.FREQ?.toUpperCase();
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;

  return {
    freq,
    interval: Math.max(1, parseInt(parts.INTERVAL, 10) || 1),
    count: parts.COUNT ? parseInt(parts.COUNT, 10) : null,
    until: parts.UNTIL ? parseUntil(parts.UNTIL) : null,
    byDay: parts.BYDAY
      ? parts.BYDAY.split(',')
          .map((d) => DAY_INDEX[d.trim().slice(-2).toUpperCase()])
          .filter((d) => d !== undefined)
      : null,
  };
}

/** UNTIL is basic-format ISO 8601 (20261231T235959Z), not the extended form
 *  Date can parse directly. */
function parseUntil(v) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(v.trim());
  if (!m) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d, h = '23', mi = '59', s = '59'] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

/**
 * Expand one event into the occurrences falling inside [rangeStart, rangeEnd].
 *
 * Returns plain objects carrying the original event plus the shifted dates.
 * Generated instances are marked `isOccurrence` and given a composite id, so
 * the UI can tell a stored row from a projected one — editing a projection
 * needs an exception concept the schema does not have yet, and the UI must not
 * pretend otherwise.
 */
export function expandEvent(event, rangeStart, rangeEnd) {
  const start = new Date(event.start_at);
  if (Number.isNaN(start.getTime())) return [];

  const rule = parseRRule(event.recurrence_rule);
  if (!rule) {
    return withinRange(start, rangeStart, rangeEnd) ? [asOccurrence(event, start, 0)] : [];
  }

  const durationMs = event.end_at
    ? Math.max(0, new Date(event.end_at).getTime() - start.getTime())
    : 0;

  const out = [];
  let cursor = new Date(start);
  let emitted = 0;

  for (let guard = 0; guard < MAX_INSTANCES; guard += 1) {
    if (rule.count !== null && emitted >= rule.count) break;
    if (rule.until && cursor > rule.until) break;
    if (cursor > rangeEnd) break;

    // Weekly BYDAY fans one cursor week out to several weekdays.
    const candidates =
      rule.freq === 'WEEKLY' && rule.byDay?.length
        ? rule.byDay.map((d) => shiftToWeekday(cursor, d))
        : [new Date(cursor)];

    for (const c of candidates) {
      if (rule.until && c > rule.until) continue;
      if (c < start) continue;
      if (rule.count !== null && emitted >= rule.count) break;
      emitted += 1;
      if (withinRange(c, rangeStart, rangeEnd)) {
        out.push(asOccurrence(event, c, out.length, durationMs));
      }
    }

    cursor = advance(cursor, rule);
  }

  return out;
}

/** Expand a whole list, flattened and sorted — what a month grid renders. */
export function expandEvents(events, rangeStart, rangeEnd) {
  return (events || [])
    .flatMap((e) => expandEvent(e, rangeStart, rangeEnd))
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
}

function advance(date, rule) {
  const d = new Date(date);
  if (rule.freq === 'DAILY') d.setDate(d.getDate() + rule.interval);
  else if (rule.freq === 'WEEKLY') d.setDate(d.getDate() + 7 * rule.interval);
  else if (rule.freq === 'MONTHLY') d.setMonth(d.getMonth() + rule.interval);
  else if (rule.freq === 'YEARLY') d.setFullYear(d.getFullYear() + rule.interval);
  return d;
}

function shiftToWeekday(weekStart, weekday) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  return d;
}

function withinRange(d, start, end) {
  return d >= start && d <= end;
}

function asOccurrence(event, startDate, index, durationMs = 0) {
  if (index === 0 && !event.recurrence_rule) {
    return { ...event, isOccurrence: false };
  }
  return {
    ...event,
    // Composite id: React needs a stable key, and every projection of a
    // recurring event otherwise shares the stored row's id.
    id: `${event.id}::${startDate.toISOString()}`,
    original_event_id: event.id,
    isOccurrence: true,
    start_at: startDate.toISOString(),
    end_at: durationMs
      ? new Date(startDate.getTime() + durationMs).toISOString()
      : event.end_at,
  };
}

/** Human-readable summary for the event detail panel. */
export function describeRRule(rule) {
  const p = parseRRule(rule);
  if (!p) return null;
  const every =
    p.interval === 1
      ? { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' }[p.freq]
      : `Every ${p.interval} ${{ DAILY: 'days', WEEKLY: 'weeks', MONTHLY: 'months', YEARLY: 'years' }[p.freq]}`;
  const limit = p.count
    ? `, ${p.count} times`
    : p.until
      ? `, until ${p.until.toLocaleDateString()}`
      : '';
  return `${every}${limit}`;
}
