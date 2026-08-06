'use client';
/**
 * Shared primitives for the Marketing hub.
 *
 * Ported from the Figma export, which used dark inline styles. Everything here
 * is re-expressed in the existing AI-agents white theme so the hub reads as
 * part of the product rather than a bolted-on module:
 *   page  #F4F6FA · card white/rounded-2xl · border #E4E8F0 · text #0F1929
 *   headings Outfit · numerics JetBrains Mono · marketing accent #E11D48 (brand rose)
 */
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const ACCENT = '#E11D48';

export const TONE = {
  violet: { fg: '#E11D48', bg: '#FFF1F2' },
  blue: { fg: '#3B6EF0', bg: '#EFF4FF' },
  green: { fg: '#059669', bg: '#ECFDF5' },
  amber: { fg: '#D97706', bg: '#FFFBEB' },
  red: { fg: '#DC2626', bg: '#FEF2F2' },
  slate: { fg: '#64748B', bg: '#F8FAFC' },
};

/** Renders a value the backend may legitimately not know yet.
 *  An em-dash is honest; a zero would read as "measured and zero". */
export function fmt(v, { prefix = '', suffix = '', fallback = '—' } = {}) {
  if (v === null || v === undefined || Number.isNaN(v)) return fallback;
  return `${prefix}${typeof v === 'number' ? v.toLocaleString() : v}${suffix}`;
}

export function Card({ children, className = '', hover = false, ...rest }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-[#E4E8F0] shadow-sm ${
        hover ? 'hover:shadow-md transition-shadow duration-200' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3
          className="text-sm font-bold text-[#0F1929]"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          {title}
        </h3>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }) {
  const t = TONE[tone] || TONE.slate;
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

/** KPI tile. `trend` is optional — omit it rather than invent a movement. */
export function KpiCard({ label, value, suffix = '', prefix = '', icon: Icon, tone = 'violet', trend, note }) {
  const t = TONE[tone] || TONE.violet;
  const unknown = value === null || value === undefined;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-slate-400';

  return (
    <Card hover className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: t.bg, color: t.fg }}
        >
          {Icon && <Icon size={15} />}
        </div>
        {trend !== undefined && trend !== null && !unknown && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${trendColor}`}>
            <TrendIcon size={11} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div
        className={`text-xl font-bold mb-0.5 ${unknown ? 'text-slate-300' : 'text-[#0F1929]'}`}
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        {fmt(value, { prefix: unknown ? '' : prefix, suffix: unknown ? '' : suffix })}
      </div>
      <div className="text-[11px] text-slate-500">{label}</div>
      {note && <div className="text-[10px] text-slate-400 mt-1">{note}</div>}
    </Card>
  );
}

export function ProgressBar({ value, max = 100, tone = 'violet', height = 6 }) {
  const t = TONE[tone] || TONE.violet;
  const pct = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="w-full rounded-full bg-slate-100 overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: t.fg }}
      />
    </div>
  );
}

export function ConfidenceMeter({ value, tone = 'violet' }) {
  // value is 0-100; null means not measured.
  if (value === null || value === undefined) {
    return <div className="h-1.5 rounded-full bg-slate-100" />;
  }
  const t = TONE[tone] || TONE.violet;
  return (
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value}%`, background: `linear-gradient(90deg, ${t.fg}, ${t.fg}99)` }}
      />
    </div>
  );
}

export function Toolbar({ children }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

export function Button({ children, variant = 'ghost', icon: Icon, className = '', ...rest }) {
  const base =
    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    ghost: 'text-slate-600 border border-[#E4E8F0] bg-white hover:bg-slate-50',
    primary: 'text-white hover:opacity-90 border-0',
    danger: 'text-red-600 border border-red-200 bg-red-50 hover:bg-red-100',
    success: 'text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
  };
  const style = variant === 'primary' ? { background: `linear-gradient(135deg, ${ACCENT} 0%, #FB923C 100%)` } : undefined;
  return (
    <button className={`${base} ${variants[variant] || variants.ghost} ${className}`} style={style} {...rest}>
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {Icon && (
        <div className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center mb-3">
          <Icon size={20} />
        </div>
      )}
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {body && <p className="text-xs text-slate-400 mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Shown wherever a panel's data lives in the Node CRM rather than Orbq.
 *  Better an explicit gap than a plausible-looking fabricated number. */
export function NotConnected({ what = 'This data', where = 'the CRM' }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
      <p className="text-xs font-medium text-slate-500">{what} isn’t connected yet</p>
      <p className="text-[11px] text-slate-400 mt-1">
        It comes from {where}. Nothing is shown rather than an estimated figure.
      </p>
    </div>
  );
}

export function DataTable({ columns, rows, empty }) {
  if (!rows?.length) return empty || <EmptyState title="Nothing here yet" />;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-left">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="border-t border-[#EEF1F6] hover:bg-slate-50/70 transition-colors">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-3 text-[13px] text-slate-700 align-middle">
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Inline metric for header strips — deliberately not a card, so a row of
 *  three numbers does not read as three more panels to scan. */
export function Stat({ label, value, suffix = '', accent = false }) {
  const unknown = value === null || value === undefined;
  return (
    <div>
      <div
        className={`text-2xl font-bold leading-none ${
          unknown ? 'text-slate-300' : accent ? 'text-amber-600' : 'text-[#0F1929]'
        }`}
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        {fmt(value, { suffix: unknown ? '' : suffix })}
      </div>
      <div className="text-[11px] text-slate-400 mt-1">{label}</div>
    </div>
  );
}
