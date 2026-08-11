'use client';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Users, Plus, Search, Flag, AlertTriangle, Download,
  Filter, X, ChevronDown, ChevronUp, ArrowUpDown,
  ArrowUp, ArrowDown, SlidersHorizontal, CheckSquare, Square, Columns3,
} from 'lucide-react';
import Modal from '@/components/Modal';
import { useLeads, useCreateLead } from '@/lib/queries/crm';

/* ─── static config ─────────────────────────────────────────────── */
const CATEGORY_TABS = [
  { key: 'active',    label: 'Active' },
  { key: 'hot',       label: '🔥 Hot' },
  { key: 'warm',      label: '🌡️ Warm' },
  { key: 'cold',      label: '❄️ Cold' },
  { key: 'onboarded', label: 'Onboarded' },
  { key: 'inactive',  label: 'Inactive / Lost' },
];

const STAGE_OPTIONS  = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost'];
const COURSE_OPTIONS = ['Data Analytics', 'Internship', 'Web Development', 'Digital Marketing'];
const TEMP_OPTIONS   = ['hot', 'warm', 'cold'];
const STATUS_OPTIONS = ['interested', 'no response', 'callback', 'enrolled', 'lost'];

const ALL_COLUMNS = [
  { key: 'created_at',      label: 'Date',    sortable: true  },
  { key: 'name',            label: 'Name',    sortable: true  },
  { key: 'phone',           label: 'Mobile',  sortable: false },
  { key: 'course',          label: 'Course',  sortable: true  },
  { key: 'temperature',     label: 'Temp',    sortable: true  },
  { key: 'contact_status',  label: 'Status',  sortable: true  },
];

const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.map((c) => c.key);
const COLUMN_PREFS_KEY = 'contacts_visible_columns';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* ─── CSV export ─────────────────────────────────────────────────── */
function exportCSV(rows) {
  const headers = ['Date', 'Name', 'Mobile', 'Course', 'Temperature', 'Status', 'Stage', 'Source'];
  const lines = rows.map((r) => [
    formatDate(r.created_at),
    r.name || '',
    r.phone || '',
    r.course || '',
    r.temperature || '',
    r.contact_status || '',
    r.stage || '',
    r.source || '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Badge helpers ──────────────────────────────────────────────── */
function TempBadge({ temp }) {
  const t = (temp || '').toLowerCase();
  const cfg =
    t === 'hot'  ? { cls: 'bg-red-50 text-red-600 ring-red-100',       emoji: '🔥' } :
    t === 'warm' ? { cls: 'bg-orange-50 text-orange-600 ring-orange-100', emoji: '🌡️' } :
                   { cls: 'bg-sky-50 text-sky-600 ring-sky-100',         emoji: '❄️' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${cfg.cls}`}>
      <span className="text-[10px]">{cfg.emoji}</span>{cap(t) || '—'}
    </span>
  );
}

function StatusBadge({ status }) {
  const tone =
    status === 'interested' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
    status === 'enrolled'   ? 'bg-violet-50 text-violet-700 ring-violet-100'   :
    status === 'lost'       ? 'bg-red-50 text-red-500 ring-red-100'             :
    status === 'callback'   ? 'bg-amber-50 text-amber-700 ring-amber-100'       :
                              'bg-slate-100 text-slate-500 ring-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${tone}`}>
      {status || '—'}
    </span>
  );
}

/* ─── Multi-select checkbox group ───────────────────────────────── */
function MultiCheckGroup({ label, options, selected, onChange }) {
  const toggle = (v) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                active
                  ? 'border-violet-300 bg-violet-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50'
              }`}
            >
              {active ? <CheckSquare size={11} /> : <Square size={11} />}
              {cap(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Sort header ─────────────────────────────────────────────────── */
function SortTh({ col, sortKey, sortDir, onSort, children }) {
  const active = sortKey === col;
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      className={`px-4 py-3 font-semibold cursor-pointer select-none group ${active ? 'text-violet-700' : ''}`}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {children}
        <Icon size={11} className={`transition-opacity ${active ? 'opacity-100 text-violet-500' : 'opacity-0 group-hover:opacity-50'}`} />
      </span>
    </th>
  );
}

/* ─── Add Lead modal ─────────────────────────────────────────────── */
function AddLeadModal({ open, onClose }) {
  const createLead = useCreateLead();
  const [name, setName]     = useState('');
  const [mobile, setMobile] = useState('');
  const [course, setCourse] = useState(COURSE_OPTIONS[0]);
  const [temp, setTemp]     = useState('warm');

  function reset() { setName(''); setMobile(''); setCourse(COURSE_OPTIONS[0]); setTemp('warm'); }

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) return;
    try {
      await createLead.mutateAsync({
        name: name.trim(), mobile: mobile.trim(), course, temperature: temp,
        contact_status: 'no response', category: 'active', source: 'manual',
      });
      reset(); onClose();
    } catch { /* error shown below */ }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Lead">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name <span className="text-red-500">*</span></label>
          <input className="input-premium" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead name" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mobile <span className="text-red-500">*</span></label>
          <input className="input-premium" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10-digit mobile" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Course</label>
          <select className="input-premium" value={course} onChange={(e) => setCourse(e.target.value)}>
            {COURSE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Temperature</label>
          <select className="input-premium" value={temp} onChange={(e) => setTemp(e.target.value)}>
            <option value="hot">🔥 Hot</option>
            <option value="warm">🌡️ Warm</option>
            <option value="cold">❄️ Cold</option>
          </select>
        </div>
        {createLead.isError && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
            <AlertTriangle size={13} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{createLead.error?.message}</p>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button type="submit" disabled={createLead.isPending} className="btn-primary btn-sm">
            {createLead.isPending ? 'Adding…' : 'Add Lead'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Active filter pill ─────────────────────────────────────────── */
function FilterPill({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 pl-2.5 pr-1.5 py-0.5 text-[11px] font-semibold text-violet-700">
      {label}
      <button onClick={onRemove} className="rounded-full hover:bg-violet-200 p-0.5 transition-colors">
        <X size={10} />
      </button>
    </span>
  );
}

/* ─── Column visibility dropdown ────────────────────────────────── */
function ColumnsMenu({ columns, visible, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (key) =>
    onChange(visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key]);

  const hiddenCount = columns.length - visible.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all duration-150 ${
          open || hiddenCount > 0
            ? 'border-violet-300 bg-violet-50 text-violet-700 shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50'
        }`}
      >
        <Columns3 size={14} />
        Columns
        {hiddenCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white shadow-sm">
            {hiddenCount}
          </span>
        )}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-100 bg-white p-2 shadow-lg animate-fade-in">
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Show / hide columns
          </p>
          <div className="mt-1 space-y-0.5">
            {columns.map((c) => {
              const isVisible = visible.includes(c.key);
              const isLast = isVisible && visible.length === 1;
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={isLast}
                  onClick={() => toggle(c.key)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                    isLast ? 'cursor-not-allowed text-slate-300' : 'text-slate-600 hover:bg-violet-50'
                  }`}
                  title={isLast ? 'At least one column must stay visible' : undefined}
                >
                  {isVisible ? <CheckSquare size={13} className="text-violet-600" /> : <Square size={13} className="text-slate-300" />}
                  {c.label}
                </button>
              );
            })}
          </div>
          {hiddenCount > 0 && (
            <button
              onClick={() => onChange(DEFAULT_VISIBLE_COLUMNS)}
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-violet-500 hover:bg-violet-50 hover:text-violet-700 transition-colors"
            >
              Reset to default
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function LeadsCrmPage() {
  const { data: leadsData, isLoading, error } = useLeads();
  const leads = Array.isArray(leadsData) ? leadsData : [];

  // Tab + search
  const [activeTab,    setActiveTab]    = useState('active');
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');

  // Date range
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');

  // Filter panel
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [tempFilters,   setTempFilters]   = useState([]);
  const [statusFilters, setStatusFilters] = useState([]);
  const [courseFilters, setCourseFilters] = useState([]);
  const [stageFilters,  setStageFilters]  = useState([]);

  // Sort
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  // Other UI
  const [addOpen,         setAddOpen]         = useState(false);
  const [exportAnim,      setExportAnim]       = useState(false);

  // Column visibility (persisted)
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLUMN_PREFS_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) {
        setVisibleColumns(saved.filter((k) => DEFAULT_VISIBLE_COLUMNS.includes(k)));
      }
    } catch { /* ignore malformed prefs */ }
  }, []);
  const handleColumnsChange = useCallback((next) => {
    setVisibleColumns(next);
    try { localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  }, []);
  const shownColumns = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key));

  const activeFilterCount = tempFilters.length + statusFilters.length + courseFilters.length + stageFilters.length +
    (startDate ? 1 : 0) + (endDate ? 1 : 0);

  function clearAllFilters() {
    setTempFilters([]); setStatusFilters([]); setCourseFilters([]); setStageFilters([]);
    setStartDate(''); setEndDate(''); setSearch(''); setSearchInput('');
  }

  const handleSort = useCallback((key) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }, [sortKey]);

  const filtered = useMemo(() => {
    let rows = leads.filter((l) => {
      const temp     = (l.temperature || '').toLowerCase();
      const category = l.category || 'active';

      if (activeTab === 'hot'      && temp !== 'hot')          return false;
      if (activeTab === 'warm'     && temp !== 'warm')         return false;
      if (activeTab === 'cold'     && temp !== 'cold')         return false;
      if (activeTab === 'onboarded'&& category !== 'onboarded')return false;
      if (activeTab === 'inactive' && category !== 'inactive') return false;
      if (activeTab === 'active'   && category !== 'active')   return false;

      if (tempFilters.length   && !tempFilters.includes(temp))                        return false;
      if (statusFilters.length && !statusFilters.includes(l.contact_status || ''))   return false;
      if (courseFilters.length && !courseFilters.includes(l.course || ''))            return false;
      if (stageFilters.length  && !stageFilters.includes(l.stage || ''))             return false;

      if (startDate && l.created_at && new Date(l.created_at) < new Date(startDate)) return false;
      if (endDate   && l.created_at && new Date(l.created_at) > new Date(endDate + 'T23:59:59')) return false;

      if (search.trim()) {
        const q   = search.trim().toLowerCase();
        const hay = `${l.name || ''} ${l.phone || ''} ${l.course || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Sort
    rows = [...rows].sort((a, b) => {
      let av = a[sortKey] ?? ''; let bv = b[sortKey] ?? '';
      if (sortKey === 'created_at') { av = new Date(av); bv = new Date(bv); }
      else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [leads, activeTab, search, tempFilters, statusFilters, courseFilters, stageFilters, startDate, endDate, sortKey, sortDir]);

  const summary = useMemo(() => {
    const total = leads.length;
    const hot   = leads.filter((l) => (l.temperature || '').toLowerCase() === 'hot').length;
    const cold  = leads.filter((l) => (l.temperature || '').toLowerCase() === 'cold').length;
    const todayStr = formatDate(new Date().toISOString());
    const addedToday = leads.filter((l) => formatDate(l.created_at) === todayStr).length;
    return { total, hot, cold, addedToday };
  }, [leads]);

  function requestDelete(row) {
    if (!confirm(`Request deletion for "${row.name}"?`)) return;
  }

  function handleExport() {
    setExportAnim(true);
    exportCSV(filtered);
    setTimeout(() => setExportAnim(false), 2000);
  }

  // Active filter pills data
  const filterPills = [
    ...tempFilters.map((v)   => ({ label: `Temp: ${cap(v)}`,   remove: () => setTempFilters((f)   => f.filter((x) => x !== v)) })),
    ...statusFilters.map((v) => ({ label: `Status: ${cap(v)}`, remove: () => setStatusFilters((f) => f.filter((x) => x !== v)) })),
    ...courseFilters.map((v) => ({ label: `Course: ${v}`,      remove: () => setCourseFilters((f) => f.filter((x) => x !== v)) })),
    ...stageFilters.map((v)  => ({ label: `Stage: ${v}`,       remove: () => setStageFilters((f)  => f.filter((x) => x !== v)) })),
    ...(startDate ? [{ label: `From: ${startDate}`, remove: () => setStartDate('') }] : []),
    ...(endDate   ? [{ label: `To: ${endDate}`,     remove: () => setEndDate('')   }] : []),
  ];

  return (
    <div className="p-6 space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-rose-500 text-white shadow-md shadow-violet-500/25">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 leading-tight">Leads / CRM</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="font-semibold text-slate-600">{filtered.length.toLocaleString()}</span> in this view
              {activeFilterCount > 0 && <span className="text-violet-500"> · {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter toggle */}
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className={`relative inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all duration-150 ${
              filterOpen || activeFilterCount > 0
                ? 'border-violet-300 bg-violet-50 text-violet-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white shadow-sm">
                {activeFilterCount}
              </span>
            )}
            {filterOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Columns visibility */}
          <ColumnsMenu columns={ALL_COLUMNS} visible={visibleColumns} onChange={handleColumnsChange} />

          {/* CSV Export */}
          <button
            onClick={handleExport}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all duration-150 ${
              exportAnim
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            <Download size={14} className={exportAnim ? 'animate-bounce' : ''} />
            {exportAnim ? 'Downloading…' : 'Export CSV'}
          </button>

          {/* Add Lead */}
          <button onClick={() => setAddOpen(true)} className="btn-primary btn-sm">
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      {filterOpen && (
        <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-white p-5 shadow-sm space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Filter size={14} className="text-violet-500" /> Advanced Filters
            </p>
            {activeFilterCount > 0 && (
              <button onClick={clearAllFilters} className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
                <X size={12} /> Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <MultiCheckGroup label="Temperature" options={TEMP_OPTIONS}   selected={tempFilters}   onChange={setTempFilters} />
            <MultiCheckGroup label="Status"      options={STATUS_OPTIONS} selected={statusFilters} onChange={setStatusFilters} />
            <MultiCheckGroup label="Course"      options={COURSE_OPTIONS} selected={courseFilters} onChange={setCourseFilters} />
            <MultiCheckGroup label="Stage"       options={STAGE_OPTIONS}  selected={stageFilters}  onChange={setStageFilters} />
          </div>

          {/* Date range */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Date Range</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                <label className="text-xs text-slate-400 font-medium">From</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs text-slate-600 outline-none bg-transparent" />
              </div>
              <span className="text-slate-300">→</span>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                <label className="text-xs text-slate-400 font-medium">To</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs text-slate-600 outline-none bg-transparent" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Category tabs ── */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-100/80 rounded-2xl p-1 border border-slate-200/60 w-fit">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
              activeTab === t.key
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Summary bar ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-white border border-slate-100 rounded-xl px-4 py-2.5 text-xs text-slate-600 shadow-sm">
        <span>Total <span className="font-bold text-slate-800">{summary.total.toLocaleString()}</span></span>
        <span className="w-px h-3.5 bg-slate-200" />
        <span>🔥 Hot <span className="font-bold text-red-500">{summary.hot.toLocaleString()}</span></span>
        <span className="w-px h-3.5 bg-slate-200" />
        <span>❄️ Cold <span className="font-bold text-sky-500">{summary.cold.toLocaleString()}</span></span>
        <span className="w-px h-3.5 bg-slate-200" />
        <span>Added today <span className="font-bold text-slate-800">{summary.addedToday}</span></span>
        <span className="ml-auto text-slate-400">Showing <span className="font-semibold text-slate-600">{filtered.length}</span> leads</span>
      </div>

      {/* ── Search bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
            placeholder="Search by name, mobile, or course…"
            className="input-premium pl-9 pr-9"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
        <button
          onClick={() => setSearch(searchInput)}
          className="rounded-xl bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 hover:bg-slate-700 transition-colors"
        >
          Search
        </button>
      </div>

      {/* ── Active filter pills ── */}
      {filterPills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center animate-fade-in">
          <span className="text-[11px] text-slate-400 font-medium">Active filters:</span>
          {filterPills.map((p, i) => (
            <FilterPill key={i} label={p.label} onRemove={p.remove} />
          ))}
          <button onClick={clearAllFilters} className="text-[11px] text-slate-400 hover:text-red-500 font-semibold transition-colors ml-1">
            Clear all
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600">{error.message}</p>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50/60">
                {shownColumns.map((c) =>
                  c.sortable ? (
                    <SortTh key={c.key} col={c.key} sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                      {c.label}
                    </SortTh>
                  ) : (
                    <th key={c.key} className="px-4 py-3 font-semibold">{c.label}</th>
                  )
                )}
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
                      <span className="text-sm text-slate-400">Loading leads…</span>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-2xl bg-slate-50 p-5">
                        <Users size={24} className="text-slate-200" />
                      </div>
                      <p className="text-sm font-medium text-slate-400">No leads match your filters</p>
                      <p className="text-xs text-slate-300">Try adjusting your search or filters</p>
                      {activeFilterCount > 0 && (
                        <button onClick={clearAllFilters} className="mt-1 text-xs font-semibold text-violet-500 hover:text-violet-700 transition-colors">
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((row, i) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-violet-50/30 transition-colors animate-fade-in"
                  style={{ animationDelay: `${i * 15}ms` }}
                >
                  {visibleColumns.includes('created_at') && (
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{formatDate(row.created_at)}</td>
                  )}
                  {visibleColumns.includes('name') && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-violet-100 to-rose-100 text-[10px] font-bold text-violet-700 shrink-0">
                          {(row.name || '?')[0].toUpperCase()}
                        </span>
                        <button className="text-violet-600 font-semibold hover:underline text-sm">{row.name}</button>
                      </div>
                    </td>
                  )}
                  {visibleColumns.includes('phone') && (
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-xs">{row.phone || '—'}</td>
                  )}
                  {visibleColumns.includes('course') && (
                    <td className="px-4 py-3 text-slate-600 text-xs">{row.course || '—'}</td>
                  )}
                  {visibleColumns.includes('temperature') && (
                    <td className="px-4 py-3"><TempBadge temp={row.temperature} /></td>
                  )}
                  {visibleColumns.includes('contact_status') && (
                    <td className="px-4 py-3"><StatusBadge status={row.contact_status} /></td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button className="text-violet-600 text-xs font-semibold hover:underline">Open</button>
                      <button
                        onClick={() => requestDelete(row)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg px-2 py-1 transition-colors"
                      >
                        <Flag size={11} /> Req Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-50 bg-slate-50/40">
            <p className="text-xs text-slate-400">
              {filtered.length.toLocaleString()} lead{filtered.length !== 1 ? 's' : ''} shown
            </p>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors"
            >
              <Download size={12} /> Export {filtered.length} rows as CSV
            </button>
          </div>
        )}
      </div>

      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}