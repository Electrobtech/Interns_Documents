'use client';
import { useMemo, useState } from 'react';
import { Users, Plus, Search, Flag, AlertTriangle } from 'lucide-react';
import Modal from '@/components/Modal';
import { useLeads, useCreateLead } from '@/lib/queries/crm';

/* ─── static config ────────────────────────────────────────────── */
const CATEGORY_TABS = [
  { key: 'active',     label: 'Active' },
  { key: 'hot',        label: '🔥 Hot' },
  { key: 'warm',       label: '🌡️ Warm' },
  { key: 'cold',       label: '❄️ Cold' },
  { key: 'onboarded',  label: 'Onboarded' },
  { key: 'inactive',   label: 'Inactive / Lost' },
];

const STAGE_OPTIONS = ['All Stages', 'New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost'];

const COURSE_OPTIONS = ['Data Analytics', 'Internship', 'Web Development', 'Digital Marketing'];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* ─── badge helpers ───────────────────────────────────────────── */
function TempBadge({ temp }) {
  const t = (temp || '').toLowerCase();
  const tone =
    t === 'hot'  ? 'bg-red-50 text-red-600 ring-red-100'    :
    t === 'warm' ? 'bg-orange-50 text-orange-600 ring-orange-100' :
                    'bg-sky-50 text-sky-600 ring-sky-100';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${tone}`}>
      {cap(t) || '—'}
    </span>
  );
}

function StatusBadge({ status }) {
  const tone =
    status === 'interested'  ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' :
    status === 'no response' ? 'bg-slate-100 text-slate-500 ring-slate-200'      :
                                'bg-violet-50 text-violet-400 ring-violet-100';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${tone}`}>
      {status || '—'}
    </span>
  );
}

/* ─── add lead modal ──────────────────────────────────────────── */
function AddLeadModal({ open, onClose }) {
  const createLead = useCreateLead();
  const [name, setName]     = useState('');
  const [mobile, setMobile] = useState('');
  const [course, setCourse] = useState(COURSE_OPTIONS[0]);
  const [temp, setTemp]     = useState('warm');

  function reset() {
    setName(''); setMobile(''); setCourse(COURSE_OPTIONS[0]); setTemp('warm');
  }

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) return;
    try {
      await createLead.mutateAsync({
        name: name.trim(),
        mobile: mobile.trim(),
        course,
        temperature: temp,
        contact_status: 'no response',
        category: 'active',
        source: 'manual',
      });
      reset();
      onClose();
    } catch {
      // error surfaced below via createLead.isError
    }
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
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
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

/* ─── page ─────────────────────────────────────────────────────── */
export default function LeadsCrmPage() {
  // Real leads from the database (contact-service GET /leads) — same data
  // whichever laptop/browser is signed into this org, since it's persisted
  // in Postgres rather than local component state.
  const { data: leadsData, isLoading, error } = useLeads();
  const leads = Array.isArray(leadsData) ? leadsData : [];

  const [activeTab, setActiveTab]     = useState('active');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [stageFilter, setStageFilter] = useState('All Stages');
  const [addOpen, setAddOpen]         = useState(false);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const temp = (l.temperature || '').toLowerCase();
      const category = l.category || 'active';
      if (activeTab === 'hot' && temp !== 'hot') return false;
      if (activeTab === 'warm' && temp !== 'warm') return false;
      if (activeTab === 'cold' && temp !== 'cold') return false;
      if (activeTab === 'onboarded' && category !== 'onboarded') return false;
      if (activeTab === 'inactive' && category !== 'inactive') return false;
      if (activeTab === 'active' && category !== 'active') return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const name = (l.name || '').toLowerCase();
        const phone = l.phone || '';
        if (!name.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [leads, activeTab, search]);

  const summary = useMemo(() => {
    const total = leads.length;
    const hot = leads.filter((l) => (l.temperature || '').toLowerCase() === 'hot').length;
    const cold = leads.filter((l) => (l.temperature || '').toLowerCase() === 'cold').length;
    const todayStr = formatDate(new Date().toISOString());
    const addedToday = leads.filter((l) => formatDate(l.created_at) === todayStr).length;
    return { total, hot, cold, addedToday };
  }, [leads]);

  function requestDelete(row) {
    if (!confirm(`Request deletion for "${row.name}"?`)) return;
    // Flagging for deletion review isn't wired to the backend yet — this is
    // a client-side confirmation only, unlike Add Lead which is persisted.
  }

  return (
    <div className="p-6 space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-rose-100 text-violet-600 shadow-sm">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 leading-tight">Leads / CRM</h2>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length.toLocaleString()} in this view</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs text-slate-600 outline-none bg-transparent"
            />
            <span className="text-slate-300">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs text-slate-600 outline-none bg-transparent"
            />
          </div>
          <button onClick={() => setAddOpen(true)} className="btn-primary btn-sm">
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {/* category filter tabs */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-100/80 rounded-2xl p-1 border border-slate-200/60 w-fit">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
              activeTab === t.key
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* summary metrics bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-white border border-slate-100 rounded-xl px-4 py-2.5 text-xs text-slate-600">
        <span>Total <span className="font-bold text-slate-800">{summary.total.toLocaleString()}</span></span>
        <span className="w-px h-3.5 bg-slate-200" />
        <span>🔥 Hot <span className="font-bold text-red-500">{summary.hot.toLocaleString()}</span></span>
        <span className="w-px h-3.5 bg-slate-200" />
        <span>❄️ Cold <span className="font-bold text-sky-500">{summary.cold.toLocaleString()}</span></span>
        <span className="w-px h-3.5 bg-slate-200" />
        <span>Added today <span className="font-bold text-slate-800">{summary.addedToday}</span></span>
      </div>

      {/* search & filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
            placeholder="Search by name or mobile..."
            className="input-premium pl-8"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="input-premium w-auto text-sm"
        >
          {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => setSearch(searchInput)}
          className="rounded-xl bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 hover:bg-slate-800 transition-colors"
        >
          Search
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600">{error.message}</p>
        </div>
      )}

      {/* table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Mobile</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Temp</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">Loading leads…</td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">No leads match your filters</td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <button className="text-violet-600 font-semibold hover:underline">{row.name}</button>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.course || '—'}</td>
                  <td className="px-4 py-3"><TempBadge temp={row.temperature} /></td>
                  <td className="px-4 py-3"><StatusBadge status={row.contact_status} /></td>
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
      </div>

      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
