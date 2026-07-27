'use client';
import { useState } from 'react';
import { RadioTower, Copy, Check } from 'lucide-react';

/**
 * Right column (top half) — dark "engine console" readout of the current
 * simulation session state plus the raw flow JSON that produced it. This is
 * intentionally always `MOCK FALLBACK`: there's no live automation engine
 * wired up behind this simulator, the badge is honest about that rather than
 * pretending the JSON came from a real backend run.
 */
export default function EngineDiagnostics({ sessionState, flow }) {
  const [copied, setCopied] = useState(false);
  const flowJson = JSON.stringify(flow, null, 2);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(flowJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable (permissions/http) — non-fatal for a preview panel
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0B0E11] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-slate-100 font-semibold text-[13px]">
          <RadioTower size={15} className="text-slate-400" />
          Engine Diagnostics
        </div>
        <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
          MOCK FALLBACK
        </span>
      </div>

      <div className="px-4 py-3 border-b border-slate-800">
        <p className="text-[10.5px] font-bold tracking-widest text-slate-500 mb-2">SESSION STATE</p>
        <dl className="text-[12px] font-mono space-y-1">
          {Object.entries(sessionState).map(([key, value]) => (
            <div key={key} className="flex items-baseline gap-3">
              <dt className="text-slate-400 w-[150px] shrink-0 truncate">{key}</dt>
              <dd className="text-emerald-300 break-all">{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10.5px] font-bold tracking-widest text-slate-500 truncate pr-2">
            ACTIVE FLOW — SMS — {(flow?.name || '').toUpperCase()}
          </p>
          <button
            onClick={copyJson}
            className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-2 py-1 shrink-0 transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
        </div>
        <pre className="text-[11.5px] leading-relaxed font-mono text-slate-300 max-h-72 overflow-auto whitespace-pre-wrap break-all">
          <code>{flowJson}</code>
        </pre>
      </div>
    </div>
  );
}

function formatValue(value) {
  if (Array.isArray(value)) return `[ ${value.map((v) => `"${v}"`).join(', ')} ]`;
  return String(value);
}
