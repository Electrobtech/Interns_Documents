const PILLARS = [
  {
    n: '01 · SUPPORT', title: 'It answers', tone: 'teal',
    body: "Agents read your docs, past tickets, and order data, then reply in the customer's language on their channel. When they're unsure, they say so and hand over with a summary instead of guessing.",
    stat: 'Median first reply', statValue: '3.1 seconds',
  },
  {
    n: '02 · SALES', title: 'It qualifies', tone: 'brand',
    body: 'Every thread is scored as it happens — intent, budget signals, urgency. Real buyers get routed to a rep with the context already written; tire-kickers get nurtured without anyone\'s time.',
    stat: 'Leads reaching a rep', statValue: '2.4× better fit',
  },
  {
    n: '03 · GROWTH', title: 'It follows up', tone: 'amber',
    body: "Campaigns run on what the conversations revealed, not on a spreadsheet from last quarter. Budget shifts to the channel that's converting, and Copilot asks before it spends.",
    stat: 'Wasted campaign spend', statValue: '–41%',
  },
];

const TONE = {
  teal: { chip: 'bg-teal-50 text-teal-600', text: 'text-teal-600' },
  brand: { chip: 'bg-blue-50 text-brand', text: 'text-brand' },
  amber: { chip: 'bg-amber-50 text-amber-600', text: 'text-amber-600' },
};

export default function Pillars() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-24">
      <p className="text-[10px] tracking-[0.1em] text-slate-400 uppercase" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
        What you're actually buying
      </p>
      <h2 className="text-[28px] sm:text-[33px] font-semibold tracking-tight text-slate-900 mt-3 mb-3 max-w-2xl" style={{ fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em' }}>
        Three jobs, one system, no handoff tax
      </h2>
      <p className="text-slate-500 leading-relaxed max-w-xl">
        Most teams stitch a chatbot to a CRM to a campaign tool and spend the year syncing them. Here the
        same agent that answers the question already knows the deal, the history, and the budget.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
        {PILLARS.map((p) => {
          const tone = TONE[p.tone];
          return (
            <div key={p.title} className="group rounded-xl bg-white border border-slate-200/80 p-6 hover:border-slate-300 hover:shadow-[0_12px_28px_-14px_rgba(16,19,34,0.15)] hover:-translate-y-0.5 transition-all duration-200">
              <span className={`inline-block text-[10px] font-semibold tracking-wide px-2 py-1 rounded-md ${tone.chip}`} style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{p.n}</span>
              <h3 className="text-[17px] font-semibold tracking-tight text-slate-900 mt-4 mb-2" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{p.title}</h3>
              <p className="text-[13.5px] leading-relaxed text-slate-500">{p.body}</p>
              <div className="mt-5 pt-4 border-t border-slate-100 text-[10.5px] text-slate-400" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
                {p.stat} <b className={`${tone.text} text-[12px]`}>{p.statValue}</b>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
