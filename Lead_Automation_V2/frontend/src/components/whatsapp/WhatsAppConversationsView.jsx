'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Clock, MessageCircle, Plug } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { useSocketEvent } from '@/lib/socket';
import ChatListItem from './ChatListItem';
import ActiveChatPanel from './ActiveChatPanel';
import EmptyChatState from './EmptyChatState';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'handoff', label: 'Handoff' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'snoozed', label: 'Snoozed' },
];

const TIME_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
];

function withinTimeFilter(iso, filter) {
  if (filter === 'all') return true;
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  if (filter === 'today') return d.toDateString() === now.toDateString();
  if (filter === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo;
  }
  return true;
}

// QuickReply.ai-style master-detail view for the WhatsApp channel: a
// left-hand chat list (search + status/time filters) and a right-hand pane
// that shows either the selected conversation's full thread or an empty
// state. Fills the height below Topbar (h-16) rather than scrolling with
// the rest of the page.
export default function WhatsAppConversationsView() {
  const { call } = useApi();
  const [channel, setChannel] = useState(null);
  const [convos, setConvos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      call('/channels?type=whatsapp').catch(() => []),
      call('/conversations?channel=whatsapp').catch(() => []),
    ]).then(([chs, cvs]) => {
      setChannel(Array.isArray(chs) && chs.length ? chs[0] : null);
      setConvos(Array.isArray(cvs) ? cvs : []);
    }).finally(() => setLoading(false));
  }, [call]);

  useEffect(() => { load(); }, [load]);

  useSocketEvent('conversation:updated', (payload) => {
    if (payload.channel_type !== 'whatsapp') return;
    load();
  }, [load]);

  const connected = channel?.status === 'connected';

  async function toggleConnection() {
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
          body: { type: 'whatsapp', display_name: 'WhatsApp', status: 'connected' },
        });
      }
      load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return convos.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (timeFilter !== 'all' && !withinTimeFilter(c.last_message_at, timeFilter)) return false;
      if (q) {
        const name = (c.contact_name || '').toLowerCase();
        const preview = (c.last_message_preview || '').toLowerCase();
        if (!name.includes(q) && !preview.includes(q)) return false;
      }
      return true;
    });
  }, [convos, search, statusFilter, timeFilter]);

  // Keep the selected conversation's list row (timestamp/preview/status) in
  // sync when a new message lands or a status flips while the thread is open.
  const refreshList = useCallback(() => { load(); }, [load]);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Connection strip — preserves the connect/disconnect control that
          lived in the plain list view, without taking over the whole page. */}
      <div className="shrink-0 px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Plug size={13} className={connected ? 'text-emerald-500' : 'text-slate-300'} />
          <span className={connected ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
            {connected ? `Connected${channel?.display_name ? ` · ${channel.display_name}` : ''}` : 'Not connected'}
          </span>
        </div>
        <button
          onClick={toggleConnection}
          disabled={busy}
          className={`text-xs rounded-lg px-3 py-1.5 font-medium disabled:opacity-60 ${
            connected ? 'border border-slate-300 text-slate-600' : 'bg-brand text-white'}`}
        >
          {busy ? '…' : connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
      {err && <p className="text-xs text-red-500 px-4 py-1 shrink-0">{err}</p>}

      <div className="flex-1 flex min-h-0">
        {/* Left column — chat list */}
        <div className="w-[360px] shrink-0 border-r border-slate-200 flex flex-col bg-white min-h-0">
          <div className="px-4 pt-4 pb-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
              <span>Channels</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle size={17} className="text-brand" />
              <h2 className="text-base font-bold text-slate-800">WhatsApp</h2>
              <span className="text-[11px] font-semibold bg-brand text-white rounded-full px-2 py-0.5">
                {convos.length}
              </span>
            </div>
          </div>

          <div className="px-4 pb-3 shrink-0 space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[#f8fafc] px-2.5 py-1.5">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or message…"
                className="bg-transparent text-xs outline-none w-full placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5">
                <SlidersHorizontal size={12} className="text-slate-400 shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs outline-none w-full text-slate-600"
                >
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex-1 flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5">
                <Clock size={12} className="text-slate-400 shrink-0" />
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="bg-transparent text-xs outline-none w-full text-slate-600"
                >
                  {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loading && <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>}
            {!loading && filtered.length === 0 && (
              <p className="text-sm text-slate-400 py-6 text-center px-4">
                {convos.length === 0 ? 'No conversations on this channel yet.' : 'No conversations match your filters.'}
              </p>
            )}
            {!loading && filtered.map((c) => (
              <ChatListItem
                key={c.id}
                conversation={c}
                active={c.id === selectedId}
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </div>
        </div>

        {/* Right column — active chat or empty state */}
        {selectedId ? (
          <ActiveChatPanel key={selectedId} conversationId={selectedId} onConversationChanged={refreshList} />
        ) : (
          <EmptyChatState />
        )}
      </div>
    </div>
  );
}
