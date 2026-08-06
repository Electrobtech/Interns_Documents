'use client';
/**
 * Card and Kanban renderings of the campaign list, matching the reference's
 * three-view switcher. The table view stays in Campaigns.jsx.
 *
 * The reference draws a random sparkline per card. There is no performance
 * series behind a campaign here, so instead of inventing a trend line each
 * card shows its real budget, platforms, and item count, and the performance
 * slot says what it needs.
 */
import { MoreVertical, Eye, Pencil, Copy, GripVertical } from 'lucide-react';

import { OBJECTIVES, PLATFORMS, STATUSES } from '@/lib/queries/campaigns';
import { Card, Badge, Button, ACCENT, TONE } from './MarketingUI';
import { timeAgo } from './sections/Shared';

const STATUS_TONE = Object.fromEntries(STATUSES.map((s) => [s.value, s.tone]));
const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));
const OBJECTIVE_LABEL = Object.fromEntries(OBJECTIVES.map((o) => [o.value, o.label]));
const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.label]));

const KANBAN_COLUMNS = [
  { status: 'draft', tone: 'slate' },
  { status: 'pending_review', tone: 'amber' },
  { status: 'approved', tone: 'blue' },
  { status: 'scheduled', tone: 'blue' },
  { status: 'running', tone: 'green' },
  { status: 'paused', tone: 'amber' },
];

/* ── Card view ──────────────────────────────────────────────────────── */

export function CardView({ rows, onOpen, onEdit, onDuplicate, selected, onToggle }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((c) => (
        <Card key={c.id} hover className="p-4 flex flex-col group">
          <div className="flex items-start gap-2 mb-2">
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              onChange={() => onToggle(c.id)}
              aria-label={`Select ${c.name}`}
              className="mt-1 rounded flex-shrink-0"
            />
            <button
              onClick={() => onOpen(c.id)}
              className="text-[14px] font-semibold text-[#0F1929] hover:text-rose-600 text-left truncate flex-1"
            >
              {c.name}
            </button>
            <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status] || c.status}</Badge>
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            <Badge tone="violet">{OBJECTIVE_LABEL[c.objective] || c.objective}</Badge>
            {(c.platforms || []).slice(0, 3).map((p) => (
              <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                {PLATFORM_LABEL[p] || p}
              </span>
            ))}
            {(c.platforms?.length || 0) > 3 && (
              <span className="text-[10px] text-slate-400">+{c.platforms.length - 3}</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <Metric label="Budget" value={`${c.currency} ${Number(c.budget_amount).toLocaleString()}`} />
            <Metric label="Messages" value={c.item_count ?? 0} />
            <Metric label="Delivered" value={null} hint="needs a send provider" />
          </div>

          <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-[#EEF1F6]">
            <span className="text-[10px] text-slate-400">{timeAgo(c.updated_at)}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <IconBtn label="Open" icon={Eye} onClick={() => onOpen(c.id)} />
              <IconBtn label="Edit" icon={Pencil} onClick={() => onEdit(c.id)} />
              <IconBtn label="Duplicate" icon={Copy} onClick={() => onDuplicate(c)} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Metric({ label, value, hint }) {
  const unknown = value === null || value === undefined;
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5" title={unknown ? hint : undefined}>
      <p className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-[12px] font-mono font-semibold truncate ${unknown ? 'text-slate-300' : 'text-slate-700'}`}>
        {unknown ? '—' : value}
      </p>
    </div>
  );
}

function IconBtn({ label, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-7 h-7 rounded-lg border border-[#E4E8F0] bg-white text-slate-500
                 hover:bg-slate-50 hover:text-slate-700 transition-colors flex items-center justify-center"
    >
      <Icon size={12} />
    </button>
  );
}

/* ── Kanban view ────────────────────────────────────────────────────── */

/**
 * Columns are the campaign status machine, in order. Cards are not draggable:
 * the server enforces CAMPAIGN_TRANSITIONS, so several column pairs are
 * illegal moves, and a card that springs back after a drag is worse than one
 * that never invited the gesture. Status changes go through the row menu,
 * which greys out and explains the moves that aren't allowed.
 */
export function KanbanView({ rows, onOpen }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1 pb-2">
      <div className="flex gap-3" style={{ minWidth: KANBAN_COLUMNS.length * 232 }}>
        {KANBAN_COLUMNS.map((col) => {
          const items = rows.filter((c) => c.status === col.status);
          const t = TONE[col.tone] || TONE.slate;
          return (
            <div key={col.status} className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-2 px-1 mb-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.fg }} />
                <span className="text-[12px] font-semibold text-slate-600">
                  {STATUS_LABEL[col.status] || col.status}
                </span>
                <span className="text-[11px] text-slate-400 tabular-nums ml-auto">{items.length}</span>
              </div>

              <div className="space-y-2 rounded-xl bg-slate-50/70 p-2 min-h-[120px]">
                {items.length === 0 ? (
                  <p className="text-[11px] text-slate-300 text-center py-6">Empty</p>
                ) : (
                  items.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onOpen(c.id)}
                      className="w-full text-left rounded-xl border border-[#E4E8F0] bg-white p-3
                                 hover:shadow-sm hover:border-slate-300 transition-all"
                    >
                      <p className="text-[13px] font-semibold text-[#0F1929] truncate mb-1">{c.name}</p>
                      <p className="text-[10px] text-slate-400 truncate mb-2">
                        {(c.platforms || []).map((p) => PLATFORM_LABEL[p] || p).join(', ') || 'No platforms'}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-slate-600">
                          {c.currency} {Number(c.budget_amount).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400">{c.item_count ?? 0} msg</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
