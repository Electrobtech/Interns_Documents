'use client';
import { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/calendar/DateTimePicker';
import { useCreateFollowUp, useTeamMembers } from '@/lib/queries/followUps';
import { useContacts } from '@/lib/queries/crm';

const DISPOSITIONS = ['Interested', 'No Response', 'Lost', 'Converted', 'Callback Requested'];
const PRIORITIES = ['low', 'medium', 'high'];

// text-xs (not the previous 11px) + slate-700 (not slate-500) — the old
// combo read as near-invisible pale lavender once it sat on top of the
// page bleeding through an unstyled dialog panel (see DialogContent below).
const LABEL = 'block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5';

/**
 * "Add Follow-up" row action for the Contacts and Leads tables
 * (frontend/src/app/app/contacts/page.jsx) — same pattern as
 * BookMeetingButton in components/calendar/BookMeetingDialog.jsx. Also
 * reused, without a preset `contact`, as the Follow-ups page's own
 * "Add Follow-up" button (see app/app/follow-ups/page.jsx), in which case
 * the dialog shows a contact picker instead of a fixed name.
 */
export function AddFollowUpButton({ contact, variant = 'icon' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={() => setOpen(true)}
          className="text-slate-400 hover:text-brand p-1"
          title="Add follow-up"
        >
          <CalendarClock size={15} />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand text-white px-3.5 py-2 text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
        >
          <CalendarClock className="h-3.5 w-3.5" /> Add Follow-up
        </button>
      )}
      {open && <AddFollowUpDialog contact={contact} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddFollowUpDialog({ contact, onClose }) {
  const create = useCreateFollowUp();
  const { data: contactsData, isLoading: contactsLoading } = useContacts();
  const { data: usersData } = useTeamMembers();

  const contacts = Array.isArray(contactsData) ? contactsData : [];
  const users = Array.isArray(usersData) ? usersData : [];

  const [contactId, setContactId] = useState(contact?.contact_id || contact?.id || '');
  const [when, setWhen] = useState('');
  const [priority, setPriority] = useState('medium');
  const [disposition, setDisposition] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    if (!contactId) { setError('Pick a lead/contact first.'); return; }
    if (!when) { setError('Pick a follow-up date & time first.'); return; }
    setError('');
    try {
      await create.mutateAsync({
        contact_id: contactId,
        due_at: new Date(when).toISOString(),
        priority,
        disposition: disposition || null,
        assigned_to: assignedTo || null,
        notes: notes || null,
      });
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to create the follow-up.');
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      {/* bg-white + shadow-xl are explicit here (not just relying on
          DialogContent's own bg-background) so this panel is guaranteed
          opaque even if the shared design-token wiring drifts again —
          this is exactly the "page bleeding through the modal" bug from
          the screenshot report. */}
      <DialogContent className="sm:max-w-md bg-white border border-slate-200 shadow-xl">
        <DialogHeader>
          <DialogTitle>Add follow-up</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!contact && (
            <div>
              <label className={LABEL}>Lead / Contact</label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)}
                className="input-premium h-[42px] border-slate-300">
                <option value="">{contactsLoading ? 'Loading…' : 'Select a lead or contact…'}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Unnamed'}{c.phone ? ` — ${c.phone}` : c.email ? ` — ${c.email}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {contact && (
            <p className="text-xs text-slate-500">
              For <span className="font-semibold text-slate-700">{contact.name || 'this contact'}</span>
              {contact.phone ? ` (${contact.phone})` : ''}
            </p>
          )}

          <div>
            <label className={LABEL}>Follow-up date & time</label>
            <DateTimePicker value={when} onChange={setWhen} minDate={new Date()}
              className="w-full h-[42px] rounded-xl border-slate-300 hover:border-slate-400" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Status / Disposition</label>
              <select value={disposition} onChange={(e) => setDisposition(e.target.value)}
                className="input-premium h-[42px] border-slate-300">
                <option value="">Not set</option>
                {DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Priority</label>
              {/* Same h-[42px] as the Status select alongside it, and
                  flex-1 so the three pills share the row evenly instead
                  of floating short and left-aligned next to a full-width
                  dropdown. */}
              <div className="flex h-[42px] gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 flex items-center justify-center text-xs font-semibold rounded-xl border capitalize transition-colors ${
                      priority === p
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className={LABEL}>Assigned Agent / Executive</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
              className="input-premium h-[42px] border-slate-300">
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL}>Notes / Reason for follow-up</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Asked to call back after checking with their team"
              className="input-premium border-slate-300 resize-none" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter className="flex-row justify-end items-center gap-3 pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} className="border-slate-300 text-slate-700 hover:bg-slate-50">
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending} className="bg-brand text-white hover:bg-brand-dark">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CalendarClock className="h-4 w-4 mr-1.5" />}
            Add follow-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
