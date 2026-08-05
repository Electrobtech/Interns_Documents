// Shared building blocks for the Super Admin Analytics tabs (Sales AI /
// Marketing AI / Support AI / Finance & Billing). Kept intentionally
// small and dependency-free — same Card/Badge primitives the existing
// Overview tab already uses, no new UI kit.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function money(n) {
  if (n == null) return '—';
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function pct(n, digits = 1) {
  if (n == null) return '—';
  return `${Number(n).toFixed(digits)}%`;
}

export function seconds(n) {
  if (n == null) return '—';
  if (n < 60) return `${n.toFixed(1)}s`;
  return `${(n / 60).toFixed(1)}m`;
}

// Tone accents per the spec: emerald for sales/finance, indigo/violet
// for marketing, amber/blue for support.
const TONES = {
  emerald: { bg: 'from-emerald-50 to-teal-100', icon: 'text-emerald-600', val: 'text-emerald-700' },
  violet: { bg: 'from-violet-50 to-purple-100', icon: 'text-violet-600', val: 'text-violet-700' },
  amber: { bg: 'from-amber-50 to-orange-100', icon: 'text-amber-600', val: 'text-amber-700' },
  blue: { bg: 'from-sky-50 to-blue-100', icon: 'text-sky-600', val: 'text-sky-700' },
  slate: { bg: 'from-slate-50 to-slate-100', icon: 'text-slate-500', val: 'text-slate-700' },
};

export function KpiCard({ label, value, icon: Icon, tone = 'slate', hint }) {
  const t = TONES[tone] || TONES.slate;
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-6">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 truncate">{label}</p>
          <p className={`text-lg font-semibold mt-1 ${t.val}`}>{value}</p>
          {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${t.bg} shrink-0 ml-3`}>
            <Icon className={`size-5 ${t.icon}`} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SectionCard({ title, icon: Icon, children, className = '' }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {Icon && <Icon className="size-4" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function LoadingState() {
  return <p className="text-sm text-slate-400">Loading…</p>;
}

export function ErrorState({ error }) {
  return <p className="text-sm text-red-600">{error?.message || 'Something went wrong.'}</p>;
}

export function EmptyState({ children = 'No data in this range.' }) {
  return <p className="text-sm text-slate-400">{children}</p>;
}

// Wraps a tab body so every tab handles the "no custom range picked yet"
// / loading / error / data states the same way the Overview tab already
// does, without repeating the four-way ternary in every component.
export function QueryGate({ rangeParams, query, children }) {
  if (!rangeParams) return <EmptyState>Pick a custom range above.</EmptyState>;
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} />;
  return children(query.data);
}
