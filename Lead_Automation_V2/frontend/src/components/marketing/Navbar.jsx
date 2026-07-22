'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { href: '#features', label: 'Product' },
  { href: '#how', label: 'How it works' },
  { href: '#integrations', label: 'Integrations' },
  { href: '#proof', label: 'Customers' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center gap-9">
        <Link href="/home" className="flex items-center gap-2.5 shrink-0">
          <span className="w-7 h-7 rounded-[7px] bg-gradient-to-br from-brand to-violet-600 grid place-items-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
            </svg>
          </span>
          <b className="text-[14px] font-semibold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            LeadForge
          </b>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden md:flex items-center gap-2">
          <Link href="/login" className="text-[13px] font-semibold px-3.5 py-[7px] rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors">
            Sign in
          </Link>
          <a href="#demo" className="text-[13px] font-semibold px-3.5 py-[7px] rounded-md text-white bg-slate-900 hover:bg-slate-800 transition-colors">
            Book a demo
          </a>
        </div>

        <button onClick={() => setOpen((v) => !v)} className="ml-auto md:hidden p-2 text-slate-600">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-6 py-4 space-y-3">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block text-sm font-medium text-slate-600">
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/login" className="text-center text-sm font-semibold px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700">
              Sign in
            </Link>
            <a href="#demo" className="text-center text-sm font-semibold px-4 py-2.5 rounded-lg text-white bg-slate-900">
              Book a demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
