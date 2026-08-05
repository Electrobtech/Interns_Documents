'use client';
/**
 * Shared shell for every section that runs a real Orbq capability.
 *
 * All AI sections have the same shape — a prompt box, a run button, and a
 * result with its provenance — so they share one component. Only the copy and
 * the result renderer differ.
 *
 * The provenance block is not decoration. It shows confidence, which
 * capabilities actually ran, and which documents were cited. When nothing was
 * retrieved it says so plainly, because a fluent ungrounded answer is the
 * failure mode this whole system is built to avoid.
 */
import { useState } from 'react';
import { Sparkles, AlertTriangle, FileText, Loader2 } from 'lucide-react';

import { useRunMarketingAgent } from '@/lib/queries/aiAgents';
import { Card, SectionTitle, Badge, Button, EmptyState, ConfidenceMeter } from '../MarketingUI';

export default function AgentSection({
  title,
  subtitle,
  placeholder,
  examples = [],
  capability,
  renderResult,
  icon: Icon = Sparkles,
}) {
  const run = useRunMarketingAgent();
  const [prompt, setPrompt] = useState('');

  const submit = (e) => {
    e?.preventDefault();
    const message = prompt.trim();
    if (message) run.mutate({ message });
  };

  const res = run.data;
  const exp = res?.explanation;
  // The orchestrator chooses capabilities; this section only suggests one.
  // Render whatever actually ran rather than what we hoped would run.
  const output =
    res?.output?.[capability] ?? (res?.output ? Object.values(res.output)[0] : null);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle title={title} subtitle={subtitle} />
        <form onSubmit={submit} className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full text-sm rounded-xl border border-[#E4E8F0] px-3.5 py-3 outline-none resize-y
                       focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all
                       placeholder:text-slate-300 text-slate-700"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-1.5">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E4E8F0] text-slate-500
                             hover:bg-slate-50 hover:text-slate-700 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
            <Button
              type="submit"
              variant="primary"
              icon={run.isPending ? Loader2 : Icon}
              disabled={run.isPending || !prompt.trim()}
            >
              {run.isPending ? 'Running…' : 'Run'}
            </Button>
          </div>
        </form>
      </Card>

      {run.isError && (
        <Card className="p-4 border-red-200 bg-red-50/60">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">The run failed</p>
              <p className="text-xs text-red-500 mt-0.5">{run.error?.message || 'Unknown error'}</p>
            </div>
          </div>
        </Card>
      )}

      {run.isPending && (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <p className="text-xs">The agent is working — this usually takes a few seconds.</p>
          </div>
        </Card>
      )}

      {res && !run.isPending && (
        <>
          {/* Provenance first: how much to trust what follows. */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0F1929]">Result</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{exp?.summary}</p>
              </div>
              <div className="text-right flex-shrink-0 w-28">
                <div
                  className="text-lg font-bold text-[#0F1929]"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {exp?.confidence != null ? `${Math.round(exp.confidence * 100)}%` : '—'}
                </div>
                <p className="text-[10px] text-slate-400 mb-1">confidence</p>
                <ConfidenceMeter value={exp?.confidence != null ? exp.confidence * 100 : null} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-[#EEF1F6]">
              {(exp?.capabilities_used || []).map((c) => (
                <Badge key={c} tone="violet">{c}</Badge>
              ))}
              {(exp?.degraded_inputs || []).map((d) => (
                <Badge key={d} tone="amber">{d}</Badge>
              ))}
              {res.status === 'pending_approval' && <Badge tone="amber">awaiting approval</Badge>}
            </div>

            {exp?.knowledge_used?.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-[#EEF1F6]">
                <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Sources cited</p>
                <div className="space-y-1">
                  {exp.knowledge_used.slice(0, 4).map((k) => (
                    <div key={k.chunk_id} className="flex items-center gap-2 text-[11px] text-slate-500">
                      <FileText size={11} className="text-slate-300 flex-shrink-0" />
                      <span className="truncate">{k.source_title}</span>
                      <span className="ml-auto font-mono text-[10px] text-slate-400">
                        {Math.round((k.score || 0) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 pt-3 border-t border-[#EEF1F6] text-[11px] text-amber-600">
                No documents matched — this answer is not grounded in your knowledge base.
                Upload material under Knowledge Base to improve it.
              </p>
            )}
          </Card>

          {output && (
            <Card className="p-5">
              {renderResult ? (
                renderResult(output)
              ) : (
                <pre className="text-[11px] text-slate-600 whitespace-pre-wrap font-mono overflow-x-auto">
                  {JSON.stringify(output, null, 2)}
                </pre>
              )}
            </Card>
          )}
        </>
      )}

      {!res && !run.isPending && !run.isError && (
        <Card className="p-5">
          <EmptyState
            icon={Icon}
            title="No result yet"
            body="Describe what you need above. The agent grounds its answer in your uploaded documents and shows exactly which ones it used."
          />
        </Card>
      )}
    </div>
  );
}

/* ── Shared result-renderer helpers ─────────────────────────────────── */

export function Field({ label, children }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

export function List({ items }) {
  if (!items?.length) return <p className="text-xs text-slate-400">None</p>;
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i} className="text-[13px] text-slate-700 flex gap-2">
          <span className="text-slate-300 flex-shrink-0">·</span>
          <span>{typeof it === 'string' ? it : JSON.stringify(it)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Chips({ items, tone = 'violet', labelKey = 'term' }) {
  if (!items?.length) return <p className="text-xs text-slate-400">None</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <Badge key={i} tone={tone}>
          {typeof it === 'string' ? it : it[labelKey] || it.name || JSON.stringify(it)}
        </Badge>
      ))}
    </div>
  );
}
