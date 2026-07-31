'use client';
import { useState } from 'react';
import { Search, Sparkles, AlertTriangle, ChevronRight, FileText } from 'lucide-react';
import { useGenerateSEOBrief, useSEOBriefs } from '@/lib/queries/marketingAgent';

function asLabel(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    return item.keyword || item.term || item.name || item.title || JSON.stringify(item);
  }
  return String(item);
}

function KeywordChips({ items, tone }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return <p className="text-xs text-slate-400">None generated</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((item, i) => (
        <span key={i} className={`text-[11px] font-medium px-2.5 py-1 rounded-lg ${tone}`}>
          {asLabel(item)}
        </span>
      ))}
    </div>
  );
}

export default function SEOPanel() {
  const generate = useGenerateSEOBrief();
  const { data: briefs } = useSEOBriefs();
  const [topic, setTopic] = useState('');
  const [selected, setSelected] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    generate.mutate(topic.trim(), {
      onSuccess: (out) => setSelected(out),
    });
  };

  const active = selected || generate.data;
  const contentBrief = active?.content_brief && typeof active.content_brief === 'object' ? active.content_brief : null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-600">
              <Search size={15} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">SEO Keyword Research</h4>
              <p className="text-[11px] text-slate-400">Grounded in your knowledge base — no external SEO tool connected</p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

          <form onSubmit={submit} className="flex gap-2">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic or goal, e.g. 'AI lead automation for SMBs'"
              className="input-premium flex-1"
            />
            <button disabled={generate.isPending || !topic.trim()} className="btn-primary shrink-0">
              <Sparkles size={14} />
              {generate.isPending ? 'Researching…' : 'Generate'}
            </button>
          </form>

          {generate.isError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl mt-3">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{generate.error?.message}</p>
            </div>
          )}
        </div>

        {active && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-5 animate-scale-in">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Primary Keywords</p>
              <KeywordChips items={active.primary_keywords} tone="bg-emerald-50 text-emerald-700" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Long-Tail Keywords</p>
              <KeywordChips items={active.long_tail_keywords} tone="bg-violet-50 text-violet-700" />
            </div>
            {active.search_intent && Object.keys(active.search_intent).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Search Intent</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {typeof active.search_intent === 'string' ? active.search_intent : JSON.stringify(active.search_intent)}
                </p>
              </div>
            )}
            {contentBrief && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Content Brief</p>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-slate-600">
                  {contentBrief.audience && <p><span className="font-semibold text-slate-700">Audience:</span> {contentBrief.audience}</p>}
                  {contentBrief.angle && <p><span className="font-semibold text-slate-700">Angle:</span> {contentBrief.angle}</p>}
                  {contentBrief.recommended_channel_format && (
                    <p><span className="font-semibold text-slate-700">Recommended format:</span> {contentBrief.recommended_channel_format}</p>
                  )}
                  {Array.isArray(contentBrief.outline) && contentBrief.outline.length > 0 && (
                    <div>
                      <span className="font-semibold text-slate-700">Outline:</span>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {contentBrief.outline.map((o, i) => <li key={i}>{asLabel(o)}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            {Array.isArray(active.on_page_recommendations) && active.on_page_recommendations.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">On-Page Recommendations</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                  {active.on_page_recommendations.map((r, i) => <li key={i}>{asLabel(r)}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-600">
              <FileText size={15} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Saved Briefs</h4>
              <p className="text-[11px] text-slate-400">Click to review</p>
            </div>
          </div>
        </div>

        {!briefs?.length ? (
          <div className="text-center py-8">
            <p className="text-xs font-medium text-slate-400">No briefs yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {briefs.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setSelected({ ...b.output, id: b.id, topic: b.topic })}
                className="w-full group flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/50 border border-transparent hover:border-emerald-100 transition-all duration-150 text-left animate-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{b.topic}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(b.created_at).toLocaleString()}</p>
                </div>
                <ChevronRight size={13} className="text-slate-300 shrink-0 mt-1 group-hover:text-emerald-400 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
