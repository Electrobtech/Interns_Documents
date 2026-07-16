'use client';

const TONE_CONFIG = {
  brand: {
    iconBg: 'bg-gradient-to-br from-blue-50 to-indigo-100',
    iconColor: 'text-blue-600',
    accent: 'bg-blue-600',
    glow: 'hover:shadow-brand',
    border: 'hover:border-blue-200',
    valueSub: 'text-blue-600',
  },
  emerald: {
    iconBg: 'bg-gradient-to-br from-emerald-50 to-teal-100',
    iconColor: 'text-emerald-600',
    accent: 'bg-emerald-500',
    glow: 'hover:shadow-emerald',
    border: 'hover:border-emerald-200',
    valueSub: 'text-emerald-600',
  },
  amber: {
    iconBg: 'bg-gradient-to-br from-amber-50 to-orange-100',
    iconColor: 'text-amber-600',
    accent: 'bg-amber-500',
    glow: 'hover:shadow-amber',
    border: 'hover:border-amber-200',
    valueSub: 'text-amber-600',
  },
  violet: {
    iconBg: 'bg-gradient-to-br from-violet-50 to-purple-100',
    iconColor: 'text-violet-600',
    accent: 'bg-violet-500',
    glow: 'hover:shadow-violet',
    border: 'hover:border-violet-200',
    valueSub: 'text-violet-600',
  },
  slate: {
    iconBg: 'bg-gradient-to-br from-slate-50 to-slate-100',
    iconColor: 'text-slate-500',
    accent: 'bg-slate-400',
    glow: 'hover:shadow-card-hover',
    border: 'hover:border-slate-300',
    valueSub: 'text-slate-500',
  },
};

export default function KpiCard({ icon: Icon, label, value, sublabel, tone = 'brand', loading }) {
  const cfg = TONE_CONFIG[tone] || TONE_CONFIG.brand;

  return (
    <div
      className={`
        group relative bg-white rounded-2xl border border-slate-100 p-5 shadow-card
        transition-all duration-200 hover:-translate-y-0.5 cursor-default overflow-hidden
        ${cfg.glow} ${cfg.border}
      `}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${cfg.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />

      {/* Subtle background glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top left, rgba(37,99,235,0.03) 0%, transparent 60%)' }} />

      <div className="relative flex items-start gap-4">
        {Icon && (
          <div className={`p-2.5 rounded-xl shrink-0 ${cfg.iconBg} ${cfg.iconColor} transition-transform duration-200 group-hover:scale-110`}>
            <Icon size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide leading-none mb-2">
            {label}
          </p>
          {loading ? (
            <div className="space-y-1.5">
              <div className="h-7 w-20 skeleton rounded-lg" />
              {sublabel && <div className="h-3 w-28 skeleton rounded" />}
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-800 leading-tight tabular-nums">
                {value ?? '—'}
              </p>
              {sublabel && (
                <p className="text-[11px] text-slate-400 mt-1 truncate">{sublabel}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
