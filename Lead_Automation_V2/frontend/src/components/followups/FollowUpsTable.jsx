'use client';
import { Check, X, Trash2, Clock } from 'lucide-react';
import { useFollowUps, useUpdateFollowUp, useDeleteFollowUp } from '@/lib/queries/followUps';

const PRIORITY_TONE = {
  high:   'bg-red-50 text-red-700 ring-red-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low:    'bg-sky-50 text-sky-700 ring-sky-200',
};

const STATUS_TONE = {
  pending:   'bg-slate-100 text-slate-600',
  completed: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-slate-100 text-slate-400',
};

function isOverdue(row) {
  return row.status === 'pending' && new Date(row.due_at) < new Date();
}

/**
 * Table/view backing the Follow-ups page's four tabs (overdue / today /
 * upcoming / all — see app/app/follow-ups/page.jsx) plus manual status
 * changes (mark complete / cancel / delete). Row data comes straight from
 * contact-service's GET /follow-ups?bucket=… (services/contact-service/src/
 * followUpRoutes.js), already joined with the contact's name/phone and the
 * assigned agent's name.
 */
export default function FollowUpsTable({ bucket }) {
  const { data, isLoading, error } = useFollowUps(bucket);
  const update = useUpdateFollowUp();
  const del = useDeleteFollowUp();

  const rows = Array.isArray(data) ? data : [];

  if (isLoading) return <p className="text-sm text-slate-400 py-10 text-center">Loading…</p>;
  if (error) return <p className="text-sm text-red-500 py-10 text-center">{error.message}</p>;
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="p-4 rounded-2xl bg-slate-50 mb-3">
          <Clock size={22} className="text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-400">No follow-ups here</p>
        <p className="text-xs text-slate-300 mt-1">
          Add one manually, or enable auto-follow-ups on a Handoff node in the Automation Builder.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
            <th className="px-3 py-2 font-medium">Contact</th>
            <th className="px-3 py-2 font-medium">Due</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Disposition</th>
            <th className="px-3 py-2 font-medium">Assigned To</th>
            <th className="px-3 py-2 font-medium">Notes</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/60">
              <td className="px-3 py-2.5 align-top">
                <p className="font-medium text-slate-700">{row.contact_name || 'Unnamed'}</p>
                <p className="text-[11px] text-slate-400">{row.contact_phone || row.contact_email || '—'}</p>
              </td>
              <td className="px-3 py-2.5 align-top">
                <span className={isOverdue(row) ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                  {new Date(row.due_at).toLocaleString()}
                </span>
                {row.source === 'automation' && (
                  <p className="text-[10px] text-slate-400 mt-0.5">via automation handoff</p>
                )}
              </td>
              <td className="px-3 py-2.5 align-top">
                <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ring-1 ${PRIORITY_TONE[row.priority] || PRIORITY_TONE.medium}`}>
                  {row.priority}
                </span>
              </td>
              <td className="px-3 py-2.5 align-top text-slate-600">{row.disposition || '—'}</td>
              <td className="px-3 py-2.5 align-top text-slate-600">{row.assigned_to_name || '—'}</td>
              <td className="px-3 py-2.5 align-top text-slate-500 max-w-[220px] truncate" title={row.notes || ''}>{row.notes || '—'}</td>
              <td className="px-3 py-2.5 align-top">
                <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${STATUS_TONE[row.status] || STATUS_TONE.pending}`}>
                  {row.status}
                </span>
              </td>
              <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
                {row.status === 'pending' && (
                  <>
                    <button
                      onClick={() => update.mutate({ id: row.id, status: 'completed' })}
                      title="Mark complete"
                      className="text-slate-400 hover:text-emerald-600 p-1"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => update.mutate({ id: row.id, status: 'cancelled' })}
                      title="Cancel"
                      className="text-slate-400 hover:text-amber-600 p-1"
                    >
                      <X size={15} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => confirm('Delete this follow-up?') && del.mutate(row.id)}
                  title="Delete"
                  className="text-slate-400 hover:text-red-600 p-1"
                >
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
