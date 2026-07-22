'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, MessageCircle, Instagram, Mail, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import { setToken } from '../../lib/auth';

const PREVIEW_ROWS = [
  { icon: MessageCircle, label: 'Rohan Verma', meta: 'WhatsApp · Renewal question', tone: 'text-emerald-600 bg-emerald-50' },
  { icon: Instagram, label: 'Ananya Nair', meta: 'Instagram · Shipment update', tone: 'text-pink-600 bg-pink-50' },
  { icon: Mail, label: 'Trident Systems', meta: 'Email · Security questionnaire', tone: 'text-blue-600 bg-blue-50' },
];

const PREVIEW_STATS = [
  { label: 'Open conversations', value: '24' },
  { label: 'Leads qualified today', value: '9' },
  { label: 'Avg. first reply', value: '3.1s' },
];

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@electrobtech.com');
  const [password, setPassword] = useState('Admin@123');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { token } = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(token);
      router.push('/app');
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-950">
      {/* left — product preview */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-white/15 border border-white/25 grid place-items-center">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
            </svg>
          </span>
          <b className="text-[15px] font-semibold tracking-tight">Lead Automation</b>
        </Link>

        <div className="relative">
          <h2 className="text-[28px] font-bold tracking-tight leading-tight max-w-sm">
            Every lead, every conversation, one workspace.
          </h2>
          <p className="text-white/70 text-sm mt-3 max-w-sm leading-relaxed">
            Unified inbox, AI agents, campaigns, and CRM — sign in to pick up right where your team left off.
          </p>

          {/* mock dashboard preview */}
          <div className="mt-8 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm p-4 max-w-sm">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PREVIEW_STATS.map((s) => (
                <div key={s.label} className="rounded-xl bg-white/10 border border-white/10 px-2.5 py-2">
                  <p className="text-[16px] font-bold tabular-nums">{s.value}</p>
                  <p className="text-[9px] text-white/60 leading-tight mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {PREVIEW_ROWS.map((r) => (
                <div key={r.label} className="flex items-center gap-2.5 rounded-lg bg-white px-2.5 py-2">
                  <span className={`p-1.5 rounded-md ${r.tone}`}>
                    <r.icon size={11} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-800 truncate">{r.label}</p>
                    <p className="text-[9.5px] text-slate-400 truncate">{r.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative text-[11px] text-white/50">© 2026 Electrobtech Innovations Pvt Ltd</p>
      </div>

      {/* right — auth card */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-slate-950">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 grid place-items-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
              </svg>
            </span>
            <b className="text-[15px] font-semibold tracking-tight text-white">Lead Automation</b>
          </div>

          <h1 className="text-2xl font-bold text-white">Sign in</h1>
          <p className="text-sm text-slate-400 mt-1.5">Welcome back to Electrobtech Innovations</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email" required autoFocus
                className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-150 focus:border-blue-500 focus:ring focus:ring-blue-500/20 hover:border-slate-600"
                placeholder="you@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Password</label>
              <input
                type="password" required
                className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-150 focus:border-blue-500 focus:ring focus:ring-blue-500/20 hover:border-slate-600"
                placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {err && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertTriangle size={13} className="text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{err}</p>
              </div>
            )}

            <button disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? 'Signing in…' : 'Sign in'} {!busy && <ArrowRight size={14} />}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            New company?{' '}
            <Link href="/register" className="text-blue-400 font-semibold hover:underline">
              Register here
            </Link>
          </p>
          <p className="text-center text-xs text-slate-500 mt-4">
            <Link href="/" className="hover:text-slate-300">
              ← Back to landing page
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
