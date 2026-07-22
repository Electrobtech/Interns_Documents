// Minimal status pill matching the badge styling already used in DataTable.jsx.
// Kept local rather than pulling in shadcn/ui's Badge — the rest of the app has
// no shadcn setup and this one-off component is a few lines of plain Tailwind.
export default function Badge({ children, className = '', tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${tones[tone] || tones.slate} ${className}`}>
      {children}
    </span>
  );
}
