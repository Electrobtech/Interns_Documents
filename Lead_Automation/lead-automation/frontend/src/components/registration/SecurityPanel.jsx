'use client';
import { ShieldCheck, Lock, DatabaseZap, Building } from 'lucide-react';

const POINTS = [
  { icon: Lock, title: 'Encrypted at rest & in transit', desc: 'Passwords are hashed with bcrypt; all traffic runs over HTTPS.' },
  { icon: DatabaseZap, title: 'Isolated tenant data', desc: 'Your company\u2019s conversations, contacts and campaigns never mix with another tenant\u2019s.' },
  { icon: ShieldCheck, title: 'Verified businesses only', desc: 'GST/PAN and registration documents are checked before your account goes live.' },
  { icon: Building, title: 'Built for teams', desc: 'Invite your team with role-based access after setup \u2014 Owner, Admin, Manager, Agent, Viewer.' },
];

export default function SecurityPanel() {
  return (
    <aside className="hidden xl:block w-72 shrink-0">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sticky top-6">
        <div className="w-10 h-10 rounded-xl bg-brand-light text-brand grid place-items-center mb-3">
          <ShieldCheck size={20} />
        </div>
        <h3 className="text-sm font-bold text-brand-dark">Your data is safe with us</h3>
        <p className="text-xs text-slate-400 mt-1 mb-4">Enterprise-grade security, built in from day one.</p>
        <div className="space-y-4">
          {POINTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-2.5">
              <Icon size={16} className="text-brand mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-700">{title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
