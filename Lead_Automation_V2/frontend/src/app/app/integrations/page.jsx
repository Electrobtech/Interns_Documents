'use client';

import { useState } from 'react';
import { Plug, Facebook, Lock, Loader2, AlertCircle } from 'lucide-react';
import ConnectionsPanel, { useConnectionStatus } from '@/components/ConnectionsPanel';
import { useApi } from '@/lib/useApi';

// The CRM Integrations section that used to live here was removed: it called
// /crm/connections, /crm/sync-jobs, and /crm/sync/outbound, none of which
// exist anywhere in this codebase (no gateway route, no service implements
// them). Every request failed, so the page permanently showed "CRM
// integrations are not available yet." alongside a raw workspace UUID input
// and two empty panels. Restore it together with the crm-sync service and its
// gateway route, not before.

/* ─── Password gate ───────────────────
 * Once Instagram, Facebook or WhatsApp is connected, this page itself is
 * password-protected — being logged into the app isn't enough. State only,
 * so it re-locks every time the page is opened; the real check happens
 * server-side via POST /auth/verify-publish-password (same admin password
 * as the connection-unlock flow), so it can't be bypassed from the client.
 */
function IntegrationsGate({ children }) {
  const { call } = useApi();
  const instagram = useConnectionStatus('instagram');
  const facebook = useConnectionStatus('facebook');
  const whatsapp = useConnectionStatus('whatsapp');
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const statusLoading = instagram.loading || facebook.loading || whatsapp.loading;
  const anyConnected = instagram.connected || facebook.connected || whatsapp.connected;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await call('/auth/verify-publish-password', { method: 'POST', body: { password } });
      setUnlocked(true);
    } catch (err) {
      setError(err.data?.error || err.message || 'Incorrect password.');
    } finally {
      setSubmitting(false);
      setPassword('');
    }
  };

  if (statusLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
        <Loader2 size={14} className="animate-spin" /> Checking connections…
      </p>
    );
  }

  // Nothing connected yet, so there's nothing sensitive to gate — the
  // page just shows the normal "Connect" buttons.
  if (!anyConnected || unlocked) {
    return children;
  }

  return (
    <div className="max-w-sm mx-auto py-16 text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 mb-3">
        <Lock size={18} className="text-slate-500" />
      </div>
      <h3 className="font-semibold text-sm mb-1">Password required</h3>
      <p className="text-xs text-slate-400 mb-4">
        A social account is connected here — enter the password to view or change it.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          required
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle size={14} /> {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg
            bg-brand text-white hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Plug size={24} className="text-violet-600" />
          <h1 className="text-2xl font-bold">Integrations &amp; APIs</h1>
        </div>
        <p className="text-sm text-slate-500">
          Connect Facebook, Instagram, and WhatsApp for messaging and publishing.
        </p>
      </div>

      {/* ---------- Meta Integrations (Facebook, Instagram, WhatsApp) ---------- */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Facebook size={20} className="text-brand" />
          <h2 className="text-lg font-bold">Meta Integrations</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Facebook and Instagram share a single connection — connect via Meta login or by pasting
          in Page credentials directly. Once a connection is saved, it locks automatically so it
          can&apos;t be changed by accident; only an org admin can unlock it to reconnect.
        </p>
        <IntegrationsGate>
          <ConnectionsPanel />
        </IntegrationsGate>
      </section>
    </div>
  );
}