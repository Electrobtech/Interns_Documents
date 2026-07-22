'use client';
import { useState } from 'react';
import { Target, Sparkles, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { useGenerateCompetitorIntel, useCompetitorReports } from '@/lib/queries/marketingAgent';

function asItems(v) {
  return Array.isArray(v) ? v : [];
}
function asLabel(item) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') return item.text || item.title || item.name || JSON.stringify(item);
  return String(item);
}

const DEFAULT_DISCLAIMER =
  'Reasoned from your documents and general market knowledge — not live competitor data. No web search or competitor monitoring is connected.';

export default function CompetitorPanel() {
  const generate = useGenerateCompetitorIntel();
  const { data: reports } = useCompetitorReports();
  const [subject, setSubject] = useState('');
  const [selected, setSelected] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!subject.trim()) return;
    generate.mutate(subject.trim(), { onSuccess: (out) => setSelected(out) });
  };

  const active = selected || generate.data;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-rose-50 to-red-100 text-rose-600">
              <Target size={15} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Competitor & Market Intelligence</h4>
              <p className="text-[11px] text-slate-400">AI-reasoned positioning analysis</p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

          <form onSubmit={submit} className="flex gap-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Category, market, or a named competitor"
              className="input-premium flex-1"
            />
            <button disabled={generate.isPending || !subject.trim()} className="btn-primary shrink-0">
              <Sparkles size={14} />
              {generate.isPending ? 'Reasoning…' : 'Generate'}
            </button>
          </form>

          {generate.isError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl mt-3">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{generate.error?.message}</p>
            </div>
          )}
        </div>

        {/* Persistent disclaimer — always visible on this tab */}
        <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
          <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            {active?.disclaimer || DEFAULT_DISCLAIMER}
          </p>
        </div>

        {active && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-5 animate-scale-in">
            {active.positioning_summary && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Positioning Summary</p>
                <p className="text-sm text-slate-600 leading-relaxed">{active.positioning_summary}</p>
              </div>
            )}
            {asItems(active.likely_competitor_angles).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Likely Competitor Angles</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                  {asItems(active.likely_competitor_angles).map((x, i) => <li key={i}>{asLabel(x)}</li>)}
                </ul>
              </div>
            )}
            {asItems(active.differentiation_suggestions).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Differentiation Suggestions</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                  {asItems(active.differentiation_suggestions).map((x, i) => <li key={i}>{asLabel(x)}</li>)}
                </ul>
              </div>
            )}
            {asItems(active.content_gaps).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Content Gaps</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                  {asItems(active.content_gaps).map((x, i) => <li key={i}>{asLabel(x)}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <h4 className="font-bold text-slate-800 text-sm mb-4">Saved Reports</h4>
        {!reports?.length ? (
          <p className="text-xs text-slate-400 text-center py-6">No reports yet</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setSelected({ ...r.output, id: r.id, subject: r.subject })}
                className="w-full group flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-rose-50/50 border border-transparent hover:border-rose-100 transition-all text-left animate-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{r.subject}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <ChevronRight size={13} className="text-slate-300 shrink-0 mt-1 group-hover:text-rose-400 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
