'use client';
import { useState } from 'react';
import { CalendarPlus, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from './DateTimePicker';
import { useCalendarStatus, useCreateCalendarEvent } from '@/lib/queries/calendar';

const DEFAULT_DURATION_MINUTES = 30;

/**
 * "Book a meeting" row action for the Contacts and Leads tables
 * (frontend/src/app/app/contacts/page.jsx). Opens a small dialog to pick a
 * date/time (via the shared DateTimePicker) and creates the event on the
 * org's connected Google Calendar, inviting the contact if we have an
 * email on file.
 */
export function BookMeetingButton({ contact }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-slate-400 hover:text-brand p-1"
        title="Book a meeting"
      >
        <CalendarPlus size={15} />
      </button>
      {open && <BookMeetingDialog contact={contact} onClose={() => setOpen(false)} />}
    </>
  );
}

function BookMeetingDialog({ contact, onClose }) {
  const { data: status } = useCalendarStatus();
  const createEvent = useCreateCalendarEvent();
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState(DEFAULT_DURATION_MINUTES);
  const [title, setTitle] = useState(`Meeting with ${contact?.name || 'contact'}`);
  const [error, setError] = useState('');

  async function submit() {
    if (!when) { setError('Pick a date and time first.'); return; }
    setError('');
    const start = new Date(when);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    try {
      await createEvent.mutateAsync({
        title,
        description: `Booked from Contacts for ${contact?.name || 'a lead'}.`,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        attendeeEmails: contact?.email ? [contact.email] : [],
        contactId: contact?.id || contact?.contact_id || null,
      });
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to create the event.');
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book a meeting</DialogTitle>
        </DialogHeader>

        {!status?.connected && (
          <p className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-2">
            Google Calendar isn't connected yet — connect it under Settings → Integrations first, then come back to book this meeting.
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-premium" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date & time</label>
            <DateTimePicker value={when} onChange={setWhen} minDate={new Date()} />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Duration</label>
            <div className="flex gap-1.5">
              {[15, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration(m)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border ${duration === m ? 'bg-brand text-white border-brand' : 'border-slate-200 text-slate-500'}`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {contact?.email && (
            <p className="text-[11px] text-slate-400">{contact.name} ({contact.email}) will be invited automatically.</p>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={createEvent.isPending || !status?.connected}>
            {createEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CalendarPlus className="h-4 w-4 mr-1.5" />}
            Book meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
