'use client';
/**
 * Chart primitives — inline SVG, no chart library.
 *
 * Every chart here can be in one of three states, and which one it's in is
 * always visible to the user:
 *
 *   live   — real rows from Orbq's own tables
 *   empty  — the metric needs a connected ad account or send provider, so the
 *            frame renders with an explicit reason instead of a flat line
 *   demo   — sample figures, only while the Demo data switch is on, and every
 *            such chart is visibly striped and labelled
 *
 * The demo state exists for screenshots and client walkthroughs. It is opt-in,
 * never the default, and never silently indistinguishable from live data —
 * that distinction is the whole point.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import { PlugZap } from 'lucide-react';

import { Card, ACCENT, TONE } from './MarketingUI';

/* ── Demo mode ──────────────────────────────────────────────────────── */

const DemoCtx = createContext({ demo: false, setDemo: () => {} });
export const useDemo = () => useContext(DemoCtx);

export function DemoProvider({ children }) {
  const [demo, setDemo] = useState(false);
  const value = useMemo(() => ({ demo, setDemo }), [demo]);
  return <DemoCtx.Provider value={value}>{children}</DemoCtx.Provider>;
}

export function DemoToggle() {
  const { demo, setDemo } = useDemo();
  return (
    <button
      onClick={() => setDemo(!demo)}
      title={
        demo
          ? 'Showing sample figures. Nothing here is measured.'
          : 'Fill unconnected charts with clearly-labelled sample figures'
      }
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium border transition-all ${
        demo
          ? 'border-amber-300 bg-amber-50 text-amber-800'
          : 'border-[#E4E8F0] bg-white text-slate-500 hover:bg-slate-50'
      }`}
    >
      <span
        className={`w-7 h-4 rounded-full relative transition-colors ${demo ? 'bg-amber-400' : 'bg-slate-200'}`}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${
            demo ? 'left-3.5' : 'left-0.5'
          }`}
        />
      </span>
      Demo data
    </button>
  );
}

/** Banner shown once per page while demo mode is on, so a screenshot taken
 *  from any scroll position still carries the warning somewhere obvious. */
export function DemoBanner() {
  const { demo, setDemo } = useDemo();
  if (!demo) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Demo</span>
      <p className="text-[12px] text-amber-800 flex-1">
        Charts without a connected data source are showing sample figures. Nothing on this
        page marked <em>Sample</em> is measured.
      </p>
      <button onClick={() => setDemo(false)} className="text-[12px] font-semibold text-amber-800 underline">
        Turn off
      </button>
    </div>
  );
}

/* ── Frame ──────────────────────────────────────────────────────────── */

/**
 * Wraps every chart. `series` is the real data; when it's empty the frame
 * decides between the not-connected state and the demo sample.
 */
export function ChartCard({ title, subtitle, series, sample, needs, height = 180, children, action }) {
  const { demo } = useDemo();
  const hasReal = Array.isArray(series) && series.length > 0;
  const usingDemo = !hasReal && demo && sample?.length > 0;
  const data = hasReal ? series : usingDemo ? sample : [];

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {title}
            </h3>
            {usingDemo && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                Sample
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>

      {data.length === 0 ? (
        <NotConnectedChart needs={needs} height={height} />
      ) : (
        <div className={usingDemo ? 'demo-striped rounded-xl' : ''}>
          {children(data, usingDemo)}
        </div>
      )}
    </Card>
  );
}

/** Axes with nothing plotted, plus the reason. A flat zero line would read as
 *  "measured, and it's zero" — a different and much worse claim. */
function NotConnectedChart({ needs, height }) {
  return (
    <div
      className="relative rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center px-6"
      style={{ height }}
    >
      <PlugZap size={18} className="text-slate-300 mb-2" />
      <p className="text-[12px] font-medium text-slate-500">Not connected</p>
      <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
        {needs || 'This metric needs a connected data source.'}
      </p>
    </div>
  );
}

/* ── Charts ─────────────────────────────────────────────────────────── */

/** Area + line with an emphasised endpoint. `data` is [{label, value}]. */
export function AreaChart({ data, height = 180, tone = 'violet', valueFormat = (v) => v }) {
  const t = TONE[tone] || TONE.violet;
  const values = data.map((d) => d.value ?? 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const w = 100;
  const h = 100;
  const pts = data.map((d, i) => {
    const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
    const y = h - (((d.value ?? 0) - min) / span) * h;
    return [x, y];
  });

  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = pts.at(-1);
  const gid = `g-${tone}-${data.length}`;

  return (
    <div style={{ height }} className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.fg} stopOpacity="0.22" />
            <stop offset="100%" stopColor={t.fg} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((y) => (
          <line key={y} x1="0" y1={y} x2={w} y2={y} stroke="#EEF1F6" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={t.fg} strokeWidth="2" vectorEffect="non-scaling-stroke"
              strokeLinejoin="round" strokeLinecap="round" />
        {last && <circle cx={last[0]} cy={last[1]} r="3" fill={t.fg} vectorEffect="non-scaling-stroke" />}
      </svg>

      <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
        <span>{data[0]?.label}</span>
        <span className="font-mono text-slate-600">{valueFormat(values.at(-1))}</span>
        <span>{data.at(-1)?.label}</span>
      </div>
    </div>
  );
}

/** Horizontal bars — better than vertical for named categories, since the
 *  label has room without rotating. */
export function BarList({ data, valueFormat = (v) => v.toLocaleString() }) {
  const max = Math.max(...data.map((d) => d.value ?? 0), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const t = TONE[d.tone] || TONE.violet;
        return (
          <div key={d.label}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-[12px] text-slate-600 truncate">{d.label}</span>
              <span className="text-[12px] font-mono text-slate-700 tabular-nums flex-shrink-0">
                {valueFormat(d.value ?? 0)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${((d.value ?? 0) / max) * 100}%`, background: t.fg }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Funnel with drop-off between stages — the drop is the insight, so it's
 *  labelled rather than left to be inferred from bar widths. */
export function Funnel({ stages, valueFormat = (v) => v.toLocaleString() }) {
  const top = stages[0]?.value || 1;
  return (
    <div className="space-y-1">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const drop = prev && prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : null;
        return (
          <div key={s.label}>
            {drop !== null && drop > 0 && (
              <p className="text-[10px] text-slate-400 pl-1 py-0.5">−{drop}%</p>
            )}
            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-8 rounded-lg bg-slate-100 overflow-hidden relative">
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{
                    width: `${Math.max(4, ((s.value || 0) / top) * 100)}%`,
                    background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}bb)`,
                  }}
                />
                <span className="absolute inset-0 flex items-center px-2.5 text-[11px] font-medium text-white mix-blend-luminosity">
                  {s.label}
                </span>
              </div>
              <span className="text-[12px] font-mono text-slate-700 tabular-nums w-16 text-right flex-shrink-0">
                {valueFormat(s.value || 0)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Donut for share-of-total. */
export function Donut({ data, size = 132 }) {
  const total = data.reduce((a, d) => a + (d.value || 0), 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 100 100" className="flex-shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#F1F5F9" strokeWidth="14" />
        {data.map((d) => {
          const t = TONE[d.tone] || TONE.violet;
          const len = ((d.value || 0) / total) * c;
          const el = (
            <circle
              key={d.label}
              cx="50" cy="50" r={r} fill="none" stroke={t.fg} strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <ul className="space-y-1.5 min-w-0">
        {data.map((d) => {
          const t = TONE[d.tone] || TONE.violet;
          return (
            <li key={d.label} className="flex items-center gap-2 text-[12px]">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: t.fg }} />
              <span className="text-slate-600 truncate">{d.label}</span>
              <span className="ml-auto font-mono text-slate-700 tabular-nums flex-shrink-0">
                {Math.round(((d.value || 0) / total) * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
