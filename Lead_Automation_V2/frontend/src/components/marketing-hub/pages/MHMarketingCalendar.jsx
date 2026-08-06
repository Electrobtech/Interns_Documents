'use client';
import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { calendarEvents } from '../mockData';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAME = 'August 2025';
const MONTH_YEAR = { year: 2025, month: 7 }; // 0-indexed, August = 7

const LEGEND = [
  { type: 'campaign', label: 'Campaign', color: '#6366f1' },
  { type: 'webinar', label: 'Webinar', color: '#f59e0b' },
  { type: 'broadcast', label: 'Broadcast', color: '#10b981' },
  { type: 'meeting', label: 'Meeting', color: '#3b82f6' },
  { type: 'reminder', label: 'Reminder', color: '#8b5cf6' },
];

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
  const [selectedDay, setSelectedDay] = useState(null);
  const today = new Date();

  const days = getCalendarDays(MONTH_YEAR.year, MONTH_YEAR.month);

  const getEventsForDay = (day) => {
    if (!day) return [];
    const dateStr = `2025-08-${String(day).padStart(2, '0')}`;
    return calendarEvents.filter(e => e.date === dateStr);
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Marketing Calendar</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Plan and schedule all marketing activities in one view</p>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={() => toast.show('Opening event creator…', 'info')}>
          <Plus size={15} /> Add Event
        </button>
      </div>

      {/* Month Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="mh-btn mh-btn-ghost" style={{ padding: '6px 8px' }} onClick={() => toast.show('Previous month', 'info')}><ChevronLeft size={16} /></button>
          <span style={{ fontFamily: 'var(--mh-font-display)', fontSize: 18, fontWeight: 700, color: '#111827' }}>{MONTH_NAME}</span>
          <button className="mh-btn mh-btn-ghost" style={{ padding: '6px 8px' }} onClick={() => toast.show('Next month', 'info')}><ChevronRight size={16} /></button>
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

      {/* Calendar Grid */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
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
            const isToday = day === today.getDate() && today.getMonth() === MONTH_YEAR.month && today.getFullYear() === MONTH_YEAR.year;
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
                            background: ev.color + '20', color: ev.color, borderLeft: `3px solid ${ev.color}`,
                            borderRadius: '0 4px 4px 0', padding: '2px 6px', fontSize: 10, fontWeight: 600,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5, cursor: 'pointer',
                          }}
                          onClick={e => { e.stopPropagation(); toast.show(ev.title, 'info'); }}>
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
              Events on August {selectedDay}, 2025
            </div>
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {getEventsForDay(selectedDay).map(ev => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: ev.color + '10', border: `1px solid ${ev.color}30` }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1 }}>{ev.title}</div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: ev.color + '20', color: ev.color, textTransform: 'capitalize' }}>{ev.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
