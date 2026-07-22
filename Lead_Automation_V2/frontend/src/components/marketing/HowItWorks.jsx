const STEPS = [
  { time: '02:14', title: 'It arrives', body: "Ramesh messages the WhatsApp Business number. Nobody's awake. The agent picks it up in three seconds.", dot: 'border-brand' },
  { time: '02:14', title: "It's understood", body: 'Bulk intent, returning customer, last order eight months old. Lead score 92, win probability 68% — pulled from the CRM, not guessed.', dot: 'border-brand' },
  { time: '02:15', title: "It's answered honestly", body: "The agent quotes what it can verify and stops at the discount question, because pricing approval isn't its call. That boundary is a setting you own.", dot: 'border-teal-500' },
  { time: '09:02', title: "It's waiting, not lost", body: 'Your rep opens the inbox to one thread at the top with the history summarized and a reply already drafted. She edits two words and sends.', dot: 'border-rose-500' },
];

export default function HowItWorks() {
  return (
    <section id="how" className="max-w-5xl mx-auto px-6 py-20">
      <p className="text-[10px] tracking-wide text-slate-400 uppercase" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>One real thread, start to finish</p>
      <h2 className="text-[26px] sm:text-[32px] font-semibold tracking-tight text-slate-900 mt-3 max-w-2xl" style={{ fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em' }}>
        A WhatsApp message at 2:14 AM becomes ₹4.2L of pipeline by 9
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-9 items-start">
        <div className="relative pl-6 border-l border-slate-200">
          {STEPS.map((s) => (
            <div key={s.title + s.time} className="relative pb-7 last:pb-0">
              <span className={`absolute -left-[27px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 ${s.dot}`} />
              <p className="text-[10px] tracking-wide text-slate-400" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{s.time}</p>
              <h4 className="text-[15px] font-semibold text-slate-900 mt-1 mb-1" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{s.title}</h4>
              <p className="text-[13.5px] text-slate-500 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-[13px] leading-relaxed mb-2.5 max-w-[88%]">
            <span className="block text-[8.5px] tracking-wide text-slate-400 mb-1" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>RAMESH · WHATSAPP · 02:14</span>
            Need 40 units. Can you match the quote from last quarter?
          </div>
          <p className="text-center text-[10px] text-teal-600 py-1.5" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>↓ agent matched to CRM record in 0.4s</p>
          <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-violet-50 border border-brand/20 p-3.5 text-[13px] leading-relaxed mb-2.5 ml-auto max-w-[88%]">
            <span className="block text-[8.5px] tracking-wide text-slate-400 mb-1" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>AGENT · 02:14</span>
            Hi Ramesh — good to hear from you again. I can see your March order at ₹8,400 per unit. That price still stands for 40 units, and stock is available this week.
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-[13px] leading-relaxed mb-2.5 max-w-[88%]">
            <span className="block text-[8.5px] tracking-wide text-slate-400 mb-1" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>RAMESH · 02:15</span>
            What about 15% off if I go to 60?
          </div>
          <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-violet-50 border border-brand/20 p-3.5 text-[13px] leading-relaxed ml-auto max-w-[88%]">
            <span className="block text-[8.5px] tracking-wide text-slate-400 mb-1" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>AGENT · 02:15</span>
            That's above what I'm allowed to approve, so I won't guess at it. I've flagged it for Sangeetha — she'll confirm first thing at 9. Your slot is held either way.
          </div>
          <p className="text-center text-[10px] text-amber-600 pt-2" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>↑ escalated · thread pinned · draft ready</p>
        </div>
      </div>
    </section>
  );
}
