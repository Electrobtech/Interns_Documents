'use client';
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, AlertTriangle, User } from 'lucide-react';
import { useCalendarEvents } from '@/lib/queries/calendar';
import { useFollowUps } from '@/lib/queries/followUps';

/**
 * Task 2/5 (Support Agent — Calendar): a date-range-driven view merging
 * calendar-service's org events (GET /calendar/events, already wired via
 * useCalendarEvents — see calendar-service/src/routes/events.js) with
 * follow-ups coming due (GET /follow-ups?bucket=all, already wired via
 * useFollowUps), so the Support workspace's calendar shows the things a
 * support rep actually cares about — not just generic org meetings.
 *
 * Agenda-list layout (not a month grid): simpler to make genuinely
 * interactive (date-range change -> refetch) without pulling in a new
 * calendar-grid dependency, and no lightweight calendar UI library is
 * already installed in frontend/package.json to reuse.
 */

function startOfWeekISO(base = new Date()) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  return d;
}
function toDateInputValue(d) {
  return d.toISOString().slice(0, 10);
}
function fmtDay(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function CalendarTab() {
  const today = startOfWeekISO();
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const [start, setStart] = useState(toDateInputValue(today));
  const [end, setEnd] = useState(toDateInputValue(weekFromNow));

  const startISO = `${start}T00:00:00.000Z`;
  const endISO = `${end}T23:59:59.999Z`;

  const { data: eventsData, isLoading: eventsLoading, isError: eventsError, error: eventsErr } =
    useCalendarEvents({ start: startISO, end: endISO });
  const { data: followUpsData, isLoading: followUpsLoading } = useFollowUps('all');

  const events = Array.isArray(eventsData?.events) ? eventsData.events : [];
  const followUps = useMemo(() => {
    const rows = Array.isArray(followUpsData) ? followUpsData : [];
    return rows.filter((f) => f.due_at >= startISO && f.due_at <= endISO);
  }, [followUpsData, startISO, endISO]);

  const shiftRange = (days) => {
    const s = new Date(start); s.setDate(s.getDate() + days);
    const e = new Date(end); e.setDate(e.getDate() + days);
    setStart(toDateInputValue(s));
    setEnd(toDateInputValue(e));
  };

  const merged = useMemo(() => {
    const items = [
      ...events.map((e) => ({ kind: 'event', at: e.starts_at, key: `e:${e.id}`, data: e })),
      ...followUps.map((f) => ({ kind: 'followup', at: f.due_at, key: `f:${f.id}`, data: f })),
    ];
    return items.sort((a, b) => new Date(a.at) - new Date(b.at));
  }, [events, followUps]);

  const notConnected = eventsError && (eventsErr?.status === 404 || /not_connected/i.test(eventsErr?.message || ''));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
            <CalendarDays size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Calendar</h4>
            <p className="text-[11px] text-slate-400">Org events + follow-ups due, in range</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => shiftRange(-7)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Previous week">
            <ChevronLeft size={15} />
          </button>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input-premium text-xs py-1.5 px-2 w-36" />
          <span className="text-slate-400 text-xs">to</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input-premium text-xs py-1.5 px-2 w-36" />
          <button onClick={() => shiftRange(7)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Next week">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {notConnected && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertTriangle size={13} className="text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700">
            Google Calendar isn&apos;t connected for this org — showing follow-ups only. Org calendar events will
            appear here once it&apos;s connected.
          </p>
        </div>
      )}
      {eventsError && !notConnected && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={13} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600">{eventsErr?.message || 'Failed to load calendar events'}</p>
        </div>
      )}

      {(eventsLoading || followUpsLoading) ? (
        <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
      ) : merged.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-slate-400">Nothing in this range</p>
          <p className="text-xs text-slate-300 mt-1">Try widening the date range above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {merged.map((item) => (
            <div key={item.key} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className={`w-2 h-2 rounded-full shrink-0 ${item.kind === 'followup' ? 'bg-amber-400' : 'bg-violet-500'}`} />
              <div className="w-32 shrink-0 text-[11px] text-slate-400 flex items-center gap-1">
                <Clock size={10} />
                {fmtDay(item.at)}, {fmtTime(item.at)}
              </div>
              {item.kind === 'event' ? (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{item.data.title || 'Untitled event'}</p>
                  {item.data.location && <p className="text-[11px] text-slate-400">{item.data.location}</p>}
                </div>
              ) : (
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <User size={11} className="text-amber-500 shrink-0" />
                  <p className="text-sm font-medium text-slate-700 truncate">
                    Follow-up — {item.data.contact_name || 'Unknown contact'}
                  </p>
                  {item.data.priority && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold capitalize shrink-0">
                      {item.data.priority}
                    </span>
                  )}
                </div>
              )}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0
                ${item.kind === 'followup' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
                {item.kind === 'followup' ? 'Follow-up' : 'Event'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
