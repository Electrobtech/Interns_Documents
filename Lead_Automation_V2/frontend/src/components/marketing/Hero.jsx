import {
  MessageCircle, Instagram, MessageSquare, Send, Globe, Mail, Smartphone,
  Phone, ArrowRight, CheckCircle2, Clock, TrendingUp, PlayCircle,
} from 'lucide-react';

const CHANNELS = [
  { icon: MessageCircle, label: 'WhatsApp', count: 148, dot: '#25D366' },
  { icon: Instagram, label: 'Instagram', count: 61, dot: '#E1306C' },
  { icon: MessageSquare, label: 'Messenger', count: 34, dot: '#0084FF' },
  { icon: Send, label: 'Telegram', count: 12, dot: '#2AABEE' },
  { icon: Globe, label: 'Web chat', count: 79, dot: '#8B5CF6' },
  { icon: Mail, label: 'Email', count: 44, dot: '#22D3EE' },
  { icon: Smartphone, label: 'SMS', count: 18, dot: '#FBBF24' },
  { icon: Phone, label: 'Voice calls', count: 11, dot: '#34D399' },
];

const OUTCOMES = [
  { icon: CheckCircle2, tone: 'emerald', title: 'Done — nobody touched it', meta: '1,062 in the last minute · 82.6% of everything' },
  { icon: Clock, tone: 'amber', title: 'Your turn — reply is drafted', meta: '84 waiting · median wait 2m 11s' },
  { icon: TrendingUp, tone: 'rose', title: 'Real buyer — sent to sales', meta: '138 qualified · ₹42.8L pipeline added' },
];

const ICON_TONE = { emerald: 'text-emerald-400', amber: 'text-amber-400', rose: 'text-rose-400' };

function StackDiagram() {
  return (
    <div className="mt-12 rounded-2xl bg-[#12163A] border border-white/[0.08] shadow-[0_30px_80px_-24px_rgba(15,20,55,0.55)] p-6 sm:p-9 text-left">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-7">
        <h3 className="text-[13px] font-semibold text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          One platform, three layers, nothing to integrate
        </h3>
        <span className="text-[9.5px] tracking-[0.12em] text-white/35" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
          LIVE · ROLLING 60S · ANONYMIZED
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-7 items-center">
        {/* channels in */}
        <div className="space-y-1.5">
          {CHANNELS.map((c) => (
            <div key={c.label} className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 hover:bg-white/[0.07] transition-colors">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
              <c.icon size={12} className="text-white/50 shrink-0" />
              <span className="text-[11.5px] font-medium text-white/85 flex-1 truncate">{c.label}</span>
              <span className="text-[9.5px] text-white/30" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{c.count}</span>
            </div>
          ))}
        </div>

        {/* stack middle */}
        <div className="flex flex-col gap-2.5 lg:w-64">
          <div className="rounded-lg bg-gradient-to-br from-[#3E63FF] to-[#2440C4] px-4 py-3.5 text-center shadow-[0_8px_24px_-8px_rgba(62,99,255,0.5)]">
            <p className="text-[12.5px] font-semibold text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Every channel, one inbox</p>
            <p className="text-[8.5px] tracking-wide text-white/55 mt-1" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>ONE THREAD · NO REPEATING THEMSELVES</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#5B2ECC] px-4 py-3.5 text-center shadow-[0_8px_24px_-8px_rgba(139,92,246,0.5)] ring-1 ring-white/10">
            <p className="text-[12.5px] font-semibold text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }}>The AI reads it and decides</p>
            <p className="text-[8.5px] tracking-wide text-white/55 mt-1" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>UNDERSTANDS · VERIFIES · REPLIES OR ESCALATES</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-[#14B8A6] to-[#0A7A6C] px-4 py-3.5 text-center shadow-[0_8px_24px_-8px_rgba(20,184,166,0.5)]">
            <p className="text-[12.5px] font-semibold text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Your CRM, always current</p>
            <p className="text-[8.5px] tracking-wide text-white/55 mt-1" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>EVERY REPLY WRITES BACK</p>
          </div>
        </div>

        {/* outcomes out */}
        <div className="space-y-2">
          {OUTCOMES.map((o) => (
            <div key={o.title} className="rounded-lg border border-white/[0.07] bg-white/[0.035] px-3.5 py-3">
              <div className="flex items-center gap-2">
                <o.icon size={13} className={ICON_TONE[o.tone]} />
                <p className="text-[12px] font-semibold text-white/90">{o.title}</p>
              </div>
              <p className="text-[9px] text-white/35 mt-1" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{o.meta}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-7 flex-wrap mt-7 pt-5 border-t border-white/[0.07]">
        {["ONE STACK — NO CHATBOT + CRM + CAMPAIGN TOOL TO SYNC", 'SETUP SAME AFTERNOON', 'KEEP YOUR EXISTING NUMBER'].map((t) => (
          <span key={t} className="text-[9px] tracking-[0.08em] text-white/30" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <div className="relative pt-20 pb-4 px-6 text-center overflow-hidden">
      <div
        className="absolute inset-x-0 -top-40 -bottom-40 -z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(32% 44% at 18% 22%, rgba(37,71,232,.08), transparent 68%), radial-gradient(28% 40% at 84% 16%, rgba(109,58,232,.07), transparent 70%), radial-gradient(26% 36% at 60% 80%, rgba(14,156,136,.06), transparent 70%)',
        }}
      />
      <div className="max-w-4xl mx-auto">
        <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.1em] text-slate-500 border border-slate-200 bg-white px-3 py-1.5 rounded-full shadow-[0_1px_2px_rgba(16,19,34,0.04)]" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
          AI-POWERED LEAD AUTOMATION & CRM
        </span>

        <h1
          className="mx-auto mt-7 mb-5 max-w-2xl text-[36px] sm:text-[48px] lg:text-[58px] font-semibold tracking-tight leading-[1.08] text-slate-900"
          style={{ fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.03em' }}
        >
          Every lead answered.{' '}
          <span className="bg-gradient-to-r from-brand via-violet-600 to-rose-500 bg-clip-text text-transparent">Every deal tracked.</span>
        </h1>

        <p className="mx-auto max-w-xl text-[16px] leading-relaxed text-slate-500">
          LeadForge is the AI layer for revenue teams — Marketing, Sales, and Support agents that read
          every channel, qualify and respond on their own, and keep your CRM current without anyone typing a thing.
        </p>
        <p className="mx-auto max-w-md text-[13px] font-medium text-slate-400 mt-3">
          Faster first response. More qualified leads. Less manual data entry.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap mt-8">
          <a href="#demo" className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-white bg-slate-900 px-5 py-3 rounded-lg shadow-[0_1px_2px_rgba(16,19,34,0.06),0_12px_24px_-10px_rgba(16,19,34,0.35)] hover:bg-slate-800 hover:-translate-y-px transition-all duration-150">
            Get started <ArrowRight size={14} />
          </a>
          <a href="#features" className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-slate-600 border border-slate-200 bg-white px-5 py-3 rounded-lg hover:border-slate-300 hover:text-slate-900 transition-colors duration-150">
            <PlayCircle size={14} className="text-slate-400" /> See the platform
          </a>
        </div>
        <p className="text-[10px] tracking-[0.08em] text-slate-400 mt-4" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
          20 MINUTES · WE&apos;LL RUN IT ON YOUR OWN MESSAGES
        </p>

        <StackDiagram />
      </div>
    </div>
  );
}
