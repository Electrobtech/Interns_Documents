'use client';
/**
 * Right-hand AI Assistant panel (320px, collapsible).
 *
 * The quick actions are real prompts sent to the Marketing Agent, not canned
 * responses — each one runs the orchestrator and shows what actually came
 * back, including its confidence and which capabilities ran.
 */
import { useState } from 'react';
import { Sparkles, X, Loader2, PanelRightOpen, AlertTriangle } from 'lucide-react';

import { useRunMarketingAgent } from '@/lib/queries/aiAgents';
import { ACCENT, ConfidenceMeter, Badge } from './MarketingUI';

/** Section id → the actions that make sense there. A generic list would offer
 *  "Run SEO Audit" while the user is looking at Assets. */
const CONTEXT_ACTIONS = {
  dashboard: ['Summarize this month', 'What should I focus on next?'],
  campaigns: ['Plan a campaign', 'Optimize my budget split'],
  broadcasts: ['Draft a WhatsApp broadcast', 'Is this copy compliant?'],
  audience: ['Define our ICP', 'Build a buyer persona'],
  content: ['Write 3 ad headlines', 'Draft a launch email'],
  seo: ['Keyword plan for our product', 'Content brief for a pillar page'],
  aeo: ['Make our FAQ answer-engine ready', 'Extractable summary for pricing'],
  competitor: ['SWOT against our top rivals', 'Where do we win?'],
  calendar: ['6-week content plan', 'Monthly cadence across channels'],
  analytics: ['Explain last week', 'What changed and why?'],
  reports: ['What should be in this month\'s report?'],
  templates: ['Draft a welcome template'],
  assets: ['What creative do we still need?'],
  knowledge: ['What gaps are in our knowledge base?'],
  settings: ['Explain the approval rules'],
};

const DEFAULT_ACTIONS = ['Plan a campaign', 'Write ad copy', 'Analyze a competitor'];

export default function AIPanel({ open, onClose, sectionId, sectionLabel }) {
  const run = useRunMarketingAgent();
  const [prompt, setPrompt] = useState('');

  const actions = CONTEXT_ACTIONS[sectionId] || DEFAULT_ACTIONS;

  const ask = (message) => {
    const text = (message ?? prompt).trim();
    if (text) run.mutate({ message: text });
  };

  if (!open) return null;

  const exp = run.data?.explanation;
  const output = run.data?.output ? Object.values(run.data.output)[0] : null;

  return (
    <aside className="w-80 flex-shrink-0 border-l border-[#E4E8F0] bg-white overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-[#EEF1F6] px-4 py-3.5 flex items-center gap-2 z-10">
        <Sparkles size={15} style={{ color: ACCENT }} />
        <h3 className="text-sm font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
          AI Assistant
        </h3>
        <button onClick={onClose} className="ml-auto text-slate-300 hover:text-slate-600 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Quick actions — {sectionLabel}
          </p>
          <div className="space-y-1.5">
            {actions.map((a) => (
              <button
                key={a}
                onClick={() => ask(a)}
                disabled={run.isPending}
                className="w-full text-left text-[12px] px-3 py-2 rounded-xl border border-[#E4E8F0]
                           text-slate-600 hover:bg-rose-50/60 hover:border-rose-200 hover:text-rose-700
                           transition-all disabled:opacity-50"
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); ask(); }}
          className="space-y-2"
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Ask the Marketing Agent…"
            className="w-full text-[13px] rounded-xl border border-[#E4E8F0] px-3 py-2.5 outline-none resize-y
                       focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all
                       placeholder:text-slate-300 text-slate-700"
          />
          <button
            type="submit"
            disabled={run.isPending || !prompt.trim()}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                       text-sm font-medium text-white shadow-sm disabled:opacity-50 transition-all"
            style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #FB923C 100%)` }}
          >
            {run.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {run.isPending ? 'Thinking…' : 'Ask'}
          </button>
        </form>

        {run.isError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2.5">
            <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-red-600">{run.error?.message || 'The run failed'}</p>
          </div>
        )}

        {run.data && !run.isPending && (
          <div className="rounded-xl border border-[#E4E8F0] p-3.5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-[11px] text-slate-500 flex-1">{exp?.summary}</p>
              <div className="text-right flex-shrink-0 w-16">
                <p className="text-sm font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {exp?.confidence != null ? `${Math.round(exp.confidence * 100)}%` : '—'}
                </p>
                <ConfidenceMeter value={exp?.confidence != null ? exp.confidence * 100 : null} />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {(exp?.capabilities_used || []).map((c) => <Badge key={c} tone="violet">{c}</Badge>)}
            </div>

            {!exp?.knowledge_used?.length && (
              <p className="text-[10px] text-amber-600 mb-2">
                Not grounded in your knowledge base.
              </p>
            )}

            {output && (
              <pre className="text-[10px] text-slate-600 whitespace-pre-wrap font-mono max-h-72 overflow-y-auto">
                {JSON.stringify(output, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export function AIPanelToggle({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white
                 shadow-sm hover:opacity-90 transition-all"
      style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #FB923C 100%)` }}
    >
      <Sparkles size={14} />
      Ask Marketing Agent
    </button>
  );
}
