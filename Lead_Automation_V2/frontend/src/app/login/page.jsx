'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, MessageCircle, Instagram, Mail, Bot, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import { setToken } from '../../lib/auth';

const PREVIEW_ROWS = [
  { icon: MessageCircle, label: 'Rohan Verma', meta: 'WhatsApp · Renewal question', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { icon: Instagram, label: 'Ananya Nair', meta: 'Instagram · Shipment update', tone: 'text-pink-700 bg-pink-50 border-pink-200' },
  { icon: Mail, label: 'Trident Systems', meta: 'Email · Security questionnaire', tone: 'text-rose-700 bg-rose-50 border-rose-200' },
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
    <div className="min-h-screen bg-[#FFF8F4] relative overflow-hidden flex items-center justify-center p-6">
      {/* Ambient peach glow field — same warm palette as the landing page canvas */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-20 h-[32rem] w-[32rem] rounded-full bg-rose-300/40 blur-[140px]" />
        <div className="absolute -bottom-40 -right-20 h-[32rem] w-[32rem] rounded-full bg-orange-300/40 blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[28rem] w-[28rem] rounded-full bg-amber-200/40 blur-[160px]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#f43f5e 1px, transparent 1px), linear-gradient(90deg, #f43f5e 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-2 rounded-3xl border border-rose-100 bg-white shadow-[0_20px_60px_-20px_rgba(244,63,94,0.25)] overflow-hidden">

        {/* Left — brand + live product preview, hidden on small screens */}
        <motion.div
          initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex flex-col justify-between p-10 relative border-r border-rose-100"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-orange-50/60 to-amber-50" />
          <div className="relative">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/logo-icon.jpg" alt="ConnectSphere" width={36} height={36} className="rounded-xl" priority />
              <span className="text-lg font-black text-slate-900" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>ConnectSphere</span>
            </Link>
            <h2 className="mt-10 text-2xl font-black text-slate-900 leading-tight">
              Every conversation.<br />
              <span style={{ background: 'linear-gradient(90deg, #f43f5e, #fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                One unified workspace.
              </span>
            </h2>
            <p className="mt-3 text-sm text-slate-600 max-w-xs">AI reads it, drafts the reply, and keeps your CRM in sync — automatically.</p>
          </div>

          {/* Live inbox preview card */}
          <div className="relative rounded-2xl border border-rose-100 bg-white/80 backdrop-blur-md shadow-sm p-5 mt-8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unified Inbox</p>
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[10px] font-bold text-emerald-600">Live</span>
              </span>
            </div>
            <div className="space-y-2">
              {PREVIEW_ROWS.map((r, i) => (
                <motion.div key={r.label}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${r.tone}`}>
                  <r.icon className="h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{r.label}</p>
                    <p className="text-[10px] opacity-80 truncate">{r.meta}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-rose-100">
              {PREVIEW_STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-base font-black text-slate-900">{s.value}</p>
                  <p className="text-[9px] text-slate-400 leading-tight mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-2 text-[11px] text-slate-500 mt-6">
            <Bot className="h-3.5 w-3.5 text-rose-500" />
            Grounded in your own knowledge base — no hallucinated answers.
          </div>
        </motion.div>

        {/* Right — sign-in form */}
        <motion.div
          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="p-8 sm:p-12 flex flex-col justify-center"
        >
          <div className="lg:hidden mb-8 flex justify-center">
            <Link href="/">
              <Image src="/logo-full.png" alt="ConnectSphere" width={200} height={50} className="object-contain" priority />
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>Sign in</h1>
            <p className="text-sm text-slate-500 mt-1.5">Welcome back to ConnectSphere</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email" required autoFocus
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-rose-400 focus:ring focus:ring-rose-100 hover:border-slate-300"
                placeholder="you@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Password</label>
              <input
                type="password" required
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-rose-400 focus:ring focus:ring-rose-100 hover:border-slate-300"
                placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {err && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle size={13} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-600">{err}</p>
              </div>
            )}

            <button
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all duration-150 hover:shadow-violet-500/40 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {busy ? 'Signing in…' : 'Sign In'} {!busy && <ArrowRight size={14} />}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <p className="text-center text-sm text-slate-500">
            New company?{' '}
            <Link href="/register" className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-violet-600 font-bold hover:underline">
              Register here
            </Link>
          </p>
          <p className="text-center text-xs text-slate-400 mt-4">
            <Link href="/" className="hover:text-slate-600 font-medium inline-flex items-center gap-1">
              ← Back to landing page
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
