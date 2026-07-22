import {
  Megaphone, TrendingUp, Headphones, Inbox, Send, Users, GitBranch, FileText,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Megaphone, tone: 'blue',
    title: 'Marketing Agent',
    body: 'Drafts campaign copy, researches keywords, and reads sentiment from your reviews and conversations — grounded in your own documents, not generic templates.',
  },
  {
    icon: TrendingUp, tone: 'emerald',
    title: 'Sales Agent',
    body: 'Scores every lead as it comes in, explains why, and drafts the follow-up. Real buyers reach a rep with the context already written.',
  },
  {
    icon: Headphones, tone: 'violet',
    title: 'Support Agent',
    body: 'Answers from your knowledge base, classifies the ticket, and escalates with a summary the moment it\'s unsure — never guesses at a policy.',
  },
  {
    icon: Inbox, tone: 'slate',
    title: 'Omnichannel Inbox',
    body: 'WhatsApp, Instagram, Messenger, SMS, web chat, and email in one thread per customer — no tab-hopping, no repeated questions.',
  },
  {
    icon: Send, tone: 'amber',
    title: 'Campaigns & Broadcasts',
    body: 'Build a campaign, submit it for approval, and send across channels — with an audit trail and nothing dispatched without sign-off.',
  },
  {
    icon: Users, tone: 'rose',
    title: 'CRM & Pipeline',
    body: 'Contacts, leads, and deal stages update themselves from the conversations your agents are already having — no one logs a call by hand.',
  },
  {
    icon: GitBranch, tone: 'teal',
    title: 'Workflow Automation',
    body: 'A visual flow builder for capture, qualification, and routing — with human handoff and approval steps wherever you want a person in the loop.',
  },
  {
    icon: FileText, tone: 'indigo',
    title: 'Documents & Knowledge',
    body: 'Upload PDFs, policies, and past tickets once — every agent retrieves from the same source of truth, with answers traceable back to the page.',
  },
];

const TONE = {
  blue: 'bg-blue-50 text-brand',
  emerald: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  teal: 'bg-teal-50 text-teal-600',
  indigo: 'bg-indigo-50 text-indigo-600',
};

export default function FeatureGrid() {
  return (
    <section id="features" className="max-w-5xl mx-auto px-6 py-24">
      <p className="text-[10px] tracking-[0.1em] text-slate-400 uppercase" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
        The platform
      </p>
      <h2 className="text-[28px] sm:text-[33px] font-semibold tracking-tight text-slate-900 mt-3 mb-3 max-w-2xl" style={{ fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em' }}>
        Everything a revenue team needs, in one system
      </h2>
      <p className="text-slate-500 leading-relaxed max-w-xl">
        Three AI agents, one inbox, and a CRM that writes itself — instead of five separate tools you
        have to keep in sync by hand.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
        {FEATURES.map((f) => (
          <div key={f.title} className="group rounded-xl bg-white border border-slate-200/80 p-5 hover:border-slate-300 hover:shadow-[0_12px_28px_-14px_rgba(16,19,34,0.15)] hover:-translate-y-0.5 transition-all duration-200">
            <div className={`w-9 h-9 rounded-lg grid place-items-center ${TONE[f.tone]}`}>
              <f.icon size={16} />
            </div>
            <h3 className="text-[14.5px] font-semibold tracking-tight text-slate-900 mt-4 mb-1.5" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{f.title}</h3>
            <p className="text-[12.5px] leading-relaxed text-slate-500">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
