import { ArrowRight } from 'lucide-react';

export default function FinalCTA() {
  return (
    <div id="demo" className="max-w-5xl mx-auto px-6 py-6">
      <section className="relative overflow-hidden rounded-2xl px-8 py-16 text-center text-white bg-[#12163A] shadow-[0_40px_100px_-30px_rgba(15,20,55,0.5)]">
        <div
          className="absolute left-1/2 -top-52 w-[620px] h-[620px] -translate-x-1/2 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(62,99,255,.28), transparent 62%)' }}
        />
        <div
          className="absolute right-0 bottom-0 w-[380px] h-[380px] translate-x-1/3 translate-y-1/3 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,.18), transparent 65%)' }}
        />
        <p className="relative text-[10px] tracking-[0.12em] text-white/40 uppercase mb-4" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
          Get started
        </p>
        <h2 className="relative text-[28px] sm:text-[38px] font-semibold tracking-tight leading-tight max-w-xl mx-auto" style={{ fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em' }}>
          Tonight, 400 people will message you.<br />Someone should answer.
        </h2>
        <p className="relative text-white/60 mt-4 mb-8 max-w-md mx-auto leading-relaxed text-[14.5px]">
          Bring a week of your real messages. We&apos;ll point an agent at them live and you&apos;ll see exactly
          what it would have resolved, escalated, and sold — before you commit to anything.
        </p>
        <div className="relative flex items-center justify-center gap-3 flex-wrap">
          <a href="#" className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-[#12163A] bg-white px-5 py-3 rounded-lg shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] hover:-translate-y-px transition-transform duration-150">
            Book a demo <ArrowRight size={14} />
          </a>
          <a href="#" className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-white border border-white/15 px-5 py-3 rounded-lg hover:bg-white/[0.06] transition-colors duration-150">
            Talk to an engineer
          </a>
        </div>
        <p className="relative text-[9.5px] tracking-[0.1em] text-white/35 mt-6" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
          20 MINUTES · NO SLIDES · WE&apos;LL QUOTE YOU ON THE CALL
        </p>
      </section>
    </div>
  );
}
