'use client';
/**
 * Marketing Calendar — a real month grid over /ai-agents/marketing/calendar/events.
 *
 * The month view queries only its own range. The `content_calendar` capability
 * can propose a cadence, which is then saved as real dated events rather than
 * left as chat output.
 */
import { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Trash2, Loader2 } from 'lucide-react';

import {
  useCalendarEvents, useCreateCalendarEvent, useDeleteCalendarEvent, EVENT_TYPES,
} from '@/lib/queries/marketing';
import { expandEvents, describeRRule } from '@/lib/rrule';
import { Card, Badge, Button, EmptyState, SectionTitle } from '../MarketingUI';
import {
  PageHeader, Toolbar, ToolButton, ToolSearch, StatsStrip, ViewSwitcher, SplitPane,
} from '../HubUI';
import { AIPanel, Modal, Field, Input, Textarea, Select, ErrorNote } from './Shared';

const TYPE_TONE = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.tone]));
const TYPE_LABEL = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.label]));
// Legend swatches, matching the reference's colour-coded month grid.
const TYPE_DOT = {
  campaign_launch: '#E11D48', broadcast: '#3B6EF0', meeting: '#64748B',
  webinar: '#059669', reminder: '#D97706', holiday: '#DC2626', content: '#FB7185',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthBounds(cursor) {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

/** Monday-first grid, padded to whole weeks. */
function buildGrid(cursor) {
  const { start, end } = monthBounds(cursor);
  const lead = (start.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= end.getDate(); d += 1) {
    cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function MarketingCalendar() {
  const [cursor, setCursor] = useState(() => new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [presetDate, setPresetDate] = useState(null);

  const { start, end } = monthBounds(cursor);
  const { data: stored = [], isLoading } = useCalendarEvents({
    start: start.toISOString(),
    end: end.toISOString(),
  });

  // `recurrence_rule` was stored and never expanded, so a weekly event showed
  // up exactly once. The backend now returns recurring rows regardless of how
  // far back they started; this projects them across the visible month.
  const events = useMemo(
    () => expandEvents(stored, start, end),
    [stored, start, end],
  );

  const create = useCreateCalendarEvent();
  const del = useDeleteCalendarEvent();

  const byDay = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      const d = new Date(e.start_at);
      (map[dayKey(d)] ||= []).push(e);
    });
    return map;
  }, [events]);

  const grid = useMemo(() => buildGrid(cursor), [cursor]);
  const today = new Date();

  const saveFromAI = async (out) => {
    const items = out?.calendar || out?.events || out?.schedule || out?.items || [];
    for (const it of items) {
      const when = it?.date || it?.publish_date || it?.start_at;
      if (!when) continue;
      const parsed = new Date(when);
      if (Number.isNaN(parsed.getTime())) continue;
      await create.mutateAsync({
        title: (it.title || it.topic || 'Content').slice(0, 300),
        event_type: 'content',
        description: it.description || it.notes || it.channel || null,
        start_at: parsed.toISOString(),
        all_day: true,
      });
    }
  };

  const openFor = (d) => {
    setPresetDate(d);
    setCreateOpen(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing Calendar"
        subtitle="Campaign launches, broadcasts, and content dates. Repeating events expand across the view."
        count={events.length}
      />

      <Toolbar
        right={
          <div className="flex items-center gap-1.5">
            <ToolButton icon={ChevronLeft}
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} />
            <span className="text-[13px] font-semibold text-[#0F1929] w-36 text-center"
                  style={{ fontFamily: "'Outfit', sans-serif" }}>
              {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <ToolButton icon={ChevronRight}
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} />
            <ToolButton onClick={() => setCursor(new Date())}>Today</ToolButton>
          </div>
        }
      >
        <Button variant="primary" icon={Plus} onClick={() => openFor(null)} className="!py-1.5 !px-3 !text-[12px]">
          New event
        </Button>
        <div className="flex items-center gap-2.5 ml-2 flex-wrap">
          {EVENT_TYPES.map((t) => (
            <span key={t.value} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-2 h-2 rounded-sm" style={{ background: TYPE_DOT[t.value] || '#CBD5E1' }} />
              {t.label}
            </span>
          ))}
        </div>
      </Toolbar>

      <StatsStrip
        items={[
          { label: 'This view', value: events.length, tone: 'violet' },
          { label: 'Repeating', value: stored.filter((e) => e.recurrence_rule).length, tone: 'blue' },
          { label: 'Campaign launches', value: events.filter((e) => e.event_type === 'campaign_launch').length, tone: 'green' },
          { label: 'Broadcasts', value: events.filter((e) => e.event_type === 'broadcast').length, tone: 'amber' },
          { label: 'Content', value: events.filter((e) => e.event_type === 'content').length, tone: 'slate' },
        ]}
      />

      <AIPanel
        capability="content_calendar"
        placeholder="e.g. Build a 6-week content calendar across blog, LinkedIn and WhatsApp"
        examples={['6-week content plan', 'Monthly cadence across channels']}
        onSave={saveFromAI}
        saving={create.isPending}
        saveLabel="Add to calendar"
        renderResult={(out) => {
          const items = out?.calendar || out?.events || out?.schedule || out?.items || [];
          if (!items.length) {
            return (
              <pre className="text-[11px] text-slate-600 whitespace-pre-wrap font-mono overflow-x-auto">
                {JSON.stringify(out, null, 2)}
              </pre>
            );
          }
          return (
            <ul className="space-y-1">
              {items.slice(0, 12).map((it, i) => (
                <li key={i} className="text-[12px] text-slate-700 flex gap-2">
                  <span className="font-mono text-[11px] text-slate-400 flex-shrink-0 w-24">
                    {it.date || it.publish_date || '—'}
                  </span>
                  <span>{it.title || it.topic}</span>
                </li>
              ))}
            </ul>
          );
        }}
      />

      <ErrorNote error={create.error || del.error} />

      <Card className="p-3">
        {isLoading ? (
          <div className="py-12 flex justify-center text-slate-300"><Loader2 size={20} className="animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-center py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {grid.map((d, i) => {
                if (!d) return <div key={i} className="min-h-[92px] rounded-xl bg-slate-50/40" />;
                const items = byDay[dayKey(d)] || [];
                const isToday = dayKey(d) === dayKey(today);
                return (
                  <button
                    key={i}
                    onClick={() => openFor(d)}
                    className={`min-h-[92px] rounded-xl border p-1.5 text-left transition-all hover:bg-slate-50 ${
                      isToday ? 'border-rose-300 bg-rose-50/40' : 'border-[#EEF1F6]'
                    }`}
                  >
                    <span className={`text-[11px] font-semibold ${isToday ? 'text-rose-600' : 'text-slate-400'}`}>
                      {d.getDate()}
                    </span>
                    <div className="space-y-1 mt-1">
                      {items.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          className="text-[10px] px-1.5 py-0.5 rounded truncate"
                          style={{
                            background: TYPE_TONE[e.event_type] === 'violet' ? '#FFF1F2' : '#F1F5F9',
                            color: TYPE_TONE[e.event_type] === 'violet' ? '#E11D48' : '#475569',
                          }}
                          title={e.title}
                        >
                          {e.title}
                        </div>
                      ))}
                      {items.length > 3 && (
                        <p className="text-[10px] text-slate-400 px-1.5">+{items.length - 3} more</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle title="This month" subtitle={`${events.length} event${events.length === 1 ? '' : 's'}`} />
        {!events.length ? (
          <EmptyState icon={CalendarIcon} title="Nothing scheduled this month" body="Click any day to add an event." />
        ) : (
          <div className="space-y-1.5">
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-[#EEF1F6] hover:bg-slate-50/60">
                <span className="font-mono text-[11px] text-slate-400 w-24 flex-shrink-0">
                  {new Date(e.start_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
                <span className="text-[13px] text-[#0F1929] truncate flex-1">
                  {e.title}
                  {e.recurrence_rule && (
                    <span className="text-[10px] text-rose-500 ml-1.5" title={e.recurrence_rule}>
                      ↻ {describeRRule(e.recurrence_rule)}
                    </span>
                  )}
                </span>
                <Badge tone={TYPE_TONE[e.event_type] || 'slate'}>{TYPE_LABEL[e.event_type] || e.event_type}</Badge>
                {/* A projected occurrence has a composite id and no row of its
                    own. Deleting "just this one" needs an exception concept the
                    schema doesn't have, so the whole series is the only honest
                    option — say so rather than silently deleting everything. */}
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={() => del.mutate(e.original_event_id || e.id)}
                  title={e.isOccurrence ? 'Deletes the whole repeating series' : 'Delete event'}
                  className="!px-2 !py-1.5"
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <NewEventModal open={createOpen} onClose={() => setCreateOpen(false)} presetDate={presetDate} />
    </div>
  );
}

function toLocalInput(d) {
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

function NewEventModal({ open, onClose, presetDate }) {
  const create = useCreateCalendarEvent();
  const [form, setForm] = useState({ title: '', event_type: 'content', description: '', start_at: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Re-seed the date when the modal is opened from a different day.
  const startValue = form.start_at || toLocalInput(presetDate);

  const submit = async () => {
    await create.mutateAsync({
      title: form.title.trim(),
      event_type: form.event_type,
      description: form.description.trim() || null,
      start_at: new Date(startValue).toISOString(),
    });
    setForm({ title: '', event_type: 'content', description: '', start_at: '' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New calendar event"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!form.title.trim() || !startValue || create.isPending}>
            {create.isPending ? 'Adding…' : 'Add'}
          </Button>
        </>
      }
    >
      <ErrorNote error={create.error} />
      <Field label="Title" required>
        <Input value={form.title} onChange={set('title')} placeholder="Publish pillar blog post" />
      </Field>
      <Field label="Type" required>
        <Select value={form.event_type} onChange={set('event_type')} options={EVENT_TYPES} />
      </Field>
      <Field label="When" required>
        <Input type="datetime-local" value={startValue} onChange={set('start_at')} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.description} onChange={set('description')} />
      </Field>
    </Modal>
  );
}
