'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AlertTriangle, ArrowRight, MessageCircle, Instagram, Mail } from 'lucide-react';
import { api } from '../../lib/api';
import { setToken } from '../../lib/auth';

const PREVIEW_ROWS = [
  { icon: MessageCircle, label: 'Rohan Verma', meta: 'WhatsApp · Renewal question', tone: 'text-emerald-600 bg-emerald-50' },
  { icon: Instagram, label: 'Ananya Nair', meta: 'Instagram · Shipment update', tone: 'text-pink-600 bg-pink-50' },
  { icon: Mail, label: 'Trident Systems', meta: 'Email · Security questionnaire', tone: 'text-violet-600 bg-violet-50' },
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
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-10 bg-[#FAF8FC] relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-rose-100/50 blur-[120px] z-0" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-purple-100/60 blur-[120px] z-0" />

      {/* Centered Premium Login Card */}
      <div className="w-full max-w-md relative z-10 bg-white rounded-3xl border border-slate-200/60 p-8 sm:p-10 shadow-xl shadow-slate-100/80">
        
        {/* Logo header inside the card */}
        <div className="mb-8 flex flex-col items-center justify-center gap-2 text-center">
          <Link href="/">
            <Image src="/logo-full.png" alt="ConnectSphere — Lead Automation Application" width={280} height={70} className="object-contain" priority />
          </Link>
          <h1 className="text-2xl font-black text-slate-900 mt-5" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>Sign In</h1>
          <p className="text-xs text-slate-400 mt-1">Welcome back to ConnectSphere</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email" required autoFocus
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-violet-500 focus:ring focus:ring-violet-500/15 hover:border-slate-300"
              placeholder="you@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Password</label>
            <input
              type="password" required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-violet-500 focus:ring focus:ring-violet-500/15 hover:border-slate-300"
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

          <button disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition-all duration-150 hover:shadow-rose-500/35 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
            {busy ? 'Signing in…' : 'Sign In'} {!busy && <ArrowRight size={14} />}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          New company?{' '}
          <Link href="/register" className="text-rose-600 font-semibold hover:underline">
            Register here
          </Link>
        </p>
        <p className="text-center text-xs text-slate-400 mt-4">
          <Link href="/" className="hover:text-slate-600 font-medium">
            ← Back to landing page
          </Link>
        </p>
      </div>
    </div>
  );
}
