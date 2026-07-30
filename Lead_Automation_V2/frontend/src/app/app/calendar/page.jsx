'use client';
import { useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Loader2, Link2,
  AlertTriangle, CheckCircle2, Trash2, MapPin, Users, Unplug,
} from 'lucide-react';
import {
  useCalendarStatus, useCalendarConnectUrl, useDisconnectCalendar,
  useCalendarEvents, useCreateCalendarEvent, useCancelCalendarEvent,
} from '@/lib/queries/calendar';

/* Events are classified for colour purely from what the row already carries —
   a campaign-linked event is a campaign, a contact-linked one is a follow-up,
   anything else is a plain meeting. No extra column needed. */
const KINDS = {
  meeting:  { label: 'Meeting',   dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 border-violet-200' },
  followup: { label: 'Follow-up', dot: 'bg-amber-500',  chip: 'bg-amber-50 text-amber-700 border-amber-200'   },
  campaign: { label: 'Campaign',  dot: 'bg-fuchsia-500',chip: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
};

function kindOf(ev) {
  if (ev.campaign_id) return 'campaign';
  if (ev.contact_id) return 'followup';
  return 'meeting';
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* Monday-first grid of whole weeks covering the given month. */
function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // JS weeks start Sunday
  const start = new Date(year, month, 1 - offset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push(d);
    // stop once we've completed a week and passed the month end
    if (i % 7 === 6 && d.getMonth() !== month && d > first) break;
  }
  return cells;
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* datetime-local wants local wall time, not UTC — toISOString() would shift it. */
function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [composeFor, setComposeFor] = useState(null); // Date | null

  const grid = useMemo(() => buildGrid(cursor.y, cursor.m), [cursor]);
  const range = useMemo(() => ({
    start: new Date(grid[0].getFullYear(), grid[0].getMonth(), grid[0].getDate()).toISOString(),
    end: new Date(grid[grid.length - 1].getFullYear(), grid[grid.length - 1].getMonth(), grid[grid.length - 1].getDate(), 23, 59, 59).toISOString(),
  }), [grid]);

  const status = useCalendarStatus();
  const connectUrl = useCalendarConnectUrl();
  const disconnect = useDisconnectCalendar();
  const events = useCalendarEvents(range);
  const cancelEvent = useCancelCalendarEvent();

  const byDay = useMemo(() => {
    const map = {};
    for (const ev of events.data?.events ?? []) {
      const key = ymd(new Date(ev.starts_at));
      (map[key] ||= []).push(ev);
    }
    return map;
  }, [events.data]);

  const monthLabel = new Date(cursor.y, cursor.m, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  function shift(delta) {
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  async function handleConnect() {
    try {
      const { url } = await connectUrl.mutateAsync();
      if (url) window.location.href = url;
    } catch {
      /* surfaced via connectUrl.error below */
    }
  }

  const connected = status.data?.connected;

  return (
    <div className="p-6 lg:p-8 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-violet-600" /> Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Meetings, follow-ups, and campaign milestones for your organization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Google connect state */}
          {status.isLoading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> checking…
            </span>
          ) : connected ? (
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Google Calendar{status.data?.email ? ` · ${status.data.email}` : ''}
              <button
                type="button"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
                title="Disconnect Google Calendar"
                className="ml-1 inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-emerald-700/80 hover:bg-emerald-100 hover:text-emerald-900 disabled:opacity-50"
              >
                {disconnect.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connectUrl.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
            >
              {connectUrl.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Connect Google Calendar
            </button>
          )}

          <button
            type="button"
            onClick={() => setComposeFor(new Date())}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:-translate-y-0.5 hover:shadow-violet-500/40 transition-all"
          >
            <Plus className="h-4 w-4" /> Add Event
          </button>
        </div>
      </div>

      {/* Without Google the calendar still works — say so rather than failing silently. */}
      {!status.isLoading && !connected && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-slate-600">
            Events you add are saved to ConnectSphere only. Connect Google Calendar to also send real
            invites and reminders to attendees.
          </p>
        </div>
      )}
      {connectUrl.error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-xs text-red-700">{connectUrl.error.message}</p>
        </div>
      )}

      {/* Month toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="px-2 text-base font-bold text-slate-900 tabular-nums">{monthLabel}</p>
            <button type="button" onClick={() => shift(1)} aria-label="Next month"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
              className="ml-1 rounded-lg px-2 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-50">
              Today
            </button>
          </div>

          <div className="flex items-center gap-3">
            {Object.entries(KINDS).map(([k, cfg]) => (
              <span key={k} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} /> {cfg.label}
              </span>
            ))}
            {events.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300" />}
          </div>
        </div>

        {events.isError ? (
          <div className="flex items-center gap-2 px-4 py-10 justify-center">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <p className="text-sm text-red-600">{events.error.message}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {grid.map((d) => {
                const inMonth = d.getMonth() === cursor.m;
                const isToday = ymd(d) === ymd(today);
                const dayEvents = byDay[ymd(d)] ?? [];
                return (
                  <button
                    type="button"
                    key={d.toISOString()}
                    onClick={() => setComposeFor(d)}
                    title="Add an event on this day"
                    className={`group min-h-[104px] border-b border-r border-slate-100 p-2 text-left align-top transition-colors hover:bg-violet-50/50 ${inMonth ? 'bg-white' : 'bg-slate-50/40'}`}
                  >
                    <span className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums ${
                      isToday ? 'bg-violet-600 text-white'
                        : inMonth ? 'text-slate-700' : 'text-slate-300'
                    }`}>
                      {d.getDate()}
                    </span>

                    <span className="mt-1 block space-y-1">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span key={ev.id}
                          className={`block truncate rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${KINDS[kindOf(ev)].chip}`}>
                          {ev.title}
                        </span>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="block px-1 text-[10px] font-bold text-slate-400">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                      {!dayEvents.length && inMonth && (
                        <span className="hidden group-hover:flex items-center gap-1 px-1 text-[10px] font-bold text-violet-500">
                          <Plus className="h-2.5 w-2.5" /> add
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Agenda for the visible month — gives the events a place to be read and cancelled */}
      <UpcomingList
        events={events.data?.events ?? []}
        month={cursor.m}
        onCancel={(id) => cancelEvent.mutate(id)}
        cancellingId={cancelEvent.isPending ? cancelEvent.variables : null}
      />

      {composeFor && (
        <EventComposer
          day={composeFor}
          onClose={() => setComposeFor(null)}
        />
      )}
    </div>
  );
}

function UpcomingList({ events, month, onCancel, cancellingId }) {
  const rows = events
    .filter((e) => new Date(e.starts_at).getMonth() === month)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  if (!rows.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <p className="border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        This month · {rows.length} event{rows.length === 1 ? '' : 's'}
      </p>
      <div className="divide-y divide-slate-50">
        {rows.map((ev) => {
          const cfg = KINDS[kindOf(ev)];
          const start = new Date(ev.starts_at);
          return (
            <div key={ev.id} className="flex items-start gap-3 px-4 py-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{ev.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {start.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  {ev.location && <> · <MapPin className="inline h-3 w-3" /> {ev.location}</>}
                  {ev.attendee_emails?.length ? <> · <Users className="inline h-3 w-3" /> {ev.attendee_emails.length}</> : null}
                  {!ev.google_event_id && <span className="ml-1 text-slate-400">· local only</span>}
                </p>
              </div>
              {ev.html_link && (
                <a href={ev.html_link} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-50">
                  Google
                </a>
              )}
              <button type="button" onClick={() => onCancel(ev.id)} disabled={cancellingId === ev.id}
                title="Cancel event"
                className="shrink-0 grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                {cancellingId === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventComposer({ day, onClose }) {
  const create = useCreateCalendarEvent();

  // Default to the next clean hour on the clicked day, one hour long.
  const base = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.min(day.getHours() + 1, 23), 0);
  const [title, setTitle] = useState('');
  const [startISO, setStartISO] = useState(toLocalInput(base));
  const [endISO, setEndISO] = useState(toLocalInput(new Date(base.getTime() + 60 * 60 * 1000)));
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState('');
  const [description, setDescription] = useState('');
  const [localErr, setLocalErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLocalErr('');

    if (!title.trim()) return setLocalErr('Give the event a title.');
    const s = new Date(startISO);
    const en = new Date(endISO);
    if (Number.isNaN(s.getTime()) || Number.isNaN(en.getTime())) return setLocalErr('Pick a valid start and end time.');
    if (en <= s) return setLocalErr('End time must be after the start time.');

    const emails = attendees.split(',').map((x) => x.trim()).filter(Boolean);
    const bad = emails.filter((x) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
    if (bad.length) return setLocalErr(`Not a valid email: ${bad[0]}`);

    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        startISO: s.toISOString(),
        endISO: en.toISOString(),
        location: location.trim() || undefined,
        attendeeEmails: emails.length ? emails : undefined,
      });
      onClose();
    } catch {
      /* surfaced from create.error */
    }
  }

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-violet-400 focus:ring focus:ring-violet-100';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <p className="text-base font-bold text-slate-900">
            New event · {day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Title *</label>
            <input autoFocus className={field} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Demo call with Arjun M." />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Starts *</label>
              <input type="datetime-local" className={field} value={startISO} onChange={(e) => setStartISO(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Ends *</label>
              <input type="datetime-local" className={field} value={endISO} onChange={(e) => setEndISO(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Location</label>
            <input className={field} value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Google Meet / office / phone" />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Attendees <span className="font-medium normal-case text-slate-400">— comma separated</span>
            </label>
            <input className={field} value={attendees} onChange={(e) => setAttendees(e.target.value)}
              placeholder="arjun@acme.com, priya@acme.com" />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Notes</label>
            <textarea rows={2} className={field} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Agenda, context, links…" />
          </div>

          {(localErr || create.error) && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
              <p className="text-xs text-red-700">{localErr || create.error.message}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button type="button" onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" disabled={create.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {create.isPending ? 'Saving…' : 'Create event'}
          </button>
        </div>
      </form>
    </div>
  );
}
