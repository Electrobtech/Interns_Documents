'use client';
import { useState } from 'react';
import { UserRound, Sparkles, AlertTriangle, Trash2, Target, Megaphone, ShieldAlert } from 'lucide-react';
import { useGeneratePersona, usePersonas, useDeletePersona } from '@/lib/queries/marketingAgent';

function asList(v) {
  return Array.isArray(v) ? v : v ? [v] : [];
}

function PersonaCard({ persona, i }) {
  const p = typeof persona === 'object' && persona ? persona : { profile: String(persona) };
  return (
    <div
      className="bg-slate-50 rounded-xl p-4 space-y-3 animate-fade-in"
      style={{ animationDelay: `${i * 60}ms` }}
    >
      <div>
        <p className="text-sm font-bold text-slate-800">{p.name || `Persona ${i + 1}`}</p>
        {p.profile && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.profile}</p>}
      </div>

      {asList(p.pain_points).length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldAlert size={11} className="text-red-400" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Pain Points</span>
          </div>
          <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
            {asList(p.pain_points).map((x, idx) => <li key={idx}>{typeof x === 'string' ? x : JSON.stringify(x)}</li>)}
          </ul>
        </div>
      )}

      {asList(p.goals).length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={11} className="text-emerald-500" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Goals</span>
          </div>
          <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
            {asList(p.goals).map((x, idx) => <li key={idx}>{typeof x === 'string' ? x : JSON.stringify(x)}</li>)}
          </ul>
        </div>
      )}

      {asList(p.preferred_channels).length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Megaphone size={11} className="text-blue-500" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Preferred Channels</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {asList(p.preferred_channels).map((x, idx) => (
              <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">
                {typeof x === 'string' ? x : JSON.stringify(x)}
              </span>
            ))}
          </div>
        </div>
      )}

      {asList(p.messaging_angles).length > 0 && (
        <div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Messaging Angles</span>
          <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5 mt-1">
            {asList(p.messaging_angles).map((x, idx) => <li key={idx}>{typeof x === 'string' ? x : JSON.stringify(x)}</li>)}
          </ul>
        </div>
      )}

      {asList(p.objections).length > 0 && (
        <div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Likely Objections</span>
          <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5 mt-1">
            {asList(p.objections).map((x, idx) => <li key={idx}>{typeof x === 'string' ? x : JSON.stringify(x)}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function PersonaPanel() {
  const generate = useGeneratePersona();
  const { data: personaSets } = usePersonas();
  const del = useDeletePersona();
  const [brief, setBrief] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!brief.trim()) return;
    generate.mutate(
      { brief: brief.trim(), name: name.trim() || undefined },
      { onSuccess: (out) => setSelected(out) },
    );
  };

  const active = selected || generate.data;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
              <UserRound size={15} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">ICP & Persona Builder</h4>
              <p className="text-[11px] text-slate-400">Grounded in your docs and real contact data</p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

          <form onSubmit={submit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Segment / Brief
              </label>
              <textarea
                rows={3}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. 'Founders of D2C e-commerce brands evaluating marketing automation'"
                className="input-premium resize-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Label (optional)
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 'D2C Founders'"
                className="input-premium"
              />
            </div>

            {generate.isError && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                <AlertTriangle size={13} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-600">{generate.error?.message}</p>
              </div>
            )}

            <button disabled={generate.isPending || !brief.trim()} className="btn-primary w-full">
              <Sparkles size={14} />
              {generate.isPending ? 'Building…' : 'Build Persona'}
            </button>
          </form>
        </div>

        {active && asList(active.personas).length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {asList(active.personas).map((p, i) => <PersonaCard key={i} persona={p} i={i} />)}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <h4 className="font-bold text-slate-800 text-sm mb-4">Saved Persona Sets</h4>
        {!personaSets?.length ? (
          <div className="text-center py-8">
            <p className="text-xs font-medium text-slate-400">No persona sets yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {personaSets.map((s, i) => (
              <div
                key={s.id}
                className="group flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 hover:bg-violet-50/50 border border-transparent hover:border-violet-100 transition-all animate-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <button
                  onClick={() => setSelected({ ...s.output, id: s.id, name: s.name })}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-xs font-semibold text-slate-700 truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(s.created_at).toLocaleString()}</p>
                </button>
                <button
                  onClick={() => del.mutate(s.id)}
                  className="text-slate-300 hover:text-red-500 shrink-0 opacity-0 group-hover:opacity-100 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
