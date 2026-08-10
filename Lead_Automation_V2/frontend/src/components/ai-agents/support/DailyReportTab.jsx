'use client';
import { useMemo, useState } from 'react';
import { FileBarChart2, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { useLeads } from '@/lib/queries/crm';

/**
 * Task 4/5 (Support Agent — Daily Report): a read-only, day-scoped table
 * of all leads — "what came in and what's the status, for a given day".
 * Not a Leads/CRM editing screen (no full Leads management page exists
 * elsewhere in frontend/src/app to duplicate — checked before building).
 *
 * Server-side date filtering via GET /leads?created_after&created_before
 * (added to services/contact-service/src/index.js, optional/backward-
 * compatible). `assigned_to`/`last_activity` are best-effort joins added
 * server-side from the contact's most recent conversation — the `leads`
 * table itself has neither column — and render '—' when a contact has no
 * conversation yet, rather than fabricating a value.
 */

const COLUMNS = [
  { key: 'name', label: 'Contact' },
  { key: 'source', label: 'Source' },
  { key: 'stage', label: 'Stage' },
  { key: 'score', label: 'Score' },
  { key: 'created_at', label: 'Created' },
  { key: 'assigned_to_name', label: 'Assigned To' },
  { key: 'last_activity', label: 'Last Activity' },
];

const STAGE_BADGE = {
  new: 'bg-blue-50 text-blue-700',
  qualified: 'bg-violet-50 text-violet-700',
  active: 'bg-amber-50 text-amber-700',
  won: 'bg-emerald-50 text-emerald-700',
  lost: 'bg-slate-100 text-slate-500',
};

function dayBounds(dateStr) {
  return {
    created_after: `${dateStr}T00:00:00.000Z`,
    created_before: `${dateStr}T23:59:59.999Z`,
  };
}
function weekBounds() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { created_after: start.toISOString(), created_before: end.toISOString() };
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyReportTab() {
  const [scope, setScope] = useState('today'); // 'today' | 'week' | 'day'
  const [day, setDay] = useState(todayStr());
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });

  const range = scope === 'week' ? weekBounds() : dayBounds(scope === 'today' ? todayStr() : day);
  const { data, isLoading, isError, error } = useLeads(range);
  const leads = Array.isArray(data) ? data : [];

  const sorted = useMemo(() => {
    const rows = [...leads];
    rows.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [leads, sort]);

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
            <FileBarChart2 size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Daily Report — All Leads</h4>
            <p className="text-[11px] text-slate-400">{sorted.length} lead{sorted.length === 1 ? '' : 's'} in scope</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-0.5">
            {['today', 'week', 'day'].map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors
                  ${scope === s ? 'bg-white shadow-sm text-violet-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {s === 'day' ? 'Pick a day' : s === 'week' ? 'This week' : 'Today'}
              </button>
            ))}
          </div>
          {scope === 'day' && (
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input-premium text-xs py-1.5 px-2 w-36" />
          )}
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-2 px-6 py-3 bg-red-50 border-b border-red-100">
          <AlertTriangle size={13} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600">{error?.message || 'Failed to load leads'}</p>
        </div>
      )}

      {isLoading ? (
        <div className="py-14 text-center text-sm text-slate-400">Loading…</div>
      ) : sorted.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-sm font-medium text-slate-400">No leads in this range</p>
          <p className="text-xs text-slate-300 mt-1">Try &quot;This week&quot; or pick a different day</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-premium">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} onClick={() => toggleSort(c.key)} className="cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium text-slate-700 text-xs">{l.name || 'Unknown'}</td>
                  <td className="text-xs text-slate-500 capitalize">{l.source || '—'}</td>
                  <td>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${STAGE_BADGE[l.stage] || 'bg-slate-100 text-slate-500'}`}>
                      {l.stage || '—'}
                    </span>
                  </td>
                  <td className="text-xs text-slate-600 tabular-nums">{l.score ?? '—'}</td>
                  <td className="text-[11px] text-slate-400">{l.created_at ? new Date(l.created_at).toLocaleString() : '—'}</td>
                  <td className="text-xs text-slate-500">{l.assigned_to_name || '—'}</td>
                  <td className="text-[11px] text-slate-400">{l.last_activity ? new Date(l.last_activity).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
