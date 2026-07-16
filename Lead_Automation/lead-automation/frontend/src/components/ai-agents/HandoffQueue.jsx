'use client';
import { useState } from 'react';
import {
  UserCheck, CheckCircle2, XCircle, Clock, Megaphone, TrendingUp,
  Headphones, Inbox,
} from 'lucide-react';
import { useHandoffs, useUpdateHandoff } from '@/lib/queries/aiAgents';

const STATUS_TABS = [
  { key: undefined,  label: 'All'      },
  { key: 'pending',  label: 'Pending'  },
  { key: 'assigned', label: 'Assigned' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'rejected', label: 'Rejected' },
];

const AGENT_CFG = {
  marketing: { icon: Megaphone,  label: 'Marketing', tone: 'text-blue-600 bg-blue-50'       },
  sales:     { icon: TrendingUp, label: 'Sales',      tone: 'text-emerald-600 bg-emerald-50' },
  support:   { icon: Headphones, label: 'Support',    tone: 'text-violet-600 bg-violet-50'   },
};

const STATUS_BADGE = {
  pending:  'bg-amber-50 text-amber-700',
  assigned: 'bg-blue-50 text-blue-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-slate-100 text-slate-500',
};

function timeAgo(iso) {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function HandoffRow({ h, note, onNoteChange, onClaim, onResolve, onReject, busy }) {
  const cfg = AGENT_CFG[h.agent_type] || AGENT_CFG.support;
  const Icon = cfg.icon;
  const [showNote, setShowNote] = useState(false);

  return (
    <div className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl shrink-0 ${cfg.tone}`}>
          <Icon size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-slate-700">{h.customer_name || 'Unknown customer'}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[h.status]}`}>{h.status}</span>
            {h.channel && <span className="text-[10px] text-slate-400 capitalize">{h.channel}</span>}
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{h.original_brief}</p>
          {h.resolution_note && (
            <p className="text-xs text-slate-400 mt-1.5 italic">Note: {h.resolution_note}</p>
          )}
          <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
            <Clock size={10} /> {timeAgo(h.created_at)}
            {h.assigned_to && <span className="ml-2">· assigned to {h.assigned_to.slice(0, 8)}</span>}
          </p>

          {showNote && (
            <textarea
              value={note || ''}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Resolution note (optional)…"
              rows={2}
              className="input-premium mt-2 text-xs resize-none"
              autoFocus
            />
          )}

          <div className="flex items-center gap-2 mt-3">
            {h.status === 'pending' && (
              <button onClick={() => onClaim(h.id)} disabled={busy} className="btn-primary btn-sm">
                <UserCheck size={12} /> Claim
              </button>
            )}
            {(h.status === 'pending' || h.status === 'assigned') && (
              <>
                <button
                  onClick={() => (showNote ? onResolve(h.id) : setShowNote(true))}
                  disabled={busy}
                  className="btn-emerald btn-sm"
                >
                  <CheckCircle2 size={12} /> {showNote ? 'Confirm Resolve' : 'Resolve'}
                </button>
                <button onClick={() => onReject(h.id)} disabled={busy} className="btn-ghost btn-sm text-red-500 hover:bg-red-50">
                  <XCircle size={12} /> Reject
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HandoffQueue() {
  const [statusFilter, setStatusFilter] = useState(undefined);
  const { data, isLoading } = useHandoffs(statusFilter);
  const update = useUpdateHandoff();
  const [notes, setNotes] = useState({});

  const rows = Array.isArray(data) ? data : [];

  const claim = (id) => update.mutate({ id, status: 'assigned' });
  const resolve = (id) => update.mutate({ id, status: 'resolved', resolution_note: notes[id] || undefined });
  const reject = (id) => update.mutate({ id, status: 'rejected', resolution_note: notes[id] || undefined });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Human Handoff Queue</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Conversations any agent flagged for human review — claim, resolve, or reject
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => setStatusFilter(t.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
                statusFilter === t.key
                  ? 'bg-white shadow-sm text-slate-800 border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden divide-y divide-slate-50">
        {isLoading && (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-2xl bg-slate-50 mb-3">
              <Inbox size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">No handoff requests</p>
            <p className="text-xs text-slate-300 mt-1">
              Agents create one automatically when they flag <code>human_handoff</code> or an escalation
            </p>
          </div>
        )}

        {!isLoading && rows.map((h) => (
          <HandoffRow
            key={h.id}
            h={h}
            note={notes[h.id]}
            onNoteChange={(v) => setNotes((p) => ({ ...p, [h.id]: v }))}
            onClaim={claim}
            onResolve={resolve}
            onReject={reject}
            busy={update.isPending}
          />
        ))}
      </div>
    </div>
  );
}
