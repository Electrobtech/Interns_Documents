'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { setToken } from '../../lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@electrobtech.com');
  const [password, setPassword] = useState('Admin@123');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success
  const bgRef = useRef(null);

  function handleMouseMove(e) {
    if (!bgRef.current) return;
    const { clientX, clientY } = e;
    bgRef.current.style.setProperty('--x', `${clientX}px`);
    bgRef.current.style.setProperty('--y', `${clientY}px`);
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setStatus('loading');
    try {
      const { token } = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(token);
      setStatus('success');
      setTimeout(() => router.push('/'), 550);
    } catch (e) {
      setErr(e.message);
      setStatus('idle');
    }
  }

  return (
    <div
      ref={bgRef}
      onMouseMove={handleMouseMove}
      className="min-h-screen relative overflow-hidden bg-[#0B1220] grid place-items-center p-6"
      style={{ '--x': '50%', '--y': '50%' }}
    >
      {/* cursor-tracked spotlight */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: 'radial-gradient(600px circle at var(--x) var(--y), rgba(41,84,227,0.15), transparent 65%)',
        }}
      />

      {/* drifting gradient mesh */}
      <div className="pointer-events-none absolute inset-0">
        <div className="blob blob-a absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-3xl opacity-60"
          style={{ background: 'radial-gradient(circle, #2954E3 0%, transparent 70%)' }} />
        <div className="blob blob-b absolute -bottom-40 -right-20 h-[480px] w-[480px] rounded-full blur-3xl opacity-50"
          style={{ background: 'radial-gradient(circle, #22D3B8 0%, transparent 70%)' }} />
        <div className="blob blob-c absolute top-1/3 right-1/4 h-[360px] w-[360px] rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, #A855F7 0%, transparent 70%)' }} />
      </div>

      <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }} />

      <div className="relative fade-in">
        {/* rotating gradient border */}
        <div className="spin-border absolute -inset-[2px] rounded-[28px] opacity-90" />
        <div className="absolute -inset-1 rounded-[28px] opacity-50 blur-xl"
          style={{ background: 'linear-gradient(135deg, #2954E3, #22D3B8, #A855F7)' }} />

        <form onSubmit={submit}
          className="relative w-full max-w-sm bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl space-y-5">

          <div className="text-center fade-in-up" style={{ animationDelay: '80ms' }}>
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl grid place-items-center shadow-lg logo-glow"
              style={{ background: 'linear-gradient(135deg, #2954E3, #22D3B8)' }}>
              <span className="text-white font-extrabold text-lg tracking-tight">LA</span>
            </div>
            <h1 className="text-2xl font-extrabold bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #1E3A8A, #2954E3)' }}>
              Lead Automation
            </h1>
            <p className="text-xs text-slate-400 mt-1 tracking-wide">ELECTROBTECH INNOVATIONS</p>
          </div>

          <div className="space-y-4 pt-1">
            <div className="relative fade-in-up" style={{ animationDelay: '160ms' }}>
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 6l-10 7L2 6" />
                </svg>
              </span>
              <input type="email" required placeholder="Email address"
                className="input-field w-full border-2 border-slate-100 rounded-xl bg-slate-50 pl-10 pr-3 py-3 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 focus:scale-[1.01]"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="relative fade-in-up" style={{ animationDelay: '220ms' }}>
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </span>
              <input type={showPw ? 'text' : 'password'} required placeholder="Password"
                className="input-field w-full border-2 border-slate-100 rounded-xl bg-slate-50 pl-10 pr-10 py-3 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 focus:scale-[1.01]"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand transition"
                aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a20.29 20.29 0 015.06-6.06M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a20.29 20.29 0 01-3.22 4.39M1 1l22 22" />
                    <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {err && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>
            )}

            <button type="submit" disabled={status !== 'idle'}
              className="btn-shimmer relative overflow-hidden w-full text-white rounded-xl py-3 text-sm font-semibold transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:hover:translate-y-0 fade-in-up flex items-center justify-center gap-2"
              style={{
                background:
                  status === 'success'
                    ? 'linear-gradient(135deg, #059669, #047857)'
                    : 'linear-gradient(135deg, #2954E3, #1E3A8A)',
                boxShadow: '0 10px 25px -8px rgba(41,84,227,0.55)',
                animationDelay: '280ms',
              }}>
              {status === 'loading' && (
                <svg className="animate-spin relative z-10" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
                  <path d="M22 12a10 10 0 00-10-10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {status === 'success' && (
                <svg className="relative z-10 checkmark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
              <span className="relative z-10">
                {status === 'loading' ? 'Signing in…' : status === 'success' ? 'Success' : 'Login'}
              </span>
            </button>

            <a className="block text-center text-xs font-medium text-brand hover:text-brand-dark cursor-pointer fade-in-up" style={{ animationDelay: '340ms' }}>
              Forgot password?
            </a>

            <div className="flex items-center justify-center gap-1.5 pt-2 fade-in-up" style={{ animationDelay: '400ms' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span className="text-[10px] text-slate-400 tracking-wide">Enterprise-grade encryption</span>
            </div>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.08); }
        }
        @keyframes driftReverse {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, 25px) scale(1.05); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(41,84,227,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(41,84,227,0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes drawCheck {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }

        .fade-in {
          opacity: 0;
          animation: fadeIn 0.6s ease-out forwards;
        }
        .fade-in-up {
          opacity: 0;
          animation: fadeInUp 0.5s ease-out forwards;
        }
        .blob-a { animation: drift 14s ease-in-out infinite; }
        .blob-b { animation: driftReverse 18s ease-in-out infinite; }
        .blob-c { animation: drift 22s ease-in-out infinite; }

        .logo-glow { animation: glowPulse 3s ease-in-out infinite; }

        .spin-border {
          background: conic-gradient(from 0deg, #2954E3, #22D3B8, #A855F7, #2954E3);
          animation: spin 6s linear infinite;
        }

        .btn-shimmer::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 40%;
          height: 100%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.25), transparent);
          transform: translateX(-100%);
        }
        .btn-shimmer:hover::after {
          animation: shimmer 1.1s ease-in-out;
        }

        .checkmark {
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
          animation: drawCheck 0.4s ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .fade-in, .fade-in-up, .blob-a, .blob-b, .blob-c, .logo-glow, .spin-border, .btn-shimmer::after, .checkmark {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}