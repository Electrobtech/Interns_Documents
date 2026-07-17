'use client';

// Renders a list of conversations using the dashboard's inbox-row style.
export default function ConversationList({ items = [], loading }) {
  if (loading) return <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>;
  if (!items.length) return <p className="text-sm text-slate-400 py-6 text-center">No conversations on this channel yet.</p>;

  return (
    <div className="divide-y divide-slate-100">
      {items.map((c) => {
        const name = c.contact_name || 'Unknown';
        return (
          <div key={c.id} className="flex items-center gap-3 py-3">
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
            <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
              c.status === 'open' ? 'bg-emerald-50 text-emerald-600'
              : c.status === 'pending' ? 'bg-amber-50 text-amber-600'
              : 'bg-slate-100 text-slate-500'}`}>{c.status}</span>
          </div>
        );
      })}
    </div>
  );
}
