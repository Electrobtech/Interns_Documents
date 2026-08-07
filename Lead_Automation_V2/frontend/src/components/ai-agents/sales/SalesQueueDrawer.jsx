'use client';
import { X, Clock, UserCheck } from 'lucide-react';
import { useSalesAgentQueue } from '@/lib/queries/aiAgents';

function timeLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Clicking the header's "Running · N tasks queued" badge — replaces what
// used to be inert text with the real overdue/today follow-ups + pending
// handoffs behind that number (GET /ai-agents/sales/queue).
export default function SalesQueueDrawer({ onClose }) {
  const { data, isLoading, isError } = useSalesAgentQueue();
  const items = data?.items || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full shadow-card-lg border-l border-slate-200 flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800 text-sm">Task Queue</h2>
            <p className="text-[11px] text-slate-400">
              {isLoading ? 'Loading…' : `${data?.total ?? 0} item(s) waiting on this agent`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {isError && <p className="text-xs text-red-500">Couldn&apos;t load the queue. Try again shortly.</p>}
          {!isLoading && !isError && items.length === 0 && (
            <p className="text-xs text-slate-400 py-4 text-center">Nothing queued right now.</p>
          )}
          {items.map((item) => (
            <div key={`${item.type}-${item.id}`} className="p-3 rounded-xl bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 text-slate-400 shrink-0">
                  {item.type === 'handoff' ? <UserCheck size={13} /> : <Clock size={13} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-700 font-medium truncate">{item.title}</div>
                  {item.sub && <div className="text-[11px] text-slate-400 mt-0.5">{item.sub}</div>}
                  {item.due_at && <div className="text-[11px] text-slate-300 mt-0.5">{timeLabel(item.due_at)}</div>}
                </div>
                {item.priority === 'high' && <span className="text-[11px] text-red-500 font-medium shrink-0">High</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
