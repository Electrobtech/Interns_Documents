const FAQS = [
  {
    q: 'What happens when the AI gets it wrong?',
    a: "It's built to hand over rather than improvise. You set what each agent may state, quote, or promise — outside that boundary it escalates with a summary instead of guessing. Every reply is logged with the sources it used, so a wrong answer is traceable to a wrong document, and fixing the document fixes the agent.",
  },
  {
    q: 'Can we keep our existing WhatsApp number?',
    a: 'Yes. We migrate it through the official Business API — your customers see the same number and your chat history comes with it. Migration is usually done inside a day, and we handle the Meta paperwork.',
  },
  {
    q: 'How long until it\'s live?',
    a: 'Connect a channel and point it at your docs — most teams are answering real messages the same afternoon. Full CRM migration and workflow build-out typically takes two weeks with our team.',
  },
  {
    q: 'Where does our data sit, and does it train anything?',
    a: 'Your data stays in your region — ap-south-1 by default for Indian workspaces, your own VPC on Enterprise. It is never used to train models, ours or a vendor\'s. SOC 2 Type II and ISO 27001, with the reports available under NDA.',
  },
  {
    q: 'We already have Salesforce. Does this replace it?',
    a: 'Only if you want it to. It runs as the conversation layer on top — reads and writes to your existing CRM through a two-way sync, so your reps keep their pipeline where it is. Teams without a CRM just use ours.',
  },
  {
    q: 'What does it cost?',
    a: "It's priced on conversations resolved rather than seats, so the number depends on your volume and which channels you run. We'll quote it on the demo once we've seen a week of your actual traffic — that takes about twenty minutes and you'll get a real figure, not a range.",
  },
];

export default function FAQ() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-20">
      <p className="text-[10px] tracking-wide text-slate-400 uppercase" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>Before you ask</p>
      <h2 className="text-[26px] sm:text-[32px] font-semibold tracking-tight text-slate-900 mt-3 max-w-2xl" style={{ fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em' }}>
        The questions that actually decide this
      </h2>

      <div className="mt-6 divide-y divide-slate-200">
        {FAQS.map((f, i) => (
          <details key={f.q} className="group py-4" open={i === 0}>
            <summary className="cursor-pointer list-none flex items-center gap-3 text-[15px] font-medium text-slate-900 [&::-webkit-details-marker]:hidden group-open:text-brand">
              {f.q}
              <span className="ml-auto text-slate-400 group-open:text-brand text-lg leading-none">
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">–</span>
              </span>
            </summary>
            <p className="text-[13.5px] leading-relaxed text-slate-500 mt-3 max-w-2xl">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
