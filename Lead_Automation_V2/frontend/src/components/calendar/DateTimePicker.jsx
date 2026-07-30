'use client';
import { useMemo, useState } from 'react';
import { CalendarIcon, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { useCalendarStatus, useCheckFreeBusy } from '@/lib/queries/calendar';

/**
 * DateTimePicker — wherever the app previously used a plain
 * `<input type="datetime-local">` or a raw "number of days" field, this
 * swaps in a proper calendar popover (date) plus an hours/minutes field
 * (time), used across:
 *   - campaigns/page.jsx — "Schedule send"
 *   - contacts/page.jsx — "Book a meeting" dialog
 *   - automation/FlowBuilder.jsx — delay node "specific date" mode
 *
 * `value` / `onChange` carry a plain ISO 8601 string (or '' when unset) so
 * every call site can keep storing exactly what it stored before
 * (scheduled_at, startISO, etc.) — this component is pure UI, no new data
 * shape leaks into callers.
 *
 * When Google Calendar is connected for the org, hovering/selecting shows
 * a small "busy" indicator sourced from a live freebusy check so a person
 * doesn't schedule two things into the same slot without realizing.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Pick a date & time',
  minDate,
  showFreeBusy = true,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const { data: status } = useCalendarStatus();
  const freebusy = useCheckFreeBusy();
  const [busyRanges, setBusyRanges] = useState([]);

  const dateObj = value ? new Date(value) : undefined;
  const timeStr = value ? toLocalTimeInputValue(new Date(value)) : '09:00';

  function commit(nextDate, nextTime) {
    if (!nextDate) {
      onChange('');
      return;
    }
    const [h, m] = (nextTime || '09:00').split(':').map(Number);
    const combined = new Date(nextDate);
    combined.setHours(h || 0, m || 0, 0, 0);
    onChange(combined.toISOString());
  }

  async function handleMonthLoad(month) {
    if (!showFreeBusy || !status?.connected) return;
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59);
    try {
      const res = await freebusy.mutateAsync({ start: start.toISOString(), end: end.toISOString() });
      setBusyRanges(res.busy || []);
    } catch {
      // Freebusy is a nice-to-have hint, not a hard requirement — a failed
      // check (not connected, expired token, etc.) just means no shading.
      setBusyRanges([]);
    }
  }

  const busyDayKeys = useMemo(() => {
    const keys = new Set();
    for (const range of busyRanges) {
      const d = new Date(range.start);
      const endD = new Date(range.end);
      for (let cur = new Date(d); cur <= endD; cur.setDate(cur.getDate() + 1)) {
        keys.add(cur.toDateString());
      }
    }
    return keys;
  }, [busyRanges]);

  const label = value
    ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={`justify-start font-normal ${className}`}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateObj}
          onSelect={(d) => commit(d, timeStr)}
          onMonthChange={handleMonthLoad}
          disabled={minDate ? { before: minDate } : undefined}
          modifiers={{ busy: (d) => busyDayKeys.has(d.toDateString()) }}
          modifiersClassNames={{ busy: 'relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-amber-500' }}
        />
        <div className="flex items-center gap-2 border-t p-3">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="time"
            value={timeStr}
            onChange={(e) => commit(dateObj || new Date(), e.target.value)}
            className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
          />
        </div>
        {showFreeBusy && status?.connected && (
          <div className="px-3 pb-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" /> Already busy on your Google Calendar
          </div>
        )}
        {showFreeBusy && !status?.connected && (
          <div className="px-3 pb-3 text-[11px] text-muted-foreground">
            Connect Google Calendar in Settings → Integrations to see busy times here.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function toLocalTimeInputValue(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
