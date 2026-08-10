'use client';
import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import MHModal from '../ui/MHModal';
import { useCalendarMonth, useCreateCalendarEvent, useDeleteCalendarEvent } from '@/lib/queries/marketingHub';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const LEGEND = [
  { type: 'campaign',  label: 'Campaign',  color: '#6366f1' },
  { type: 'broadcast', label: 'Broadcast', color: '#10b981' },
  { type: 'content',   label: 'Content',   color: '#8b5cf6' },
  { type: 'meeting',   label: 'Meeting',   color: '#3b82f6' },
  { type: 'deadline',  label: 'Deadline',  color: '#f59e0b' },
  { type: 'launch',    label: 'Launch',    color: '#ec4899' },
];
const colorFor = (type) => (LEGEND.find((l) => l.type === type) || LEGEND[0]).color;

function toISODate(d) { return d.toISOString().slice(0, 10); }

function AddEventModal({ onClose, toast, defaultDate }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('campaign');
  const [date, setDate] = useState(defaultDate);
  const create = useCreateCalendarEvent();

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await create.mutateAsync({ title: title.trim(), event_type: type, start_date: new Date(date).toISOString(), all_day: true });
      toast.show('Event added', 'success');
      onClose();
    } catch (err) {
      toast.show(err.message || 'Could not add event', 'error');
    }
  };

  return (
    <MHModal title="Add Event" onClose={onClose} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Event Title <span style={{ color: '#dc2626' }}>*</span></label>
          <input className="mh-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Product Launch Webinar" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Type</label>
            <select className="mh-input" value={type} onChange={e => setType(e.target.value)}>
              {LEGEND.map(l => <option key={l.type} value={l.type}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Date</label>
            <input className="mh-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <button className="mh-btn mh-btn-ghost" onClick={onClose}>Cancel</button>
        <button className="mh-btn mh-btn-primary" disabled={!title.trim() || create.isPending} style={{ opacity: title.trim() ? 1 : 0.5 }} onClick={submit}>
          {create.isPending ? 'Adding…' : 'Add Event'}
        </button>
      </div>
    </MHModal>
  );
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

export default function MHMarketingCalendar() {
  const toast = useMHToast();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const { data, isLoading } = useCalendarMonth(toISODate(cursor));
  const deleteEvent = useDeleteCalendarEvent();
  const events = data?.events || [];

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const days = getCalendarDays(year, month);

  const getEventsForDay = (day) => {
    if (!day) return [];
    return events.filter((e) => {
      const d = new Date(e.start_date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const goPrev = () => { setCursor(new Date(year, month - 1, 1)); setSelectedDay(null); };
  const goNext = () => { setCursor(new Date(year, month + 1, 1)); setSelectedDay(null); };

  const dateForDay = (day) => toISODate(new Date(year, month, day || 1));

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Marketing Calendar</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Plan and schedule all marketing activities in one view</p>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Add Event
        </button>
      </div>

      {/* Month Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="mh-btn mh-btn-ghost" style={{ padding: '6px 8px' }} onClick={goPrev}><ChevronLeft size={16} /></button>
          <span style={{ fontFamily: 'var(--mh-font-display)', fontSize: 18, fontWeight: 700, color: '#111827', minWidth: 160, textAlign: 'center' }}>{MONTH_NAMES[month]} {year}</span>
          <button className="mh-btn mh-btn-ghost" style={{ padding: '6px 8px' }} onClick={goNext}><ChevronRight size={16} /></button>
          <button className="mh-btn mh-btn-ghost" style={{ fontSize: 12 }} onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(null); }}>Today</button>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {LEGEND.map(l => (
            <div key={l.type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {isLoading && <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>}

      {/* Calendar Grid */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden', opacity: isLoading ? 0.6 : 1 }}>
        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb' }}>
          {DAYS_OF_WEEK.map(d => (
            <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f9fafb' }}>{d}</div>
          ))}
        </div>
        {/* Day Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = selectedDay === day;
            return (
              <div key={idx}
                onClick={() => day && setSelectedDay(isSelected ? null : day)}
                style={{
                  minHeight: 100, padding: '8px', borderRight: (idx + 1) % 7 !== 0 ? '1px solid #f3f4f6' : 'none',
                  borderBottom: idx < days.length - 7 ? '1px solid #f3f4f6' : 'none',
                  background: isSelected ? '#eef2ff' : day ? '' : '#fafafa',
                  cursor: day ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (day && !isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={e => { if (day && !isSelected) e.currentTarget.style.background = ''; }}>
                {day && (
                  <>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: isToday ? 700 : 500, fontSize: 13,
                      background: isToday ? '#6366f1' : 'transparent',
                      color: isToday ? '#fff' : '#374151', marginBottom: 4,
                    }}>{day}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {dayEvents.slice(0, 2).map(ev => (
                        <div key={ev.id}
                          title={ev.title}
                          style={{
                            background: colorFor(ev.event_type) + '20', color: colorFor(ev.event_type), borderLeft: `3px solid ${colorFor(ev.event_type)}`,
                            borderRadius: '0 4px 4px 0', padding: '2px 6px', fontSize: 10, fontWeight: 600,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5, cursor: 'pointer',
                          }}
                          onClick={e => { e.stopPropagation(); setSelectedDay(day); }}>
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, paddingLeft: 4 }}>+{dayEvents.length - 2} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Events */}
      {selectedDay && getEventsForDay(selectedDay).length > 0 && (
        <div style={{ marginTop: 20, background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Events on {MONTH_NAMES[month]} {selectedDay}, {year}
            </div>
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {getEventsForDay(selectedDay).map(ev => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: colorFor(ev.event_type) + '10', border: `1px solid ${colorFor(ev.event_type)}30` }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorFor(ev.event_type), flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ev.title}</div>
                  {ev.description && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{ev.description}</div>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: colorFor(ev.event_type) + '20', color: colorFor(ev.event_type), textTransform: 'capitalize' }}>{ev.event_type}</span>
                <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: '#dc2626' }}
                  onClick={() => deleteEvent.mutate(ev.id, { onSuccess: () => toast.show('Event removed', 'success') })}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && <AddEventModal toast={toast} defaultDate={dateForDay(selectedDay)} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
