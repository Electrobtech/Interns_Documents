'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { setSuperAdminToken } from '@/lib/superAdminAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Deliberately a separate screen from /login (tenant staff sign-in) —
// platform admins aren't tenant users and there's no "switch org" concept
// here, just a distinct credential set (see platform_admins in
// 022_super_admin_billing.sql).
export default function SuperAdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { token } = await api('/super-admin/login', { method: 'POST', body: { email, password } });
      setSuperAdminToken(token);
      router.push('/super-admin');
    } catch (e) {
      setErr(e.message || 'Invalid credentials');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-950 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldAlert className="size-5" />
            <CardDescription>Platform Access</CardDescription>
          </div>
          <CardTitle className="text-xl">Super Admin sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                autoComplete="current-password"
              />
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
