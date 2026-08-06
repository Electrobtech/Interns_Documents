'use client';
import { CheckCircle2, XCircle } from 'lucide-react';

// ─── Status Dot ──────────────────────────────────────────────────────────────
export function StatusDot({ status }) {
  const map = { active: '#10B981', idle: '#F59E0B', paused: '#94A3B8', error: '#EF4444' };
  const color = map[status] || '#10B981';
  return (
    <span className="relative inline-flex items-center justify-center w-2.5 h-2.5">
      <span className="absolute inset-0 rounded-full" style={{ background: color, opacity: 0.3, animation: status === 'active' ? 'ping-slow 2.8s ease-out infinite' : undefined }} />
      <span className="relative w-2 h-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'default' }) {
  const v = {
    default: 'bg-slate-100 text-slate-600',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
    error: 'bg-red-50 text-red-700',
    info: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${v[variant] || v.default}`}>{children}</span>;
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', style }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E4E8F0] shadow-sm ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardHover({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E4E8F0] shadow-sm hover:shadow-md transition-all duration-200 ${className}`}>
      {children}
    </div>
  );
}

// ─── Section Title ────────────────────────────────────────────────────────────
export function SectionTitle({ children, className = '' }) {
  return (
    <h3 className={`font-semibold text-[#0F1929] ${className}`} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14 }}>
      {children}
    </h3>
  );
}

export function Label({ children }) {
  return <div className="text-xs text-slate-400 mb-1">{children}</div>;
}

export function Value({ children, className = '' }) {
  return <div className={`text-sm font-semibold text-[#0F1929] ${className}`}>{children}</div>;
}

export function Divider({ className = '' }) {
  return <div className={`border-t border-[#E4E8F0] ${className}`} />;
}

export function Mono({ children, color }) {
  return <span className="font-mono text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color }}>{children}</span>;
}

// ─── Confidence Meter ─────────────────────────────────────────────────────────
export function ConfidenceMeter({ value, color }) {
  const c = color ?? (value >= 85 ? '#10B981' : value >= 70 ? '#F59E0B' : '#EF4444');
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: c, animation: 'bar-grow 0.8s ease-out both', transformOrigin: 'left' }} />
    </div>
  );
}

export function ScoreBar({ label, value, max = 100, color = '#3B6EF0' }) {
  const pct = (value / max) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-semibold text-[#0F1929]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
      </div>
      <ConfidenceMeter value={pct} color={color} />
    </div>
  );
}

// ─── Tab Nav ──────────────────────────────────────────────────────────────────
export function TabNav({ tabs, active, onChange }) {
  return (
    <div className="flex items-center border-b border-[#E4E8F0] overflow-x-auto" style={{ gap: 0 }}>
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all duration-150 ${
            active === tab
              ? 'border-[#3B6EF0] text-[#3B6EF0]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ─── Workspace Header ─────────────────────────────────────────────────────────
export function WorkspaceHeader({
  name, icon, badge, confidence, color, bgColor, description,
  onExport, exportBusy, onBadgeClick, onSettingsClick,
}) {
  return (
    <div className="px-8 pt-8 pb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: bgColor }}>
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>{name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: bgColor, cursor: onBadgeClick ? 'pointer' : 'default' }}
            onClick={onBadgeClick}
            role={onBadgeClick ? 'button' : undefined}
            tabIndex={onBadgeClick ? 0 : undefined}
          >
            <StatusDot status="active" />
            <span className="text-xs font-medium" style={{ color }}>{badge}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl border" style={{ borderColor: `${color}30`, background: `${color}08` }}>
            <span className="text-xs font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color }}>{confidence}% confidence</span>
          </div>
          <button
            onClick={onExport}
            disabled={exportBusy}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 border border-[#E4E8F0] bg-white hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {exportBusy ? 'Exporting…' : 'Export'}
          </button>
          <button
            onClick={onSettingsClick}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 border border-[#E4E8F0] bg-white hover:bg-slate-50 transition-all"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Knowledge Panel ──────────────────────────────────────────────────────────
export function KnowledgePanel({ sources }) {
  const defaultSources = [
    { name: 'Product Documentation', confidence: 94, items: 47, icon: '📄' },
    { name: 'CRM & Customer Data', confidence: 88, items: 1240, icon: '🗃️' },
    { name: 'FAQs & Policies', confidence: 96, items: 128, icon: '📋' },
    { name: 'Campaign History', confidence: 82, items: 89, icon: '📊' },
    { name: 'Competitor Intelligence', confidence: 71, items: 34, icon: '🔎' },
  ];
  const list = sources ?? defaultSources;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Knowledge Sources · RAG</SectionTitle>
        <Badge variant="success">Active</Badge>
      </div>
      <div className="space-y-4">
        {list.map(s => (
          <div key={s.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-600 flex items-center gap-1.5"><span>{s.icon}</span>{s.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{s.items} items</span>
                <Mono color={s.confidence >= 85 ? '#10B981' : '#F59E0B'}>{s.confidence}%</Mono>
              </div>
            </div>
            <ConfidenceMeter value={s.confidence} />
          </div>
        ))}
      </div>
      <Divider className="my-4" />
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Last indexed: 8 min ago</span>
        <span className="text-xs text-slate-400">Coverage: 94%</span>
      </div>
    </Card>
  );
}

// ─── Brain Log ────────────────────────────────────────────────────────────────
export function BrainLog({ entries }) {
  const typeStyle = {
    thinking: 'text-blue-600 bg-blue-50',
    action: 'text-amber-700 bg-amber-50',
    output: 'text-green-700 bg-green-50',
    retrieve: 'text-purple-700 bg-purple-50',
  };
  return (
    <Card className="p-5">
      <SectionTitle className="mb-4">Agent Brain Log</SectionTitle>
      <div className="space-y-3">
        {entries.map((e, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-xs text-slate-300 w-10 shrink-0 pt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{e.time}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${typeStyle[e.type]}`}>{e.type}</span>
            <span className="text-xs text-slate-600 leading-relaxed">{e.text}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Task Queue ───────────────────────────────────────────────────────────────
export function TaskQueue({ tasks, emptyLabel = 'Nothing queued right now.' }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Task Queue</SectionTitle>
        <Badge variant="info">{tasks.filter(t => t.status !== 'done').length} pending</Badge>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'running' ? 'bg-blue-400 animate-pulse' : task.status === 'queued' ? 'bg-amber-400' : 'bg-green-400'}`} />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-slate-700 block truncate">{task.title}</span>
                {task.sub && <span className="text-[11px] text-slate-400 block truncate">{task.sub}</span>}
              </div>
              {task.priority === 'high' && <span className="text-xs text-red-500 font-medium shrink-0">High</span>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Approval Queue ───────────────────────────────────────────────────────────
export function ApprovalQueue({ items, onApprove, onReject, busyId, emptyLabel = 'Nothing waiting on review.' }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Pending Approvals</SectionTitle>
        <Badge variant="warning">{items.length} waiting</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const busy = busyId != null && busyId === item.id;
            return (
              <div key={item.id ?? i} className="p-3 rounded-xl border border-[#E4E8F0] hover:border-amber-200 transition-colors">
                <div className="text-xs font-medium text-slate-700 mb-2.5">{item.title}</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {item.agent}
                    {item.confidence != null && <> · <Mono color="#94A3B8">{item.confidence}%</Mono> confident</>}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={busy}
                      onClick={() => onReject?.(item)}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => onApprove?.(item)}
                      className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 size={12} /> Approve
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Metrics Row ──────────────────────────────────────────────────────────────
// `cta: { label, onClick }` renders a clickable link instead of the plain
// `sub` line — used by cards that are a configuration gate away from a real
// number (Pipeline Value, AI Confidence) rather than permanently empty.
export function MetricsRow({ metrics }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${metrics.length}, 1fr)` }}>
      {metrics.map(m => (
        <Card key={m.label} className="p-4">
          <div className="text-xs text-slate-400 mb-1">{m.label}</div>
          <div className="text-xl font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: m.color ?? '#0F1929' }}>{m.value}</div>
          {m.cta ? (
            <button
              onClick={m.cta.onClick}
              className="text-xs font-medium mt-1 hover:underline transition-colors"
              style={{ color: m.color ?? '#3B6EF0' }}
            >
              {m.cta.label}
            </button>
          ) : (
            m.sub && <div className="text-xs text-slate-400 mt-0.5">{m.sub}</div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
export function MiniBarChart({ data, color = '#3B6EF0' }) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-md" style={{ height: `${(d.value / max) * 64}px`, background: color, opacity: 0.85, animation: 'bar-grow 0.8s ease-out both', transformOrigin: 'bottom' }} />
          <span className="text-xs text-slate-400 truncate w-full text-center" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Timeline Item ────────────────────────────────────────────────────────────
export function TimelineItem({ title, sub, time, icon, last = false }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
          {icon ?? <span className="w-2 h-2 rounded-full bg-slate-300" />}
        </div>
        {!last && <div className="w-px flex-1 bg-[#E4E8F0] mt-1" />}
      </div>
      <div className="pb-4 min-w-0">
        <div className="text-xs font-medium text-[#0F1929]">{title}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        <div className="text-xs text-slate-300 mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{time}</div>
      </div>
    </div>
  );
}
