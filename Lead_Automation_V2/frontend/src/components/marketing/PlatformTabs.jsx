'use client';
import { useState } from 'react';
import { Check, MessageCircle, Instagram, Radio, Zap, Users, Megaphone } from 'lucide-react';

const TABS = [
  {
    key: 'inbox', label: 'Omnichannel inbox', tone: 'brand', icon: MessageCircle,
    eyebrow: 'ONE INBOX', title: 'Nine channels stop being nine inboxes',
    body: "A customer who starts on Instagram and finishes on WhatsApp is one thread, one history, one person. Your team stops tab-hopping and stops asking people to repeat their order number.",
    points: [
      ['One identity across channels', 'merged automatically by number, handle, or email'],
      ['Sorted before you open it', 'sentiment, priority, and value ranked, not chronological'],
      ['Reply already drafted', 'edit and send, or rewrite it entirely'],
      ['Live translation', 'they write Kannada, your rep reads English, both sides never notice'],
    ],
    preview: [
      { name: 'Ramesh Kulkarni', msg: 'Need 40 units — can you match…', time: '2m', dot: '#25D366' },
      { name: 'Ananya Nair', msg: 'Third message about the shipment', time: '6m', dot: '#E1306C' },
      { name: 'Trident Systems', msg: 'Security questionnaire before demo', time: '14m', dot: '#22D3EE' },
      { name: 'Divya Verma', msg: 'Renewal Friday — what changed?', time: '21m', dot: '#25D366', highlight: true },
    ],
  },
  {
    key: 'agents', label: 'AI agents', tone: 'violet', icon: Zap,
    eyebrow: 'AI AGENTS', title: "You decide what it's allowed to say",
    body: "An agent isn't a black box here. You write what it knows, what it may act on, and where it must stop — in plain language, on one screen. Outside those lines it escalates instead of improvising.",
    points: [
      ['Grounded in your documents', 'every answer traceable to the page it came from'],
      ['Real tools, not scripts', 'it can check stock and book a slot, not just recite FAQs'],
      ['Test before it ships', "replay last month's real tickets against a new agent"],
      ['Pick your model', 'Claude, GPT, or Gemini, switchable per agent'],
    ],
    agentCard: {
      knows: 'Product docs, 4,180 past tickets, live order data',
      canDo: 'Track orders, check stock, quote list price, book a call',
      wont: 'Approve discounts, promise dates, discuss contracts',
      escalates: 'To Sangeetha, with a summary attached',
      model: 'Claude · fallback GPT',
    },
  },
  {
    key: 'flows', label: 'Workflows', tone: 'teal', icon: Radio,
    eyebrow: 'WORKFLOWS', title: 'Drag the boring parts into a canvas',
    body: 'Triggers, conditions, delays, API calls — and an AI decision node that reads the situation instead of matching a keyword. Build it in an afternoon, watch it run on real threads the same day.',
    points: [
      ['AI decision nodes', 'branch on intent and sentiment, not on if-this-word-appears'],
      ['Anything you already run', 'webhooks and API calls to your own systems'],
      ['Dry-run mode', 'see what a flow would have done last week before it does it live'],
    ],
    flow: ['Cart abandoned', 'AI decides: worth chasing?', 'WhatsApp nudge / Tell a rep', 'Update CRM'],
  },
  {
    key: 'crm', label: 'CRM & pipeline', tone: 'rose', icon: Users,
    eyebrow: 'CRM & PIPELINE', title: "The CRM updates itself, because it's the same system",
    body: 'Nobody logs a call. Nobody forgets to move a card. The agent that had the conversation writes the record, so your pipeline is what actually happened rather than what someone remembered on Friday.',
    points: [
      ['360° customer view', 'every message, order, and ticket on one timeline'],
      ['Scored as it happens', 'lead score and win probability from the conversation itself'],
      ['Keep Salesforce or Zoho if you want', "two-way sync, your reps don't move"],
    ],
    pipeline: [
      ['New leads', 1482, 100, 'brand'],
      ['Qualified by AI', 918, 62, 'violet'],
      ['Demo booked', 404, 41, 'teal'],
      ['Proposal sent', 212, 26, 'amber'],
      ['Won', 97, 14, 'rose'],
    ],
  },
  {
    key: 'camp', label: 'Campaigns', tone: 'amber', icon: Megaphone,
    eyebrow: 'CAMPAIGNS', title: 'It spots the budget leak and asks before fixing it',
    body: 'Broadcasts, journeys, and segments built from what your conversations actually revealed. Copilot watches the spend and flags the channel that\'s burning money — then waits for you to say yes.',
    points: [
      ['Segments from real conversations', '"asked about bulk pricing, never bought"'],
      ['Replies come back to the same inbox', 'a broadcast starts a conversation, not a dead end'],
      ["Approval-gated", "Copilot never moves your money on its own"],
    ],
    campaigns: [
      { name: 'WhatsApp broadcast', roas: '3.4× ROAS', dot: '#25D366', good: true },
      { name: 'Instagram ads', roas: '0.6× ROAS', dot: '#E1306C', good: false },
      { name: 'Email journey', roas: '2.1× ROAS', dot: '#22D3EE', good: true },
    ],
  },
];

const TONE = {
  brand: { bg: 'bg-brand', text: 'text-brand', tint: 'from-blue-50', ring: 'ring-blue-200' },
  violet: { bg: 'bg-violet-600', text: 'text-violet-600', tint: 'from-violet-50', ring: 'ring-violet-200' },
  teal: { bg: 'bg-teal-600', text: 'text-teal-600', tint: 'from-teal-50', ring: 'ring-teal-200' },
  rose: { bg: 'bg-rose-600', text: 'text-rose-600', tint: 'from-rose-50', ring: 'ring-rose-200' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-600', tint: 'from-amber-50', ring: 'ring-amber-200' },
};

function InboxPreview({ rows }) {
  return (
    <div className="w-full max-w-sm space-y-2">
      {rows.map((r) => (
        <div key={r.name} className={`flex items-center gap-2.5 rounded-xl bg-white border px-3 py-2.5 shadow-sm ${r.highlight ? 'border-brand/40 bg-brand/5' : 'border-slate-200'}`}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.dot }} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-slate-800 truncate">{r.name}</p>
            <p className="text-[11px] text-slate-400 truncate">{r.msg}</p>
          </div>
          <span className="text-[10px] text-slate-400 shrink-0" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{r.time}</span>
        </div>
      ))}
    </div>
  );
}

function AgentPreview({ agentCard }) {
  const rows = [
    ['KNOWS', agentCard.knows], ['CAN DO', agentCard.canDo], ["WON'T DO", agentCard.wont],
    ['ESCALATES', agentCard.escalates], ['MODEL', agentCard.model],
  ];
  return (
    <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-100">
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand via-violet-500 to-rose-400 shrink-0" />
        <b className="text-[12.5px] text-slate-800">Support agent — India</b>
        <span className="ml-auto text-[9px] text-teal-600" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>● LIVE</span>
      </div>
      <div className="p-4 grid gap-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2.5 text-[11.5px] text-slate-600">
            <b className="text-[9px] text-slate-400 w-16 shrink-0 pt-0.5 tracking-wide" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{k}</b>
            <span>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowPreview({ steps }) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      {steps.map((s, i) => (
        <div key={s} className="contents">
          <div className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-[12px] font-semibold text-slate-700 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> {s}
          </div>
          {i < steps.length - 1 && <div className="w-0.5 h-4 bg-teal-300" />}
        </div>
      ))}
    </div>
  );
}

function PipelinePreview({ pipeline }) {
  return (
    <div className="w-full max-w-sm space-y-2.5">
      {pipeline.map(([label, count, pct, tone]) => (
        <div key={label}>
          <div className="flex justify-between text-[11.5px] mb-1">
            <b className="text-slate-700 font-semibold">{label}</b>
            <span className="text-slate-400" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${TONE[tone].bg}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-slate-400 leading-relaxed pt-2">Demo → proposal is where deals stall: median 9 days, up from 5.</p>
    </div>
  );
}

function CampaignsPreview({ campaigns }) {
  return (
    <div className="w-full max-w-sm space-y-2">
      {campaigns.map((c) => (
        <div key={c.name} className="flex items-center gap-2.5 rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 shadow-sm text-[12px]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.dot }} />
          <span className="text-slate-700 font-medium flex-1">{c.name}</span>
          <em className={`not-italic text-[11px] font-semibold ${c.good ? 'text-teal-600' : 'text-rose-500'}`}>{c.roas}</em>
        </div>
      ))}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-slate-700">
        <b>Copilot:</b> Instagram is carrying the loss. Pause it and move the budget to WhatsApp?
      </div>
    </div>
  );
}

export default function PlatformTabs() {
  const [active, setActive] = useState('inbox');
  const tab = TABS.find((t) => t.key === active);
  const tone = TONE[tab.tone];

  return (
    <div id="platform" className="bg-gradient-to-b from-teal-50/50 to-transparent border-y border-slate-200">
      <section className="max-w-5xl mx-auto px-6 py-20">
        <p className="text-[10px] tracking-wide text-teal-700 uppercase" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>Inside the platform</p>
        <h2 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-slate-900 mt-3 mb-3 max-w-2xl" style={{ fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em' }}>
          Five things that used to be five tools
        </h2>
        <p className="text-slate-500 leading-relaxed max-w-xl">
          Every one of these ships in every account. There's no tier where the AI gets smarter — the
          difference is only how much volume you run and how far you bend it.
        </p>

        <div className="flex flex-wrap gap-2 mt-7">
          {TABS.map((t) => {
            const tTone = TONE[t.tone];
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`flex items-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-full border transition-all ${
                  isActive ? `text-white border-transparent ${tTone.bg}` : 'text-slate-600 border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          <div className={`p-8 flex items-center justify-center min-h-[300px] bg-gradient-to-br ${tone.tint} to-transparent border-b lg:border-b-0 lg:border-r border-slate-100`}>
            {tab.key === 'inbox' && <InboxPreview rows={tab.preview} />}
            {tab.key === 'agents' && <AgentPreview agentCard={tab.agentCard} />}
            {tab.key === 'flows' && <FlowPreview steps={tab.flow} />}
            {tab.key === 'crm' && <PipelinePreview pipeline={tab.pipeline} />}
            {tab.key === 'camp' && <CampaignsPreview campaigns={tab.campaigns} />}
          </div>
          <div className="p-8 sm:p-10">
            <p className={`text-[10px] tracking-wide ${tone.text}`} style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{tab.eyebrow}</p>
            <h3 className="text-[22px] font-semibold tracking-tight text-slate-900 mt-2.5 mb-3" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{tab.title}</h3>
            <p className="text-[13.5px] leading-relaxed text-slate-500">{tab.body}</p>
            <ul className="mt-5 space-y-3">
              {tab.points.map(([b, rest]) => (
                <li key={b} className="flex gap-2.5 text-[13.5px] text-slate-500 leading-relaxed">
                  <Check size={14} className={`shrink-0 mt-0.5 ${tone.text}`} />
                  <span><b className="text-slate-800 font-semibold">{b}</b> — {rest}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
