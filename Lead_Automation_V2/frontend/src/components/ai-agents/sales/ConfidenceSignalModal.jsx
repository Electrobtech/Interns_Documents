'use client';
import { useState } from 'react';
import { Zap, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useUpdateSalesAgentConfig } from '@/lib/queries/aiAgents';

const SIGNAL_INFO = {
  lead_score_avg: {
    label: 'Lead fit score',
    hint: 'Average random-forest fit score across recent Sales Agent runs.',
  },
  knowledge_coverage: {
    label: 'Knowledge grounding',
    hint: 'Share of runs where the agent actually found matching knowledge-base content, instead of guessing.',
  },
  handoff_rate: {
    label: 'Resolved without handoff',
    hint: 'Share of runs the agent resolved on its own, without flagging for a human.',
  },
};

// "⚡ Wire Confidence Signal" CTA (SalesWorkspace.jsx AI Confidence card).
// Confidence is a weighted blend of whichever signals are turned on — with
// none on, the card has nothing to show and stays at its honest empty state.
export default function ConfidenceSignalModal({ config, onClose }) {
  const updateConfig = useUpdateSalesAgentConfig();
  const [signals, setSignals] = useState(
    config?.confidence_signals?.length
      ? config.confidence_signals
      : Object.keys(SIGNAL_INFO).map((key) => ({ key, enabled: false, weight: 1 }))
  );
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (key) => {
    setSaved(false);
    setSignals((s) => s.map((sig) => (sig.key === key ? { ...sig, enabled: !sig.enabled } : sig)));
  };

  const setWeight = (key, weight) => {
    setSaved(false);
    setSignals((s) => s.map((sig) => (sig.key === key ? { ...sig, weight } : sig)));
  };

  const save = async () => {
    setErr('');
    try {
      await updateConfig.mutateAsync({ confidence_signals: signals });
      setSaved(true);
    } catch (ex) {
      setErr(ex.message || 'Failed to save confidence signals');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-lg border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-sky-50 to-blue-100 text-sky-600">
              <Zap size={15} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Wire Confidence Signal</h2>
              <p className="text-[11px] text-slate-400">Pick which real signals feed the AI Confidence metric</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {signals.map((sig) => {
            const info = SIGNAL_INFO[sig.key] || { label: sig.key, hint: '' };
            return (
              <div key={sig.key} className="p-3.5 rounded-xl border border-[#E4E8F0]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{info.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{info.hint}</div>
                  </div>
                  <div
                    onClick={() => toggle(sig.key)}
                    className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors shrink-0 ml-3 ${sig.enabled ? 'bg-blue-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${sig.enabled ? 'left-4' : 'left-0.5'}`} />
                  </div>
                </div>
                {sig.enabled && (
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs text-slate-400 w-14">Weight</span>
                    <input
                      type="range" min="0" max="5" step="0.5"
                      value={sig.weight}
                      onChange={(e) => setWeight(sig.key, Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono text-slate-600 w-8 text-right">{sig.weight}×</span>
                  </div>
                )}
              </div>
            );
          })}

          {err && <div className="text-xs text-red-500 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</div>}

          <div className="flex items-center justify-between pt-1">
            {saved ? (
              <span className="text-xs text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={13} /> Saved</span>
            ) : <span />}
            <button
              onClick={save}
              disabled={updateConfig.isPending}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
            >
              {updateConfig.isPending ? 'Saving…' : 'Save signals'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
