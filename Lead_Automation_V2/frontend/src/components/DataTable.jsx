'use client';
import { Pencil, Trash2 } from 'lucide-react';

const emerald = 'bg-emerald-50 text-emerald-600';
const amber = 'bg-amber-50 text-amber-600';
const slate = 'bg-slate-100 text-slate-500';

function badgeClass(v) {
  const s = String(v || '').toLowerCase();
  if (['open', 'active', 'connected', 'sent', 'paid', 'completed', 'won', 'online', 'true'].includes(s)) return emerald;
  if (['pending', 'draft', 'scheduled', 'away', 'new'].includes(s)) return amber;
  return slate;
}

function fmt(value, col) {
  if (value == null || value === '') return <span className="text-slate-300">—</span>;
  if (col.type === 'datetime' || col.type === 'date') {
    const d = new Date(value);
    return isNaN(d) ? String(value) : d.toLocaleString();
  }
  if (col.type === 'bool') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ') || <span className="text-slate-300">—</span>;
  if (typeof value === 'object') return <code className="text-[11px]">{JSON.stringify(value)}</code>;
  return String(value);
}

export default function DataTable({ columns, rows, loading, onEdit, onDelete, readOnly, idKey = 'id', rowActions }) {
  if (loading) return <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>;
  if (!rows.length) return <p className="text-sm text-slate-400 py-8 text-center">No records yet.</p>;

  const showActionsCol = !readOnly || !!rowActions;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
            {columns.map((c) => <th key={c.key} className="px-3 py-2 font-medium whitespace-nowrap">{c.label}</th>)}
            {showActionsCol && <th className="px-3 py-2 font-medium text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row) => (
            <tr key={row[idKey]} className="hover:bg-slate-50/60">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2.5 align-top">
                  {c.badge
                    ? <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${badgeClass(row[c.key])}`}>{row[c.key] || '—'}</span>
                    : <span className="text-slate-700">{fmt(row[c.key], c)}</span>}
                </td>
              ))}
              {showActionsCol && (
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {/* Custom per-resource action (e.g. contacts/leads "Book a meeting") — shown
                      independent of readOnly, since booking a meeting isn't editing the record. */}
                  {rowActions && rowActions(row)}
                  {!readOnly && (
                    <>
                      <button onClick={() => onEdit(row)} className="text-slate-400 hover:text-brand p-1" title="Edit"><Pencil size={15} /></button>
                      <button onClick={() => onDelete(row)} className="text-slate-400 hover:text-red-500 p-1" title="Delete"><Trash2 size={15} /></button>
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
