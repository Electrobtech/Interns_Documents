'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { useApi } from '@/lib/useApi';

const CHANNELS = ['all', 'whatsapp', 'instagram', 'messenger', 'sms', 'webchat', 'voice', 'email'];

function relTime(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const pill = (status) =>
  status === 'open' ? 'bg-emerald-50 text-emerald-600'
  : status === 'pending' ? 'bg-amber-50 text-amber-600'
  : status === 'missed' ? 'bg-red-50 text-red-500'
  : status === 'campaign' ? 'bg-indigo-50 text-indigo-500'
  : 'bg-slate-100 text-slate-500';

export default function InboxPage() {
  const { call } = useApi();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState('all');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const q = channel === 'all' ? '/conversations' : `/conversations?channel=${channel}`;
    call(q).then((d) => setRows(Array.isArray(d) ? d : [])).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [call, channel]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox size={20} className="text-brand" />
          <h2 className="text-lg font-bold">Unified Inbox</h2>
        </div>
        <select value={channel} onChange={(e) => setChannel(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm capitalize">
          {CHANNELS.map((c) => <option key={c} value={c}>{c === 'all' ? 'All Channels' : c}</option>)}
        </select>
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {loading && <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">No conversations.</p>}
        {rows.map((c) => {
          const name = c.contact_name || 'Unknown';
          return (
            <Link key={c.id} href={`/inbox/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50">
              <div className="w-9 h-9 rounded-full bg-slate-200 grid place-items-center text-xs font-semibold text-slate-600">
                {name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{c.channel_type}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{c.last_body || 'No messages yet'}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${pill(c.status)}`}>{c.status}</span>
              <span className="text-[10px] text-slate-400 w-8 text-right">{relTime(c.last_message_at)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
