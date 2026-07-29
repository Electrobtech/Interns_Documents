'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MessageCircle, Instagram, MessageSquare, Smartphone, Globe, Phone, Mail, Plug, Linkedin,
} from 'lucide-react';
import { useApi } from '@/lib/useApi';

const CHANNELS = [
  ['whatsapp', 'WhatsApp', MessageCircle],
  ['instagram', 'Instagram', Instagram],
  ['messenger', 'Messenger', MessageSquare],
  ['linkedin', 'LinkedIn', Linkedin],
  ['sms', 'SMS / RCS', Smartphone],
  ['webchat', 'Web Chat', Globe],
  ['voice', 'Voice Call', Phone],
  ['email', 'Email', Mail],
];

export default function ConnectChannelsPage() {
  const { call } = useApi();
  const [channels, setChannels] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    call('/channels').then((d) => setChannels(Array.isArray(d) ? d : [])).catch(() => {});
    call('/integrations').then((d) => setIntegrations(Array.isArray(d) ? d : [])).catch(() => {});
  }, [call]);
  useEffect(() => { load(); }, [load]);

  const byType = (t) => channels.find((c) => c.type === t);

  async function toggle(type, label) {
    setBusy(type);
    const ch = byType(type);
    try {
      if (ch) {
        await call(`/channels/${ch.id}`, { method: 'PUT', body: { status: ch.status === 'connected' ? 'disconnected' : 'connected' } });
      } else {
        await call('/channels', { method: 'POST', body: { type, display_name: label, status: 'connected' } });
      }
      load();
    } finally { setBusy(''); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Plug size={20} className="text-brand" />
        <h2 className="text-lg font-bold">Connect Channels</h2>
      </div>
      <p className="text-sm text-slate-500 -mt-4">Unify all your customer touchpoints in one inbox.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {CHANNELS.map(([type, label, Icon]) => {
          const ch = byType(type);
          const connected = ch?.status === 'connected';
          return (
            <div key={type} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-xl grid place-items-center mb-2 ${connected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                <Icon size={22} />
              </div>
              <p className="text-sm font-medium">{label}</p>
              <p className={`text-[11px] mb-2 ${connected ? 'text-emerald-600' : 'text-slate-400'}`}>
                {connected ? 'Connected' : 'Not connected'}
              </p>
              <div className="flex gap-2">
                {type === 'email' ? (
                  // Email connects via real Gmail OAuth (one or more actual
                  // mailboxes), not the generic fake on/off toggle every
                  // other channel here uses — send them to the dedicated
                  // page where that flow (and mailbox list) actually lives.
                  <Link href="/app/channels/email"
                    className={`text-xs rounded-lg px-3 py-1.5 font-medium ${
                      connected ? 'border border-slate-300 text-slate-600' : 'bg-brand text-white'}`}>
                    {connected ? 'Open' : 'Connect'}
                  </Link>
                ) : (
                  <>
                    <button onClick={() => toggle(type, label)} disabled={busy === type}
                      className={`text-xs rounded-lg px-3 py-1.5 font-medium disabled:opacity-60 ${
                        connected ? 'border border-slate-300 text-slate-600' : 'bg-brand text-white'}`}>
                      {busy === type ? '…' : connected ? 'Disconnect' : 'Connect'}
                    </button>
                    {connected && (
                      <Link href={`/app/channels/${type}`} className="text-xs rounded-lg px-3 py-1.5 border border-slate-300 text-slate-600">Open</Link>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <p className="font-semibold text-sm mb-3">Other Integrations</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {integrations.map((i) => (
            <div key={i.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <span className="text-sm font-medium capitalize">{i.provider.replace('_', ' ')}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${i.status === 'connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {i.status}
              </span>
            </div>
          ))}
          {integrations.length === 0 && <p className="text-xs text-slate-400">No integrations yet — add them under Integrations & APIs.</p>}
        </div>
      </div>
    </div>
  );
}