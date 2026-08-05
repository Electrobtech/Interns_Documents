'use client';
import { useState } from 'react';
import { Users, TrendingUp, Sparkles, Target, AlertTriangle, Zap, ChevronRight, Upload } from 'lucide-react';
import Tabs from '@/components/Tabs';
import CrudPage from '@/components/CrudPage';
import { contacts, leads } from '@/lib/resources';
import { useLeads } from '@/lib/queries/crm';
import { useRunSalesAgent, useSalesRuns } from '@/lib/queries/aiAgents';
import { BookMeetingButton } from '@/components/calendar/BookMeetingDialog';
import { AddFollowUpButton } from '@/components/followups/AddFollowUpButton';
import ImportContactsDialog from '@/components/contacts/ImportContactsDialog';

/* ─── score colour ──────────────────────────── */
function scoreTone(s) {
  if (s >= 70) return { bg: 'bg-red-50 text-red-700 ring-red-200',   bar: 'from-red-500 to-rose-500'    };
  if (s >= 40) return { bg: 'bg-amber-50 text-amber-700 ring-amber-200', bar: 'from-amber-500 to-orange-400' };
  return        { bg: 'bg-sky-50 text-sky-700 ring-sky-200',       bar: 'from-sky-400 to-sky-500'   };
}

/* ─── embedded Sales Agent panel ───────────── */
function SalesAgentPanel() {
  const run          = useRunSalesAgent();
  const { data: runsData } = useSalesRuns();
  const { data: leadsData } = useLeads();

  const [brief,    setBrief]    = useState('');
  const [leadName, setLeadName] = useState('');
  const [company,  setCompany]  = useState('');

  const leads_list = Array.isArray(leadsData) ? leadsData : [];
  const runs       = Array.isArray(runsData)  ? runsData  : [];

  const submit = (e) => {
    e.preventDefault();
    if (!brief.trim()) return;
    run.mutate({ brief: brief.trim(), lead_name: leadName.trim() || null, company: company.trim() || null });
  };

  const out = run.data;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start mt-0">

      {/* left: form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        {/* header */}
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-600">
            <Sparkles size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Sales Agent — Analyse Lead</h4>
            <p className="text-[11px] text-slate-400">AI scores the lead and drafts follow-up from your documents</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

        <form onSubmit={submit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Lead Name</label>
              <input value={leadName} onChange={(e) => setLeadName(e.target.value)}
                placeholder="Optional" className="input-premium" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)}
                placeholder="Optional" className="input-premium" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Context *</label>
            <textarea required rows={4} value={brief} onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Asked about enterprise pricing twice, mentioned Q3 budget…"
              className="input-premium resize-none" />
          </div>
          {run.isError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{run.error?.message}</p>
            </div>
          )}
          <button disabled={run.isPending || !brief.trim()} className="btn-emerald w-full">
            <Sparkles size={14} />
            {run.isPending ? 'Analysing…' : 'Analyse Lead'}
          </button>
        </form>
      </div>

      {/* centre: result */}
      <div className="space-y-4">
        {run.isPending && (
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-card p-8 text-center animate-scale-in">
            <div className="relative inline-block mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
                <Sparkles size={22} className="text-emerald-500 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Scoring lead…</p>
            <div className="flex justify-center gap-1.5 mt-3">
              {[0,1,2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}

        {out && (
          <div className="space-y-3 animate-slide-up">
            {/* score */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
              <div className="flex items-center gap-4">
                {(() => {
                  const t = scoreTone(out.lead_score ?? 0);
                  return (
                    <div className={`w-18 h-18 w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-bold shrink-0 ring-2 ${t.bg}`}>
                      <span className="text-2xl leading-none">{out.lead_score ?? '—'}</span>
                      <span className="text-[9px] uppercase tracking-widest mt-0.5 opacity-70">Score</span>
                    </div>
                  );
                })()}
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">AI Lead Score</p>
                  <p className="text-sm text-slate-700 mt-1 leading-snug">{out.lead_qualification_reason}</p>
                  {out.opportunity_stage && (
                    <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      {out.opportunity_stage}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {out.recommended_sales_action && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Recommended Action</p>
                <p className="text-sm text-slate-700 leading-relaxed">{out.recommended_sales_action}</p>
              </div>
            )}
            {out.follow_up_message && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Follow-up Draft</p>
                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 whitespace-pre-line leading-relaxed border border-slate-100">
                  {out.follow_up_message}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">AI-generated — review before sending via Unified Inbox.</p>
              </div>
            )}
          </div>
        )}

        {!out && !run.isPending && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col items-center justify-center py-14 text-center">
            <div className="p-4 rounded-2xl bg-slate-50 mb-3">
              <Target size={22} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">Fill the form to score a lead</p>
            <p className="text-xs text-slate-300 mt-1">AI will analyse buying intent and suggest next steps</p>
          </div>
        )}
      </div>

      {/* right: recent analyses */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-600">
            <TrendingUp size={14} />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">Recent Analyses</p>
            <p className="text-[11px] text-slate-400">{runs.length} total</p>
          </div>
        </div>
        {!runs.length
          ? <p className="text-xs text-slate-400 text-center py-6">No analyses yet</p>
          : (
            <div className="space-y-2">
              {runs.slice(0, 6).map((r) => {
                const t = scoreTone(r.output?.lead_score ?? 0);
                return (
                  <div key={r.id}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/40 border border-transparent hover:border-emerald-100 transition-all">
                    {r.output?.lead_score != null && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ring-1 shrink-0 ${t.bg}`}>
                        {r.output.lead_score}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{r.brief}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}

/* ─── contacts tab: CRUD table plus spreadsheet import ──────────── */
function ContactsTab() {
  const [importOpen, setImportOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-violet-300 hover:bg-violet-50"
        >
          <Upload className="h-3.5 w-3.5" /> Import CSV / Excel
        </button>
      </div>
      <CrudPage {...contacts} header={false} rowActions={(row) => (
        <>
          <BookMeetingButton contact={row} />
          <AddFollowUpButton contact={row} />
        </>
      )} />
      <ImportContactsDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

/* ─── page ──────────────────────────────────── */
export default function ContactsPage() {
  return (
    <Tabs title="Contacts & Leads" icon={Users} tabs={[
      { label: 'Contacts', icon: Users,     render: () => <ContactsTab /> },
      { label: 'Leads',    icon: Target,    render: () => <CrudPage {...leads}    header={false} rowActions={(row) => (
        <>
          <BookMeetingButton contact={row} />
          <AddFollowUpButton contact={row} />
        </>
      )} /> },
      { label: 'AI Lead Scoring', icon: Sparkles, render: () => <SalesAgentPanel /> },
    ]} />
  );
}
