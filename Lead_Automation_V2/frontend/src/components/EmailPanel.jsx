'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Mail, Link2, Unlink, RefreshCw, Loader2, Send, ShieldCheck, Plus, X,
} from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { useToast, ToastStack } from '@/components/Toast';

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand';

// Turns a comma/space separated string into a clean array of addresses.
function parseAddresses(raw) {
  return raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Email > Channels panel.
 *
 * Connecting a mailbox is a Google OAuth redirect (services/email-service's
 * routes/auth.js `connect-url` + `callback`) — never a password field.
 * Gmail doesn't support third-party sign-in with a raw email/password, and
 * asking users to type their Google password into this app would both fail
 * and look like a phishing form. OAuth is also what already exists on the
 * backend (see auth.js, gmailApi.js, oauthClient.js), so this just gives it
 * a UI, following the same connect-url -> window.location.href pattern
 * already used for LinkedIn and Google Reviews elsewhere in this app.
 */
export default function EmailPanel() {
  const { call } = useApi();
  const { toasts, toast, dismiss } = useToast();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [busyId, setBusyId] = useState('');

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeAccountId, setComposeAccountId] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    call('/email/accounts')
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setAccounts(list);
        setComposeAccountId((prev) => prev || list.find((a) => a.connected)?.id || '');
      })
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, [call]);

  useEffect(() => { load(); }, [load]);

  // Land back here after the OAuth callback redirect (?email=connected / ?email_error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('email_error');
    const ok = params.get('email');
    if (err) toast.error(decodeURIComponent(err));
    if (ok === 'connected') { toast.success('Gmail mailbox connected.'); load(); }
    if (err || ok) {
      params.delete('email_error'); params.delete('email');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, [load, toast]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { url } = await call('/email/auth/connect-url');
      window.location.href = url;
    } catch (e) {
      toast.error(e.message || 'Could not start Google sign-in.');
      setConnecting(false);
    }
  }

  async function handleDisconnect(account) {
    if (!window.confirm(`Disconnect ${account.email}? Message history stays, but new mail will stop syncing.`)) return;
    setBusyId(account.id);
    try {
      await call(`/email/auth/${account.id}/disconnect`, { method: 'POST' });
      toast.success(`${account.email} disconnected.`);
      load();
    } catch (e) {
      toast.error(e.message || 'Could not disconnect this mailbox.');
    } finally { setBusyId(''); }
  }

  async function handleSync(account) {
    setBusyId(account.id);
    try {
      await call(`/email/accounts/${account.id}/sync`, { method: 'POST' });
      toast.success('Sync started.');
      load();
    } catch (e) {
      toast.error(e.message || 'Sync failed.');
    } finally { setBusyId(''); }
  }

  function openCompose(accountId) {
    setComposeAccountId(accountId || accounts.find((a) => a.connected)?.id || '');
    setTo(''); setCc(''); setSubject(''); setBody('');
    setComposeOpen(true);
  }

  async function handleSend(e) {
    e.preventDefault();
    const toList = parseAddresses(to);
    if (!composeAccountId) return toast.error('Choose which mailbox to send from.');
    if (!toList.length) return toast.error('Add at least one recipient.');
    if (!subject.trim()) return toast.error('Add a subject.');

    setSending(true);
    try {
      const fd = new FormData();
      fd.append('meta', JSON.stringify({
        accountId: composeAccountId,
        to: toList,
        cc: parseAddresses(cc),
        subject,
        text: body,
      }));
      await call('/email/messages/send', { method: 'POST', body: fd });
      toast.success('Email sent.');
      setComposeOpen(false);
    } catch (e2) {
      toast.error(e2.message || 'Failed to send.');
    } finally { setSending(false); }
  }

  const connectedAccounts = accounts.filter((a) => a.connected);

  return (
    <div className="space-y-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* Connect card */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-400">Checking your Gmail connection…</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg grid place-items-center bg-blue-50 text-blue-600 shrink-0">
              <Mail size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-800">Connect a Gmail mailbox</p>
              <p className="text-xs text-slate-400 mt-0.5 max-w-md">
                You'll sign in on Google's own page and grant access — we never see or store your Gmail password.
              </p>
            </div>
          </div>
          <button onClick={handleConnect} disabled={connecting}
            className="flex items-center gap-1.5 bg-brand text-white text-sm rounded-lg px-4 py-2 font-medium disabled:opacity-60 shrink-0">
            {connecting ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            {connecting ? 'Redirecting to Google…' : 'Connect with Google'}
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck size={13} /> Secured with Google OAuth — access can be revoked anytime, here or from your Google Account.
      </div>

      {/* Connected mailboxes */}
      {!!accounts.length && (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="font-semibold text-sm">Connected mailboxes</p>
            {!!connectedAccounts.length && (
              <button onClick={() => openCompose('')}
                className="flex items-center gap-1.5 text-xs font-medium bg-brand text-white rounded-lg px-3 py-1.5">
                <Plus size={13} /> Compose
              </button>
            )}
          </div>
          {accounts.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${a.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">{a.email}</p>
                  <p className="text-[11px] text-slate-400">
                    {a.connected ? (a.synced ? 'Synced' : 'Connecting…') : 'Disconnected'}
                    {a.last_synced_at && a.connected ? ` · last synced ${new Date(a.last_synced_at).toLocaleString()}` : ''}
                    {a.last_sync_error ? ` · ${a.last_sync_error}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {a.connected && (
                  <>
                    <button onClick={() => openCompose(a.id)}
                      className="flex items-center gap-1.5 text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 text-slate-600 hover:text-brand">
                      <Send size={13} /> Send
                    </button>
                    <button onClick={() => handleSync(a)} disabled={busyId === a.id}
                      className="flex items-center gap-1.5 text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 text-slate-600 hover:text-brand disabled:opacity-60">
                      <RefreshCw size={13} className={busyId === a.id ? 'animate-spin' : ''} /> Sync
                    </button>
                    <button onClick={() => handleDisconnect(a)} disabled={busyId === a.id}
                      className="flex items-center gap-1.5 text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 text-slate-500 hover:text-red-500 disabled:opacity-60">
                      <Unlink size={13} /> Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !accounts.length && (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">
          No Gmail mailbox connected yet. Click "Connect with Google" above to get started.
        </div>
      )}

      {/* Compose modal */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4" onClick={() => !sending && setComposeOpen(false)}>
          <form onSubmit={handleSend} onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-sm flex items-center gap-1.5"><Send size={15} className="text-brand" /> New email</h3>
              <button type="button" onClick={() => setComposeOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
                <select className={inputCls} value={composeAccountId} onChange={(e) => setComposeAccountId(e.target.value)}>
                  {connectedAccounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
                <input className={inputCls} placeholder="lead@example.com, another@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cc (optional)</label>
                <input className={inputCls} value={cc} onChange={(e) => setCc(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
                <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Message</label>
                <textarea className={`${inputCls} min-h-[120px]`} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button type="button" onClick={() => setComposeOpen(false)}
                className="text-sm rounded-lg px-4 py-2 font-medium border border-slate-300 text-slate-600">Cancel</button>
              <button type="submit" disabled={sending}
                className="flex items-center gap-1.5 text-sm rounded-lg px-4 py-2 font-medium bg-brand text-white disabled:opacity-60">
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}