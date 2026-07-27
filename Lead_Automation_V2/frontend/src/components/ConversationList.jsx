'use client';
import Link from 'next/link';
import { Bot, Headset } from 'lucide-react';

// Renders a list of conversations using the dashboard's inbox-row style.
// When `basePath` is given (e.g. "/app/channels/whatsapp"), each row links
// to `${basePath}/conversation/${id}` so opening a conversation stays
// nested under Channels > WhatsApp instead of leaving the channel view.
export default function ConversationList({ items = [], loading, basePath }) {
  if (loading) return <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>;
  if (!items.length) return <p className="text-sm text-slate-400 py-6 text-center">No conversations on this channel yet.</p>;

  return (
    <div className="divide-y divide-slate-100">
      {items.map((c) => {
        const name = c.contact_name || 'Unknown';
        const row = (
          <div className="flex items-center gap-3 py-3">
            <div className="w-9 h-9 rounded-full bg-slate-200 grid place-items-center text-xs font-semibold text-slate-600">
              {name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{name}</span>
                <span className="text-[10px] text-slate-400 capitalize">{c.channel_type}</span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : ''}
              </p>
            </div>
            {c.handled_by && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                c.handled_by === 'human' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                {c.handled_by === 'human' ? <Headset size={10} /> : <Bot size={10} />}
                {c.handled_by === 'human' ? 'Human' : 'Bot'}
              </span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
              c.status === 'open' ? 'bg-emerald-50 text-emerald-600'
              : c.status === 'pending' ? 'bg-amber-50 text-amber-600'
              : 'bg-slate-100 text-slate-500'}`}>{c.status}</span>
          </div>
        );

        return basePath ? (
          <Link key={c.id} href={`${basePath}/conversation/${c.id}`} className="block hover:bg-slate-50/60 -mx-1 px-1 rounded-lg transition-colors">
            {row}
          </Link>
        ) : (
          <div key={c.id}>{row}</div>
        );
      })}
    </div>
  );
}
