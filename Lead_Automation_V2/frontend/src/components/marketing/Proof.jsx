const STATS = [
  { value: '82.6%', color: '#5EEAD4', label: 'of conversations closed without a human ever opening them' },
  { value: '2m 11s', color: '#93B0FF', label: 'median wait for the ones that do need a person' },
  { value: '4.7/5', color: '#FCD34D', label: 'CSAT across 2,140 ratings — higher than the human-only baseline' },
  { value: '₹42.8L', color: '#FDA4AF', label: 'pipeline added from threads that used to be support tickets' },
];

const QUOTES = [
  { text: "We didn't hire a night shift. We stopped needing one.", name: 'Sangeetha R.', role: 'Head of Revenue, VOC Automotive · 14 reps, 9 cities' },
  { text: 'The thing that sold us was watching it refuse to invent a discount. Our last bot would have promised anything.', name: 'Anil M.', role: 'Founder, Padmini Décor' },
  { text: 'Our CRM was three weeks stale for four years. It\'s now correct because nobody has to maintain it.', name: 'Nithya S.', role: 'Ops Lead, Trident Systems' },
];

export default function Proof() {
  return (
    <div id="proof" className="bg-[#12163A] text-white relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(36% 56% at 12% 8%, rgba(62,99,255,.22), transparent 70%), radial-gradient(30% 50% at 88% 96%, rgba(139,92,246,.14), transparent 70%)',
        }}
      />
      <section className="relative max-w-5xl mx-auto px-6 py-20">
        <p className="text-[10px] tracking-wide text-white/50 uppercase" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>Ninety days in, across 40 workspaces</p>
        <h2 className="text-[26px] sm:text-[32px] font-semibold tracking-tight mt-3 max-w-2xl" style={{ fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em' }}>
          The numbers we'd want to see before signing
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-8">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm p-5">
              <div className="text-[30px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk)', color: s.color }}>{s.value}</div>
              <div className="text-[12px] text-white/65 mt-2 leading-relaxed">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
          {QUOTES.map((q) => (
            <div key={q.name} className="rounded-2xl bg-white/[0.06] border border-white/10 p-5">
              <p className="text-[13.5px] leading-relaxed text-white/85">{q.text}</p>
              <div className="mt-4 pt-3.5 border-t border-white/10 text-[11.5px] text-white/50">
                <b className="block text-white text-[12.5px] mb-0.5">{q.name}</b>
                {q.role}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
