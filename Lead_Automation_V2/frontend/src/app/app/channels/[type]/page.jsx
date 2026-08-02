'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  MessageCircle, Instagram, MessageSquare, Smartphone, Globe, Phone, Mail, Linkedin,
} from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { useSocketEvent } from '@/lib/socket';
import ConversationList from '@/components/ConversationList';
import EmailPanel from '@/components/EmailPanel';
import SmsPanel from '@/components/SmsPanel';
import WhatsAppConversationsView from '@/components/whatsapp/WhatsAppConversationsView';

const META = {
  whatsapp:  { label: 'WhatsApp', icon: MessageCircle },
  instagram: { label: 'Instagram', icon: Instagram },
  messenger: { label: 'Messenger', icon: MessageSquare },
  linkedin:  { label: 'LinkedIn', icon: Linkedin },
  sms:       { label: 'SMS / RCS', icon: Smartphone },
  webchat:   { label: 'Web Chat', icon: Globe },
  voice:     { label: 'Voice Call', icon: Phone },
  email:     { label: 'Email', icon: Mail },
};

export default function ChannelPage() {
  const { type } = useParams();
  const { call } = useApi();
  const meta = META[type] || { label: type, icon: Globe };
  const Icon = meta.icon;

  // Email has its own connection model (one or more real Gmail mailboxes
  // in email_accounts, connected via Google OAuth) rather than the single
  // generic on/off toggle the other channels use — see EmailPanel.jsx.
  if (type === 'email') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Icon size={20} className="text-brand" />
          <h2 className="text-lg font-bold">{meta.label}</h2>
        </div>
        <EmailPanel />
      </div>
    );
  }

  // SMS has its own connection model (one or more connected phones in
  // sms_devices, each running a third-party forwarder app) rather than the
  // single generic on/off toggle the other channels use — see SmsPanel.jsx.
  if (type === 'sms') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Icon size={20} className="text-brand" />
          <h2 className="text-lg font-bold">{meta.label}</h2>
        </div>
        <SmsPanel />
      </div>
    );
  }

  // WhatsApp gets its own QuickReply.ai-style master-detail layout instead
  // of the generic connection-card + plain-list view other channels use —
  // see WhatsAppConversationsView.jsx. It renders full-bleed (no page
  // padding, own height calc) since it manages a two-pane layout internally.
  if (type === 'whatsapp') {
    return <WhatsAppConversationsView />;
  }

  return <GenericChannelPage type={type} meta={meta} call={call} />;
}

function GenericChannelPage({ type, meta, call }) {
  const Icon = meta.icon;
  const [channel, setChannel] = useState(null);
  const [convos, setConvos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      call(`/channels?type=${type}`).catch(() => []),
      call(`/conversations?channel=${type}`).catch(() => []),
    ]).then(([chs, cvs]) => {
      setChannel(Array.isArray(chs) && chs.length ? chs[0] : null);
      setConvos(Array.isArray(cvs) ? cvs : []);
    }).finally(() => setLoading(false));
  }, [call, type]);

  useEffect(() => { load(); }, [load]);

  // Live updates — see services/inbox-service/src/realtime.js. Filters to
  // this channel since 'conversation:updated' fires org-wide for every
  // channel, not just WhatsApp.
  useSocketEvent('conversation:updated', (payload) => {
    if (payload.channel_type !== type) return;
    load();
  }, [type, load]);

  const connected = channel?.status === 'connected';

  async function toggle() {
    setBusy(true);
    setErr('');
    try {
      if (channel) {
        await call(`/channels/${channel.id}`, {
          method: 'PUT',
          body: { status: connected ? 'disconnected' : 'connected' },
        });
      } else {
        await call('/channels', {
          method: 'POST',
          body: { type, display_name: meta.label, status: 'connected' },
        });
      }
      load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Icon size={20} className="text-brand" />
        <h2 className="text-lg font-bold">{meta.label}</h2>
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      {/* Connection status card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg grid place-items-center ${connected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            <Icon size={20} />
          </div>
          <div>
            <p className="text-sm font-medium">{channel?.display_name || meta.label}</p>
            <p className={`text-xs ${connected ? 'text-emerald-600' : 'text-slate-400'}`}>
              {connected ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>
        <button onClick={toggle} disabled={busy}
          className={`text-sm rounded-lg px-4 py-2 font-medium disabled:opacity-60 ${
            connected ? 'border border-slate-300 text-slate-600' : 'bg-brand text-white'}`}>
          {busy ? '…' : connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {/* Conversations on this channel */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="font-semibold text-sm mb-2">Conversations</p>
        <ConversationList items={convos} loading={loading} basePath={`/app/channels/${type}`} />
      </div>
    </div>
  );
}
