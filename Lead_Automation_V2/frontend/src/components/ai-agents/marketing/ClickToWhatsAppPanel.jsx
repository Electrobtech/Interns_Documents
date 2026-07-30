'use client';
import { useState } from 'react';
import { MessageCircle, Sparkles, AlertTriangle, ChevronRight, Copy, Check, Megaphone } from 'lucide-react';
import { useGenerateCTWA, useCTWAPackages } from '@/lib/queries/marketingAgent';
import { useCreateCampaign } from '@/lib/queries/crm';

function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.text || v.label || JSON.stringify(v);
  return String(v);
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text || ''); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-emerald-600 transition-colors">
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Variants({ title, items, tone }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-2">
        {list.map((v, i) => (
          <div key={i} className={`rounded-xl p-3 text-sm text-slate-700 flex items-start justify-between gap-2 ${tone}`}>
            <span className="whitespace-pre-line">{asText(v)}</span>
            <CopyBtn text={asText(v)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClickToWhatsAppPanel() {
  const generate = useGenerateCTWA();
  const { data: saved } = useCTWAPackages();
  const createCampaign = useCreateCampaign();
  const [offer, setOffer] = useState('');
  const [selected, setSelected] = useState(null);
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!offer.trim()) return;
    setSent(false);
    generate.mutate(offer.trim(), { onSuccess: (out) => setSelected(out) });
  };

  const active = selected || generate.data;

  const sendToCampaign = async () => {
    if (!active) return;
    const body = active.primary_texts?.[0] || active.instant_greeting || '';
    await createCampaign.mutateAsync({
      name: `CTWA — ${(active.offer_brief || 'Click-to-WhatsApp ad').slice(0, 50)}`,
      type: 'broadcast',
      channel_type: 'whatsapp',
      message_body: body,
      status: 'draft',
    });
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-600">
              <MessageCircle size={15} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Click-to-WhatsApp Ad Builder</h4>
              <p className="text-[11px] text-slate-400">Meta ad creative + the WhatsApp greeting that fires on tap</p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

          <form onSubmit={submit} className="space-y-3">
            <textarea value={offer} onChange={(e) => setOffer(e.target.value)} rows={3}
              placeholder="What are you promoting? e.g. 'Free 14-day trial of our WhatsApp lead automation for D2C brands'"
              className="input-premium w-full resize-none" />
            <button disabled={generate.isPending || !offer.trim()} className="btn-primary">
              <Sparkles size={14} />
              {generate.isPending ? 'Building…' : 'Generate Ad Package'}
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
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">Ad creative</p>
              <button onClick={sendToCampaign} disabled={createCampaign.isPending}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-1.5 rounded-lg hover:shadow-md transition-all disabled:opacity-50">
                <Megaphone size={13} /> {sent ? 'Sent ✓' : createCampaign.isPending ? 'Sending…' : 'Send to Campaign'}
              </button>
            </div>

            <Variants title="Primary text (A/B)" items={active.primary_texts} tone="bg-slate-50" />
            <Variants title="Headlines" items={active.headlines} tone="bg-violet-50/60" />
            <Variants title="Descriptions" items={active.descriptions} tone="bg-slate-50" />

            {active.cta_button?.label && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">CTA button</p>
                <div className="inline-flex items-center gap-2 bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-lg">
                  <MessageCircle size={14} /> {active.cta_button.label}
                </div>
                {active.cta_button.reason && <p className="text-xs text-slate-500 mt-1.5">{active.cta_button.reason}</p>}
              </div>
            )}

            <div className="h-px bg-slate-100" />
            <p className="text-sm font-bold text-slate-800">WhatsApp conversation opener</p>

            {active.prefilled_message && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Pre-filled message (user's compose box)</p>
                  <CopyBtn text={active.prefilled_message} />
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 italic">&ldquo;{active.prefilled_message}&rdquo;</div>
              </div>
            )}

            {active.instant_greeting && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Instant bot greeting</p>
                  <CopyBtn text={active.instant_greeting} />
                </div>
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {active.instant_greeting}
                </div>
              </div>
            )}

            {Array.isArray(active.qualifying_questions) && active.qualifying_questions.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Qualifying questions</p>
                <ul className="list-decimal list-inside space-y-1 text-sm text-slate-600">
                  {active.qualifying_questions.map((q, i) => <li key={i}>{asText(q)}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-600">
            <MessageCircle size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Saved packages</h4>
            <p className="text-[11px] text-slate-400">Click to review</p>
          </div>
        </div>
        {!saved?.length ? (
          <div className="text-center py-8"><p className="text-xs font-medium text-slate-400">No packages yet</p></div>
        ) : (
          <div className="space-y-2">
            {saved.map((b, i) => (
              <button key={b.id}
                onClick={() => { setSelected({ ...b.output, id: b.id, offer_brief: b.offer_brief }); setSent(false); }}
                className="w-full group flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/50 border border-transparent hover:border-emerald-100 transition-all duration-150 text-left animate-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{b.offer_brief}</p>
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
