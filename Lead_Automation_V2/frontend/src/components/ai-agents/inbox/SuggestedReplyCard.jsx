'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Check, X, RefreshCw, FileText, ChevronDown, AlertTriangle } from 'lucide-react';
import { useSuggestSupportReply } from '@/lib/queries/aiAgents';

// The "trust layer" for an AI suggestion: the reply itself, a confidence
// signal (from the RAG retriever's low_confidence gate — see
// human_handoff on SupportRunOut), the knowledge sources it's grounded in,
// and three actions: Use it, Dismiss, or Regenerate. Never auto-sends —
// the human always makes the final Send click in the reply box below.
//
// Fires once per unanswered inbound message (keyed by `brief`), not on every
// keystroke or render, so it reads as one suggestion per customer message.
export default function SuggestedReplyCard({ brief, customerName, channel, sessionId, contactId, onUse }) {
  const suggest = useSuggestSupportReply();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const firedFor = useRef(null);

  useEffect(() => {
    if (!brief || firedFor.current === brief) return;
    firedFor.current = brief;
    setDismissed(false);
    suggest.mutate({ brief, customer_name: customerName || undefined, channel: channel || undefined, session_id: sessionId, contact_id: contactId || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief]);

  if (dismissed || !brief) return null;

  const regenerate = () => {
    setDismissed(false);
    suggest.mutate({ brief, customer_name: customerName || undefined, channel: channel || undefined, session_id: sessionId, contact_id: contactId || undefined });
  };

  const out = suggest.data;
  const sources = out?.knowledge_sources_used || [];
  const lowConfidence = !!out?.human_handoff;

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-fuchsia-50/40 overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3">
        <div className="p-1 rounded-md bg-violet-100 text-violet-600">
          <Sparkles size={12} />
        </div>
        <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">AI Suggested Reply</span>
        {!suggest.isPending && out && (
          lowConfidence ? (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              <AlertTriangle size={10} /> Review carefully — thin sources
            </span>
          ) : (
            <span className="ml-auto text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              Grounded — ready to review
            </span>
          )
        )}
      </div>

      <div className="px-4 pb-3 pt-2">
        {suggest.isPending && (
          <div className="flex items-center gap-2 text-xs text-violet-500 py-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
            Retrieving knowledge and drafting a reply…
          </div>
        )}

        {suggest.isError && (
          <p className="text-xs text-red-500 py-1">Couldn't generate a suggestion. {suggest.error?.message}</p>
        )}

        {!suggest.isPending && out?.suggested_reply && (
          <>
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{out.suggested_reply}</p>

            {sources.length > 0 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 flex items-center gap-1 text-[11px] text-violet-500 hover:text-violet-700 font-medium"
              >
                <FileText size={11} /> {sources.length} source{sources.length > 1 ? 's' : ''}
                <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
            {expanded && (
              <ul className="mt-1.5 space-y-1">
                {sources.map((s, i) => (
                  <li key={i} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-violet-300 shrink-0" /> {s}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onUse?.(out.suggested_reply)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
              >
                <Check size={12} /> Use this reply
              </button>
              <button
                onClick={regenerate}
                disabled={suggest.isPending}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-violet-600 hover:bg-violet-100 transition-colors"
              >
                <RefreshCw size={12} /> Regenerate
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors ml-auto"
              >
                <X size={12} /> Dismiss
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
