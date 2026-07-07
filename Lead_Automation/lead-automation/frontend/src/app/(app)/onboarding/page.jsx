'use client';
import Link from 'next/link';
import { Rocket, ArrowRight } from 'lucide-react';

export default function OnboardingPage() {
  return (
    <div className="p-6">
      <div className="max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center mt-8">
        <div className="w-16 h-16 rounded-2xl bg-brand-light text-brand grid place-items-center mx-auto mb-4">
          <Rocket size={30} />
        </div>
        <h1 className="text-xl font-bold text-brand-dark">Welcome to Lead Automation</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          Connect your channels, automate conversations and grow your business.
        </p>
        <Link href="/channels"
          className="inline-flex items-center gap-2 bg-brand text-white rounded-lg px-5 py-2.5 text-sm font-medium">
          Get Started <ArrowRight size={16} />
        </Link>
        <div className="mt-6 grid grid-cols-3 gap-3 text-left">
          {[
            ['1. Connect channels', 'WhatsApp, Instagram, Web Chat & more'],
            ['2. Add your team', 'Invite agents and set roles'],
            ['3. Launch campaigns', 'Broadcast and automate replies'],
          ].map(([t, d]) => (
            <div key={t} className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-semibold">{t}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
