'use client';
import { useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Trash2, Calendar } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import MHModal from '../ui/MHModal';
import { EmptyState } from './_shared';
import {
  useMarketingCalendar,
  useCreateMarketingCalendarEvent,
  useDeleteMarketingCalendarEvent,
} from '@/lib/queries/marketingHub';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LEGEND = [
  { type: 'campaign',  label: 'Campaign',  color: '#6366f1' },
  { type: 'broadcast', label: 'Broadcast', color: '#10b981' },
  { type: 'content',   label: 'Content',   color: '#8b5cf6' },
  { type: 'meeting',   label: 'Meeting',   color: '#3b82f6' },
  { type: 'deadline',  label: 'Deadline',  color: '#f59e0b' },
  { type: 'launch',    label: 'Launch',    color: '#ec4899' },
];
const colorFor = (type) => (LEGEND.find((l) => l.type === type) || LEGEND[0]).color;

const TYPE_COLORS = {
  campaign: '#6366f1',
  webinar: '#f59e0b',
  broadcast: '#10b981',
  meeting: '#3b82f6',
  reminder: '#8b5cf6',
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYMD(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function monthRange(year, month) {
  const from = toYMD(year, month, 1);
  const last = new Date(year, month + 1, 0).getDate();
  const to = toYMD(year, month, last);
  return { from, to };
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export default function MHMarketingCalendar() {
  const toast = useMHToast();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '',
    type: 'meeting',
    date: toYMD(today.getFullYear(), today.getMonth(), today.getDate()),
    color: TYPE_COLORS.meeting,
  });

  const { from, to } = useMemo(() => monthRange(viewYear, viewMonth), [viewYear, viewMonth]);
  const { data: events = [], isLoading, isError } = useMarketingCalendar(from, to);
  const createEvent = useCreateMarketingCalendarEvent();
  const deleteEvent = useDeleteMarketingCalendarEvent();

  const days = getCalendarDays(viewYear, viewMonth);

  const getEventsForDay = (day) => {
    if (!day) return [];
    const dateStr = toYMD(viewYear, viewMonth, day);
    return (events || []).filter((e) => e.date === dateStr);
  };

  const goPrev = () => {
    setSelectedDay(null);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    setSelectedDay(null);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const openCreate = (day) => {
    const date = day
      ? toYMD(viewYear, viewMonth, day)
      : toYMD(today.getFullYear(), today.getMonth(), today.getDate());
    setForm({
      title: '',
      type: 'meeting',
      date,
      color: TYPE_COLORS.meeting,
    });
    setShowCreate(true);
  };

  const handleCreate = () => {
    if (!form.title.trim()) {
      toast.show('Title is required', 'error');
      return;
    }
    createEvent.mutate(
      {
        title: form.title.trim(),
        type: form.type,
        date: form.date,
        color: form.color || TYPE_COLORS[form.type],
      },
      {
        onSuccess: () => {
          toast.show('Event created', 'success');
          setShowCreate(false);
        },
        onError: (err) => toast.show(err.message || 'Failed to create event', 'error'),
      }
    );
  };

  const handleDelete = (ev) => {
    if (ev.source !== 'standalone') {
      toast.show('Campaign/broadcast events are managed on their own pages', 'info');
      return;
    }
    deleteEvent.mutate(ev.id, {
      onSuccess: () => toast.show('Event deleted', 'success'),
      onError: (err) => toast.show(err.message || 'Failed to delete event', 'error'),
    });
  };

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>
            Marketing Calendar
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>
            Plan and schedule all marketing activities in one view
          </p>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={() => openCreate(selectedDay)}>
          <Plus size={15} /> Add Event
        </button>
      </div>

      {/* Month Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="mh-btn mh-btn-ghost" style={{ padding: '6px 8px' }} onClick={goPrev}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontFamily: 'var(--mh-font-display)', fontSize: 18, fontWeight: 700, color: '#111827' }}>
            {monthLabel(viewYear, viewMonth)}
          </span>
          <button className="mh-btn mh-btn-ghost" style={{ padding: '6px 8px' }} onClick={goNext}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {LEGEND.map((l) => (
            <div key={l.type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {isLoading && (
        <div style={{ padding: 24, fontSize: 13, color: '#6b7280' }}>Loading calendar…</div>
      )}
      {isError && (
        <div style={{ padding: 24, fontSize: 13, color: '#dc2626' }}>
          Couldn&apos;t load calendar events.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Calendar Grid */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--mh-border)',
              borderRadius: 14,
              boxShadow: 'var(--mh-shadow-sm)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb' }}>
              {DAYS_OF_WEEK.map((d) => (
                <div
                  key={d}
                  style={{
                    padding: '10px 0',
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    background: '#f9fafb',
                  }}
                >
                  {d}
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {days.map((day, idx) => {
                const dayEvents = getEventsForDay(day);
                const isToday =
                  day === today.getDate() &&
                  today.getMonth() === viewMonth &&
                  today.getFullYear() === viewYear;
                const isSelected = selectedDay === day;
                return (
                  <div
                    key={idx}
                    onClick={() => day && setSelectedDay(isSelected ? null : day)}
                    style={{
                      minHeight: 100,
                      padding: '8px',
                      borderRight: idx % 7 === 6 ? 'none' : '1px solid #f3f4f6',
                      borderBottom: '1px solid #f3f4f6',
                      background: isSelected ? '#eef2ff' : isToday ? '#f0fdf4' : '#fff',
                      cursor: day ? 'pointer' : 'default',
                      position: 'relative',
                    }}
                  >
                    {day && (
                      <>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: isToday || isSelected ? 700 : 500,
                            color: isToday ? '#059669' : isSelected ? '#4f46e5' : '#374151',
                            marginBottom: 4,
                          }}
                        >
                          {day}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {dayEvents.slice(0, 2).map((ev) => (
                            <div
                              key={ev.id}
                              title={ev.title}
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '2px 5px',
                                borderRadius: 4,
                                background: (ev.color || TYPE_COLORS[ev.type] || '#6366f1') + '22',
                                color: ev.color || TYPE_COLORS[ev.type] || '#6366f1',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {ev.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {!events.length && (
            <div style={{ marginTop: 20 }}>
              <EmptyState
                icon={Calendar}
                title="No events this month"
                desc="Add a meeting or reminder, or create campaigns and broadcasts — they appear here automatically."
              />
            </div>
          )}

          {/* Selected Day Events */}
          {selectedDay && selectedEvents.length > 0 && (
            <div
              style={{
                marginTop: 20,
                background: '#fff',
                border: '1px solid var(--mh-border)',
                borderRadius: 14,
                boxShadow: 'var(--mh-shadow-sm)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  Events on {monthLabel(viewYear, viewMonth).split(' ')[0]} {selectedDay}, {viewYear}
                </div>
              </div>
              <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedEvents.map((ev) => {
                  const color = ev.color || TYPE_COLORS[ev.type] || '#6366f1';
                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: color + '10',
                        border: `1px solid ${color}30`,
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1 }}>{ev.title}</div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 99,
                          background: color + '20',
                          color,
                          textTransform: 'capitalize',
                        }}
                      >
                        {ev.type}
                      </span>
                      {ev.source === 'standalone' && (
                        <button
                          className="mh-btn mh-btn-ghost"
                          style={{ padding: 4 }}
                          title="Delete event"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(ev);
                          }}
                          disabled={deleteEvent.isPending}
                        >
                          <Trash2 size={14} style={{ color: '#9ca3af' }} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <MHModal title="Add Calendar Event" onClose={() => setShowCreate(false)} width={440}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Title
              </label>
              <input
                className="mh-input"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Q3 Strategy Meeting"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Type
                </label>
                <select
                  className="mh-input"
                  value={form.type}
                  onChange={(e) => {
                    const t = e.target.value;
                    setForm((f) => ({ ...f, type: t, color: TYPE_COLORS[t] || f.color }));
                  }}
                  style={{ width: '100%' }}
                >
                  <option value="meeting">Meeting</option>
                  <option value="reminder">Reminder</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Date
                </label>
                <input
                  className="mh-input"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
              Campaign and broadcast events are derived automatically from the Campaigns and Broadcasts pages.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button className="mh-btn mh-btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="mh-btn mh-btn-primary"
                onClick={handleCreate}
                disabled={createEvent.isPending || !form.title.trim()}
              >
                {createEvent.isPending ? 'Saving…' : 'Create Event'}
              </button>
            </div>
          </div>
        </MHModal>
      )}

      {showAdd && <AddEventModal toast={toast} defaultDate={dateForDay(selectedDay)} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
