'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { setToken } from '../../lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@electrobtech.com');
  const [password, setPassword] = useState('Admin@123');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const { token } = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(token);
      router.push('/');
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="min-h-screen grid place-items-center">
      <form onSubmit={submit} className="bg-white p-8 rounded-2xl border border-slate-200 w-96 space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-brand-dark">Lead Automation</h1>
          <p className="text-xs text-slate-400">Electrobtech Innovations</p>
        </div>
        <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        {err && <p className="text-xs text-red-500">{err}</p>}
        <button className="w-full bg-brand text-white rounded-lg py-2 text-sm font-medium">Login</button>
        <a className="block text-center text-xs text-brand cursor-pointer">Forgot password?</a>
      </form>
    </div>
  );
}
