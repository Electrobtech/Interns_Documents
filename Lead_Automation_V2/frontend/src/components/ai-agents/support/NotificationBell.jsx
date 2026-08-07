'use client';
import { useState, useRef, useEffect } from 'react';
import { Bell, Clock, AlertTriangle } from 'lucide-react';
import { useNotifications, useMarkNotificationsRead } from '@/lib/queries/notifications';

/**
 * Task 3/5 (Support Agent — Notifications): bell + unread badge + dropdown,
 * lives in the workspace header so it's visible on every tab (rendered
 * once, outside the tab content, in SupportWorkspace.jsx).
 */
export default function NotificationBell({ onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { data, isError, error } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    // Opening the dropdown clears the badge, per the task's mark-as-read spec.
    if (next && unreadCount > 0) markRead.mutate();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative p-2.5 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl border border-slate-100 shadow-card z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <h5 className="font-bold text-slate-800 text-sm">Notifications</h5>
          </div>

          {isError ? (
            <div className="flex items-center gap-2 px-4 py-4">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{error?.message || 'Failed to load notifications'}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-400">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onSelect?.(n)}
                  className="w-full text-left px-4 py-3 hover:bg-violet-50/40 transition-colors flex items-start gap-2.5"
                >
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-slate-300' : 'bg-violet-500'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {n.contact_name ? `${n.title || 'Follow-up due'} — ${n.contact_name}` : (n.title || 'Notification')}
                    </p>
                    {n.body && <p className="text-[11px] text-slate-400 truncate mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-slate-300 flex items-center gap-1 mt-1">
                      <Clock size={9} />
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
