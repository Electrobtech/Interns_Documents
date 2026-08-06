'use client';
/**
 * Shared page furniture, ported from the reference build into the white theme.
 *
 * The reference is dark (#07070f + indigo glow); everything here re-expresses
 * the same *structure* — hero card, quick-action grid, KPI strip, activity
 * feed, insight cards — against #F4F6FA / white cards, so the hub matches the
 * rest of Orbq while keeping the reference's density and hierarchy.
 *
 * Every component takes real values or nothing. Where the reference hardcoded
 * a figure, these accept `null` and render an em-dash with a reason.
 */
import { useEffect, useRef, useState } from 'react';
import {
  TrendingUp, TrendingDown, Sparkles, ArrowRight, AlertTriangle, CheckCircle2, Info,
  Search as SearchIcon, X as XIcon,
} from 'lucide-react';

import { Card, Button, ACCENT, TONE, fmt } from './MarketingUI';

/* ── Sample data marker ───────────────────────────────────────────── */

/** Shown on every tab while the hub runs on reference mock data only. */
export function SampleDataBanner() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700 shrink-0">Sample data</span>
      <p className="text-[11px] text-amber-800 leading-snug">
        Illustrative figures from the reference design — not connected to live accounts yet.
      </p>
    </div>
  );
}

/* ── Toolbar ────────────────────────────────────────────────────────── */

/**
 * The reference's sticky action bar: primary action, a run of ghost buttons,
 * then search / filter / view controls pushed right.
 *
 * It sits flush at the top of a page rather than inside a Card, which is what
 * makes the reference read as an application rather than a stack of widgets.
 */
export function Toolbar({ children, right }) {
  return (
    <div className="sticky top-[52px] z-10 -mx-7 px-7 py-2.5 bg-white/85 backdrop-blur-md border-b border-[#E4E8F0]">
      <div className="flex items-center gap-1.5 flex-wrap">
        {children}
        <div className="flex-1 min-w-[8px]" />
        {right}
      </div>
    </div>
  );
}

/** Compact ghost button sized for the toolbar run. */
export function ToolButton({ icon: Icon, children, onClick, disabled, danger, title, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium
                  border transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'border-rose-300 bg-rose-50 text-rose-700'
          : danger
            ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
            : 'border-[#E4E8F0] bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'
      }`}
    >
      {Icon && <Icon size={12} />}
      {children}
    </button>
  );
}

/** Toolbar search field — 34px, matching the reference. */
export function ToolSearch({ value, onChange, placeholder = 'Search…', width = 220 }) {
  return (
    <div className="relative" style={{ width }}>
      <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-[34px] pl-8 pr-8 rounded-lg border border-[#E4E8F0] bg-slate-50/70 text-[13px]
                   outline-none placeholder:text-slate-300 focus:bg-white focus:border-rose-300
                   focus:ring-2 focus:ring-rose-100 transition-all"
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } })}
          aria-label="Clear"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
        >
          <XIcon size={12} />
        </button>
      )}
    </div>
  );
}

/* ── Stats strip ────────────────────────────────────────────────────── */

/**
 * Inline "18 Total · 8 Active · 2 Paused" run.
 *
 * The reference uses this instead of KPI cards on list pages, and it's the
 * right call there: on a page whose subject is the table below, a row of cards
 * competes with the content for attention. A value of `null` still renders,
 * as an em-dash with its reason on hover.
 */
export function StatsStrip({ items }) {
  return (
    <div className="flex items-center gap-6 flex-wrap px-1 py-2.5">
      {items.map((s) => {
        const t = TONE[s.tone] || TONE.slate;
        const unknown = s.value === null || s.value === undefined;
        return (
          <div key={s.label} className="flex items-baseline gap-1.5" title={unknown ? s.note : undefined}>
            <span
              className="text-[18px] font-extrabold leading-none tabular-nums"
              style={{ fontFamily: "'Outfit', sans-serif", color: unknown ? '#CBD5E1' : t.fg }}
            >
              <AnimatedNumber value={s.value} prefix={s.prefix} suffix={s.suffix} />
            </span>
            <span className="text-[11px] text-slate-400">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── View switcher ──────────────────────────────────────────────────── */

/** Segmented control. `views` is [{ id, icon, label }]. */
export function ViewSwitcher({ views, value, onChange }) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg border border-[#E4E8F0] bg-slate-50">
      {views.map((v) => {
        const Icon = v.icon;
        const on = v.id === value;
        return (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            title={v.label}
            aria-pressed={on}
            className={`w-[30px] h-[28px] rounded-md flex items-center justify-center transition-all ${
              on ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
            style={on ? { background: ACCENT } : undefined}
          >
            <Icon size={13} />
          </button>
        );
      })}
    </div>
  );
}

/* ── Sub-tabs ───────────────────────────────────────────────────────── */

/** Underlined tab strip for a page's internal sections. */
export function SubTabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-[#E4E8F0] -mx-1 px-1">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`px-3.5 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
              on ? 'text-[#0F1929]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            style={on ? { borderColor: ACCENT } : undefined}
          >
            {t.label}
            {t.count !== undefined && t.count !== null && (
              <span className="ml-1.5 text-[11px] text-slate-400 tabular-nums">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Split pane ─────────────────────────────────────────────────────── */

/** Left rail + main, used by Assets and Settings in the reference. */
export function SplitPane({ aside, children, asideWidth = 208 }) {
  return (
    <div className="flex gap-5 items-start">
      <div className="flex-shrink-0" style={{ width: asideWidth }}>{aside}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/* ── Count-up ───────────────────────────────────────────────────────── */

/** Animates from 0 to `value` on mount. Skips the animation when the value is
 *  unknown, and respects prefers-reduced-motion — a number ticking up is
 *  decoration, not information. */
export function AnimatedNumber({ value, prefix = '', suffix = '', duration = 700 }) {
  const [display, setDisplay] = useState(value ?? 0);
  const raf = useRef(null);

  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(value)) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setDisplay(value); return undefined; }

    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      // easeOutCubic — fast start, gentle settle
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-slate-300">—</span>;
  }
  const rounded = Number.isInteger(value) ? Math.round(display) : Math.round(display * 10) / 10;
  return <>{prefix}{rounded.toLocaleString()}{suffix}</>;
}

/* ── Page header ────────────────────────────────────────────────────── */

/** Title + subtitle + right-aligned actions. Replaces the ad-hoc header each
 *  section was building itself, so every tab has the same top edge. */
export function PageHeader({ title, subtitle, actions, count }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1
            className="text-[22px] font-bold text-[#0F1929] tracking-[-0.02em] leading-tight"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {title}
          </h1>
          {count !== undefined && count !== null && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {count}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[12px] text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

/* ── AI hero ────────────────────────────────────────────────────────── */

/**
 * The reference's "Today's AI Summary" card, in white.
 *
 * `score`, `metrics`, and `message` are all optional: with no agent runs yet
 * there is no score to show, and the card says so rather than displaying a
 * confident 87/100 computed from nothing.
 */
export function AIHero({ title = 'AI summary', updatedAt, score, metrics = [], message, confidence, actions }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-6"
      style={{
        background: 'linear-gradient(135deg, #FFF1F2 0%, #FFF4ED 55%, #FFF7ED 100%)',
        borderColor: '#FECDD3',
      }}
    >
      <div
        className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(225,29,72,0.10) 0%, transparent 70%)' }}
      />

      <div className="relative flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, #FB7185, ${ACCENT} 55%, #FB923C)` }}
          >
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {title}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {updatedAt ? `Updated ${updatedAt}` : 'No runs yet'}
            </p>
          </div>
        </div>

        {score !== undefined && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p
                className="text-[30px] font-extrabold leading-none"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  background: `linear-gradient(135deg, #FB7185, ${ACCENT} 55%, #FB923C)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {score === null ? '—' : Math.round(score)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Avg confidence</p>
            </div>
            <ScoreRing value={score} />
          </div>
        )}
      </div>

      {metrics.length > 0 && (
        <div className="relative grid gap-2.5 mb-5" style={{ gridTemplateColumns: `repeat(${Math.min(4, metrics.length)}, minmax(0,1fr))` }}>
          {metrics.map((m) => (
            <div key={m.label} className="rounded-xl bg-white/70 border border-white px-3.5 py-2.5">
              <p className="text-[10px] text-slate-400 mb-1">{m.label}</p>
              <p className="text-[17px] font-bold text-[#0F1929] leading-none" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <AnimatedNumber value={m.value} prefix={m.prefix} suffix={m.suffix} />
              </p>
              {m.trend !== undefined && m.trend !== null && m.value !== null && (
                <p className={`flex items-center gap-1 text-[11px] mt-1 ${m.trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {m.trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {Math.abs(m.trend)}%
                </p>
              )}
              {m.note && <p className="text-[10px] text-slate-400 mt-1">{m.note}</p>}
            </div>
          ))}
        </div>
      )}

      {message && (
        <div className="relative rounded-xl bg-white/80 border border-white px-4 py-3 mb-4">
          <p className="text-[12px] text-slate-600 leading-relaxed">{message}</p>
          {confidence !== undefined && confidence !== null && (
            <div className="flex items-center gap-2 mt-2.5">
              <div className="h-1 flex-1 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(confidence * 100)}%`,
                    background: `linear-gradient(90deg, #FB7185, ${ACCENT}, #FB923C)`,
                  }}
                />
              </div>
              <span className="text-[10px] font-mono font-semibold" style={{ color: ACCENT }}>
                {Math.round(confidence * 100)}% confidence
              </span>
            </div>
          )}
        </div>
      )}

      {actions && <div className="relative flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

function ScoreRing({ value }) {
  const pct = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value)) / 100;
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="flex-shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#FFE4E6" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none" stroke="url(#hubScore)" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 26 26)"
      />
      <defs>
        <linearGradient id="hubScore" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#FB923C" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Quick actions ──────────────────────────────────────────────────── */

export function QuickActions({ actions, title = 'Quick actions' }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-bold text-[#0F1929] mb-3.5" style={{ fontFamily: "'Outfit', sans-serif" }}>
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          const t = TONE[a.tone] || TONE.violet;
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={a.disabled}
              title={a.disabled ? a.disabledReason : undefined}
              className="group flex flex-col items-start gap-2 px-3.5 py-3 rounded-xl border border-[#E4E8F0]
                         bg-white text-left transition-all hover:-translate-y-px hover:shadow-sm
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{ '--hover': t.fg }}
              onMouseEnter={(e) => { if (!a.disabled) e.currentTarget.style.borderColor = t.fg + '55'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E8F0'; }}
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: t.bg, color: t.fg }}
              >
                <Icon size={14} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-[#0F1929] truncate">{a.label}</span>
                <span className="block text-[10px] text-slate-400 truncate">{a.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ── KPI strip ──────────────────────────────────────────────────────── */

/** Dense auto-fill grid, matching the reference's strip rather than the
 *  4-column blocks the hub used before. */
export function KpiStrip({ items }) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))' }}>
      {items.map((k) => {
        const t = TONE[k.tone] || TONE.violet;
        const unknown = k.value === null || k.value === undefined;
        return (
          <Card key={k.label} hover className="p-3.5">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] text-slate-400 leading-tight">{k.label}</p>
              {k.trend !== undefined && k.trend !== null && !unknown && (
                <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${
                  k.trend >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {k.trend >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {Math.abs(k.trend)}
                </span>
              )}
            </div>
            <p
              className={`text-[19px] font-bold leading-none ${unknown ? 'text-slate-300' : 'text-[#0F1929]'}`}
              style={{ fontFamily: "'Outfit', sans-serif", color: unknown ? undefined : t.fg }}
            >
              <AnimatedNumber value={k.value} prefix={k.prefix} suffix={k.suffix} />
            </p>
            {k.note && <p className="text-[10px] text-slate-400 mt-1.5">{k.note}</p>}
          </Card>
        );
      })}
    </div>
  );
}

/* ── Activity feed ──────────────────────────────────────────────────── */

export function ActivityFeed({ items, empty }) {
  if (!items?.length) return empty || null;
  return (
    <ul className="space-y-0.5">
      {items.map((a, i) => {
        const Icon = a.icon;
        const t = TONE[a.tone] || TONE.slate;
        return (
          <li key={a.id || i} className="flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: t.bg, color: t.fg }}
            >
              {Icon ? <Icon size={13} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.fg }} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-slate-700 leading-snug">{a.text}</p>
              {a.sub && <p className="text-[11px] text-slate-400 mt-0.5">{a.sub}</p>}
            </div>
            {a.right && <span className="text-[11px] text-slate-400 flex-shrink-0">{a.right}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/* ── Insight card ───────────────────────────────────────────────────── */

const INSIGHT_META = {
  warning: { icon: AlertTriangle, tone: 'amber' },
  success: { icon: CheckCircle2, tone: 'green' },
  info: { icon: Info, tone: 'violet' },
};

/** One AI recommendation: rationale, optional confidence, and an action.
 *  `onApply` is optional — an insight with nothing to apply is still worth
 *  showing, and a dead Apply button is worse than none. */
export function InsightCard({ kind = 'info', title, body, confidence, onApply, applyLabel = 'Apply', onDetails, applied }) {
  const meta = INSIGHT_META[kind] || INSIGHT_META.info;
  const t = TONE[meta.tone];
  const Icon = meta.icon;

  return (
    <div className="rounded-xl border border-[#E4E8F0] bg-white p-3.5">
      <div className="flex items-start gap-2.5">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: t.bg, color: t.fg }}
        >
          <Icon size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#0F1929]">{title}</p>
          {body && <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">{body}</p>}

          {confidence !== undefined && confidence !== null && (
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.round(confidence * 100)}%`, background: t.fg }} />
              </div>
              <span className="text-[10px] font-mono text-slate-400">{Math.round(confidence * 100)}%</span>
            </div>
          )}

          {(onApply || onDetails) && (
            <div className="flex items-center gap-1.5 mt-2.5">
              {onApply && (
                <Button variant="primary" icon={Sparkles} onClick={onApply} disabled={applied} className="!px-3 !py-1.5 !text-[11px]">
                  {applied ? 'Applied' : applyLabel}
                </Button>
              )}
              {onDetails && (
                <Button icon={ArrowRight} onClick={onDetails} className="!px-3 !py-1.5 !text-[11px]">
                  Details
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
