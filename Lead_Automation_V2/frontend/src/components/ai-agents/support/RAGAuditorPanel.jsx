'use client';
import { FileSearch, AlertTriangle, CheckCircle2, Clock, Quote, Database } from 'lucide-react';
import { useSupportCoverageAudit } from '@/lib/queries/aiAgents';

export default function RAGAuditorPanel() {
  const { data, isLoading, isError, error } = useSupportCoverageAudit();

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 text-center">
        <p className="text-sm font-semibold text-slate-400">Auditing knowledge coverage…</p>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
        <AlertTriangle size={14} className="text-red-500 shrink-0" />
        <p className="text-sm text-red-600">{error?.message || 'Failed to load coverage audit'}</p>
      </div>
    );
  }

  const gaps = data?.gaps || [];
  const citations = data?.citations || [];
  const grounded = data?.grounded_pct ?? 0;

  return (
    <div className="space-y-6">
      {/* Coverage Gap Banner(s) */}
      {gaps.length > 0 ? (
        <div className="space-y-2">
          {gaps.slice(0, 3).map((g, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
              <span className="text-lg leading-none">📌</span>
              <p className="text-sm text-amber-900">
                <b>{g.gap_pct}%</b> of <span className="capitalize font-semibold">{g.category}</span> tickets
                ({g.ungrounded_count} of {g.ticket_count}) had <b>no matching document</b> — the AI answered without grounding.
                Consider adding a doc for this topic.
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">No coverage gaps detected — every ticket category is grounded in your knowledge base.</p>
        </div>
      )}

      {/* Grounding summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 text-center">
          <p className="text-3xl font-black text-emerald-600 tabular-nums">{grounded}%</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Replies grounded</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 text-center">
          <p className="text-3xl font-black text-slate-800 tabular-nums">{data?.total_runs_analyzed ?? 0}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Replies analyzed</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 text-center">
          <p className={`text-3xl font-black tabular-nums ${(data?.stale_source_count ?? 0) > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
            {data?.stale_source_count ?? 0}
          </p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Docs need re-verification</p>
        </div>
      </div>

      {/* Per-source citation counts + staleness chips */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
            <FileSearch size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Knowledge source auditor</h4>
            <p className="text-[11px] text-slate-400">How often each document is actually cited, and whether it's still fresh</p>
          </div>
        </div>

        {citations.length === 0 ? (
          <div className="text-center py-8 flex flex-col items-center gap-2">
            <Database size={22} className="text-slate-300" />
            <p className="text-xs font-medium text-slate-400">No support documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {citations.map((c) => (
              <div key={c.source_id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase mt-0.5">{c.source_type}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 shrink-0">
                  <Quote size={11} /> Cited in {c.cited_count} {c.cited_count === 1 ? 'reply' : 'replies'}
                </span>
                {c.stale ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                    <Clock size={10} /> Needs re-verification
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    <CheckCircle2 size={10} /> Verified
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
