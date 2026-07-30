'use client';
import { useState } from 'react';
import {
  Workflow, Sparkles, Zap, GitBranch, Play, AlertTriangle,
  ArrowRight, Check, X, RotateCcw,
} from 'lucide-react';
import { usePromptToNodes } from '@/lib/queries/aiAgents';

const EXAMPLES = [
  'When a LinkedIn lead form is submitted and budget is over $10k, send a WhatsApp template and assign it to a sales rep.',
  'When a WhatsApp message contains "pricing", reply with the pricing doc and tag the contact as hot.',
  'When a lead score goes above 70, move the deal to qualified and notify the team.',
];

// Visual language per node kind — the canvas reads left-to-right:
// Trigger (what starts it) -> Condition (branching) -> Action (what happens).
const KIND_CFG = {
  trigger: {
    label: 'Trigger', icon: Zap,
    card: 'bg-violet-50 border-violet-300',
    chip: 'bg-violet-600 text-white',
    iconCls: 'text-violet-600',
  },
  condition: {
    label: 'Condition', icon: GitBranch,
    card: 'bg-amber-50 border-amber-300',
    chip: 'bg-amber-500 text-white',
    iconCls: 'text-amber-600',
  },
  action: {
    label: 'Action', icon: Play,
    card: 'bg-emerald-50 border-emerald-300',
    chip: 'bg-emerald-600 text-white',
    iconCls: 'text-emerald-600',
  },
};

function NodeCard({ node, outgoing }) {
  const cfg = KIND_CFG[node.kind] || KIND_CFG.action;
  const Icon = cfg.icon;
  const configEntries = Object.entries(node.config || {});

  return (
    <div className={`rounded-xl border-2 ${cfg.card} p-3.5 w-full max-w-xs shadow-sm`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`p-1 rounded-md bg-white ${cfg.iconCls}`}><Icon size={12} /></div>
        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.chip}`}>
          {cfg.label}
        </span>
        {node.type && <span className="text-[10px] text-slate-400 font-mono truncate">{node.type}</span>}
      </div>
      <p className="text-sm font-semibold text-slate-800 leading-snug">{node.label}</p>
      {configEntries.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/70 space-y-0.5">
          {configEntries.map(([k, v]) => (
            <p key={k} className="text-[10px] text-slate-500 truncate">
              <span className="font-semibold">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </p>
          ))}
        </div>
      )}
      {outgoing.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {outgoing.map((e, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
              <ArrowRight size={10} />
              {e.branch ? <b className={e.branch === 'yes' ? 'text-emerald-600' : 'text-red-500'}>{e.branch}</b> : null}
              {e.to}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BuilderPage() {
  const compile = usePromptToNodes();
  const [prompt, setPrompt] = useState('');

  const out = compile.data;
  const nodes = out?.nodes || [];
  const edges = out?.edges || [];

  const run = (e) => {
    e?.preventDefault?.();
    if (prompt.trim()) compile.mutate(prompt.trim());
  };

  // Group by kind so the canvas lays out as Trigger -> Conditions -> Actions.
  const byKind = {
    trigger: nodes.filter((n) => n.kind === 'trigger'),
    condition: nodes.filter((n) => n.kind === 'condition'),
    action: nodes.filter((n) => n.kind === 'action'),
  };
  const outgoingFor = (id) => edges.filter((e) => (e.from ?? e.from_) === id);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-100 text-violet-600 shadow-sm">
          <Workflow size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Prompt-to-Workflow Builder</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Describe an automation in plain English — the agent compiles it into runnable workflow nodes
          </p>
        </div>
      </div>

      {/* Prompt input */}
      <form onSubmit={run} className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3">
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          Describe your automation
        </label>
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g. "When a LinkedIn lead form is submitted and budget is over $10k, send a WhatsApp template and assign a sales rep."'
          className="input-premium resize-none"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={compile.isPending || !prompt.trim()}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            <Sparkles size={14} /> {compile.isPending ? 'Compiling…' : 'Build Workflow'}
          </button>
          {out && (
            <button
              type="button"
              onClick={() => { setPrompt(''); compile.reset(); }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100"
            >
              <RotateCcw size={12} /> Clear
            </button>
          )}
        </div>

        {/* Examples */}
        {!out && !compile.isPending && (
          <div className="pt-1">
            <p className="text-[11px] text-slate-400 mb-1.5">Try an example:</p>
            <div className="flex flex-col gap-1.5">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  className="text-left text-xs text-violet-600 hover:text-violet-800 hover:underline"
                >
                  “{ex}”
                </button>
              ))}
            </div>
          </div>
        )}

        {compile.isError && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
            <AlertTriangle size={13} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{compile.error?.message}</p>
          </div>
        )}
      </form>

      {/* Loading */}
      {compile.isPending && (
        <div className="bg-white rounded-2xl border border-violet-100 shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-100 flex items-center justify-center mx-auto mb-3">
            <Workflow size={24} className="text-violet-500 animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Compiling your workflow…</p>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      )}

      {/* Compiled canvas */}
      {out && !compile.isPending && (
        <div className="space-y-4 animate-slide-up">
          {/* Summary bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-800">{out.workflow_name}</h3>
                {out.summary && <p className="text-sm text-slate-600 mt-1 leading-relaxed">{out.summary}</p>}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold shrink-0">
                <span className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700">{byKind.trigger.length} trigger</span>
                <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700">{byKind.condition.length} condition</span>
                <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">{byKind.action.length} action</span>
              </div>
            </div>

            {Array.isArray(out.warnings) && out.warnings.length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">
                  <AlertTriangle size={12} /> Needs your input
                </p>
                <ul className="space-y-1">
                  {out.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0 mt-1.5" /> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Node canvas */}
          {nodes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-10 text-center">
              <X size={22} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No workflow could be derived from that description.</p>
              <p className="text-xs text-slate-400 mt-1">Try naming a trigger event and what should happen.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 overflow-x-auto">
              <div className="flex items-start gap-4 min-w-max">
                {['trigger', 'condition', 'action'].map((kind, colIdx) => {
                  const group = byKind[kind];
                  if (!group.length) return null;
                  return (
                    <div key={kind} className="flex items-start gap-4">
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {KIND_CFG[kind].label}{group.length > 1 ? 's' : ''}
                        </p>
                        {group.map((n) => (
                          <NodeCard key={n.id} node={n} outgoing={outgoingFor(n.id)} />
                        ))}
                      </div>
                      {/* connector between columns */}
                      {colIdx < 2 && (byKind[kind === 'trigger' ? 'condition' : 'action'].length > 0) && (
                        <div className="flex items-center self-stretch pt-8">
                          <ArrowRight size={18} className="text-slate-300" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save note — the graph is a draft until wired into a playbook */}
          {nodes.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
              <Check size={13} className="text-emerald-500" />
              Draft compiled. Review the nodes above, then recreate it in the channel Playbook Studio to activate.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
