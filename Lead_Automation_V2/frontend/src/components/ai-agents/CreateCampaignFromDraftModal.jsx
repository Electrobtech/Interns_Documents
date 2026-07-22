'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Megaphone, Send, X, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useCreateCampaign } from '@/lib/queries/crm';

const CHANNELS = [
  { value: 'whatsapp',  label: 'WhatsApp'  },
  { value: 'instagram', label: 'Instagram' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'sms',       label: 'SMS / RCS' },
  { value: 'email',     label: 'Email'     },
];

const TYPES = [
  { value: 'broadcast',     label: 'Broadcast'     },
  { value: 'drip',          label: 'Drip'          },
  { value: 'transactional', label: 'Transactional' },
];

// Picks the most relevant AI-generated asset for the chosen channel, falling
// back through the other assets rather than leaving the draft empty.
function draftMessageFor(channel, assets) {
  if (!assets) return '';
  if (channel === 'email') {
    return assets.email_body || assets.social_post || assets.ad_copy || '';
  }
  return assets.social_post || assets.ad_copy || assets.email_body || '';
}

export default function CreateCampaignFromDraftModal({ out, onClose }) {
  const create = useCreateCampaign();
  const [channel, setChannel] = useState('whatsapp');
  const [name, setName] = useState((out?.campaign_summary || 'AI-generated campaign').slice(0, 60));
  const [type, setType] = useState('broadcast');
  const [messageBody, setMessageBody] = useState(draftMessageFor('whatsapp', out?.content_assets));
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [submittedForApproval, setSubmittedForApproval] = useState(false);

  const changeChannel = (v) => {
    setChannel(v);
    setMessageBody(draftMessageFor(v, out?.content_assets));
  };

  const submit = async (status) => {
    if (!name.trim() || !messageBody.trim()) return;
    setErr('');
    try {
      await create.mutateAsync({
        name: name.trim(),
        type,
        channel_type: channel,
        message_body: messageBody.trim(),
        status,
      });
      setSubmittedForApproval(status === 'needs_approval');
      setDone(true);
    } catch (ex) {
      setErr(ex.message || 'Failed to create campaign');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-lg animate-scale-in border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600">
              <Megaphone size={15} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Create Campaign from Draft</h2>
              <p className="text-[11px] text-slate-400">Review and edit before it goes to Campaigns & Broadcasts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={26} />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {submittedForApproval ? 'Campaign submitted for approval' : 'Campaign created as a draft'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {submittedForApproval
                ? 'A reviewer needs to approve it in Campaigns & Broadcasts before it can be scheduled or sent.'
                : "Find it in Campaigns & Broadcasts to schedule or send it."}
            </p>
            <div className="flex gap-2 justify-center mt-5">
              <Link href="/app/campaigns" className="btn-primary btn-sm">
                <Megaphone size={13} /> Open Campaigns
              </Link>
              <button onClick={onClose} className="btn-ghost btn-sm">Close</button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Campaign Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-premium" autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="input-premium">
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Channel</label>
                <select value={channel} onChange={(e) => changeChannel(e.target.value)} className="input-premium">
                  {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Message Body *</label>
              <textarea rows={6} value={messageBody} onChange={(e) => setMessageBody(e.target.value)}
                className="input-premium resize-none" placeholder="Pulled from the AI-generated content assets — edit freely" />
              <p className="text-[11px] text-slate-400 mt-1.5">Pre-filled from the AI draft's content assets — review before saving.</p>
            </div>

            {err && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                <AlertTriangle size={13} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-600">{err}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => submit('draft')}
                disabled={create.isPending || !name.trim() || !messageBody.trim()}
                className="btn-ghost flex-1"
              >
                <Send size={14} />
                {create.isPending ? 'Saving…' : 'Save as Draft'}
              </button>
              <button
                type="button"
                onClick={() => submit('needs_approval')}
                disabled={create.isPending || !name.trim() || !messageBody.trim()}
                className="btn-primary flex-1"
              >
                <ShieldCheck size={14} />
                {create.isPending ? 'Submitting…' : 'Submit for Approval'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost px-5">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
