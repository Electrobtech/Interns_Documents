'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { useApi } from '@/lib/useApi';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const { call } = useApi();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | loading | error

  // Poll for an unread count in the background so the badge shows up even
  // before the user opens the dropdown.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await call('/notifications');
        if (!cancelled) setUnreadCount(data.unreadCount || 0);
      } catch {
        // Silent — the badge just stays as-is if the poll fails.
      }
    }
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [call]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (!next) return;

    setStatus('loading');
    try {
      const data = await call('/notifications');
      setItems(data.notifications || []);
      setUnreadCount(0);
      setStatus('idle');
      // Fire-and-forget: clears unread state server-side too.
      call('/notifications/read-all', { method: 'POST' }).catch(() => {});
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button onClick={toggleOpen} className="relative text-slate-500 hover:text-slate-700" title="Notifications">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 px-1 grid place-items-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-20 max-h-96 overflow-y-auto">
          <div className="px-4 py-3 border-b border-slate-100">
            <h4 className="text-sm font-semibold">Notifications</h4>
          </div>

          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-8">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          )}

          {status === 'error' && (
            <div className="text-xs text-red-600 px-4 py-6 text-center">Couldn't load notifications.</div>
          )}

          {status === 'idle' && items.length === 0 && (
            <div className="text-xs text-slate-400 px-4 py-6 text-center">No notifications yet.</div>
          )}

          {status === 'idle' && items.length > 0 && (
            <ul>
              {items.map((n) => (
                <li key={n.id} className="px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <p className="text-sm text-slate-800">{n.label || 'UI click notification'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {n.source} · {timeAgo(n.receivedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}