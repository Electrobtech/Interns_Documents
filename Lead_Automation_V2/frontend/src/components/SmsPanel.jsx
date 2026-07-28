'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Smartphone, Plus, X, Copy, Check, RefreshCw, Trash2, Loader2, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { useToast, ToastStack } from '@/components/Toast';

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand';

/**
 * SMS / RCS > Channels panel.
 *
 * Unlike WhatsApp/Instagram (real platform OAuth) or the generic channels
 * (a fake on/off toggle), SMS here has no carrier API at all — a business
 * installs a third-party forwarding app (e.g. SMS Forwarder) on the
 * Android phone that owns their number, and pastes a webhook URL we
 * generate into that app's settings. The URL itself is the credential.
 * See sms-integration-architecture.md for the full design.
 */
export default function SmsPanel() {
  const { call } = useApi();
  const { toasts, toast, dismiss } = useToast();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    call('/sms/devices')
      .then((rows) => setDevices(Array.isArray(rows) ? rows : []))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  }, [call]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!label.trim()) return toast.error('Give this phone a label, e.g. "Front desk phone".');
    setSaving(true);
    try {
      const device = await call('/sms/devices', {
        method: 'POST',
        body: { label: label.trim(), phone_number: phoneNumber.trim() || undefined },
      });
      toast.success('Phone added — copy the webhook URL below into the forwarder app.');
      setAddOpen(false);
      setLabel(''); setPhoneNumber('');
      setDevices((prev) => [device, ...prev]);
      setExpandedId(device.id);
    } catch (err) {
      toast.error(err.message || 'Could not add this phone.');
    } finally { setSaving(false); }
  }

  async function handleCopy(device) {
    try {
      await navigator.clipboard.writeText(device.webhook_url);
      setCopiedId(device.id);
      setTimeout(() => setCopiedId(''), 1500);
    } catch {
      toast.error('Could not copy — select and copy the URL manually.');
    }
  }

  async function handleRegenerate(device) {
    if (!window.confirm(`Regenerate the webhook URL for "${device.label}"? The old URL will stop working until you paste the new one into the app.`)) return;
    setBusyId(device.id);
    try {
      const updated = await call(`/sms/devices/${device.id}/regenerate-token`, { method: 'POST' });
      setDevices((prev) => prev.map((d) => (d.id === device.id ? updated : d)));
      setExpandedId(device.id);
      toast.success('New webhook URL generated — update the forwarder app with it.');
    } catch (err) {
      toast.error(err.message || 'Could not regenerate the token.');
    } finally { setBusyId(''); }
  }

  async function handleDelete(device) {
    if (!window.confirm(`Remove "${device.label}"? Its webhook URL will stop accepting messages.`)) return;
    setBusyId(device.id);
    try {
      await call(`/sms/devices/${device.id}`, { method: 'DELETE' });
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
      toast.success('Phone removed.');
    } catch (err) {
      toast.error(err.message || 'Could not remove this phone.');
    } finally { setBusyId(''); }
  }

  return (
    <div className="space-y-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* Standing receive-only note */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>This channel is receive-only — replies typed here won't be sent as SMS. Two-way SMS needs a virtual-number provider instead.</span>
      </div>

      {/* Add phone card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg grid place-items-center bg-emerald-50 text-emerald-600 shrink-0">
            <Smartphone size={20} />
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-800">Connect a phone</p>
            <p className="text-xs text-slate-400 mt-0.5 max-w-md">
              Install a forwarding app (e.g. SMS Forwarder) on the Android phone that owns your number, and point it at the webhook URL we give you.
            </p>
          </div>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 bg-brand text-white text-sm rounded-lg px-4 py-2 font-medium shrink-0">
          <Plus size={15} /> Add a phone
        </button>
      </div>

      {/* Connected devices */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-400">Loading connected phones…</div>
      ) : devices.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">
          No phone connected yet. Click "Add a phone" above to get started.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          <div className="px-4 py-3">
            <p className="font-semibold text-sm">Connected phones</p>
          </div>
          {devices.map((d) => {
            const expanded = expandedId === d.id;
            return (
              <div key={d.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${d.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{d.label}</p>
                      <p className="text-[11px] text-slate-400">
                        {d.phone_number ? `${d.phone_number} · ` : ''}
                        {d.last_message_at ? `last message ${new Date(d.last_message_at).toLocaleString()}` : 'no messages yet'}
                        {` · ${d.message_count || 0} received`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpandedId(expanded ? '' : d.id)}
                      className="flex items-center gap-1 text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 text-slate-600 hover:text-brand">
                      {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Webhook & debug
                    </button>
                    <button onClick={() => handleRegenerate(d)} disabled={busyId === d.id}
                      className="flex items-center gap-1.5 text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 text-slate-600 hover:text-brand disabled:opacity-60">
                      <RefreshCw size={13} className={busyId === d.id ? 'animate-spin' : ''} /> Regenerate
                    </button>
                    <button onClick={() => handleDelete(d)} disabled={busyId === d.id}
                      className="flex items-center gap-1.5 text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 text-slate-500 hover:text-red-500 disabled:opacity-60">
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-3 space-y-3 bg-slate-50 rounded-lg p-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Webhook URL</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 overflow-x-auto whitespace-nowrap">
                          {d.webhook_url}
                        </code>
                        <button onClick={() => handleCopy(d)}
                          className="flex items-center gap-1 text-xs font-medium border border-slate-300 rounded-lg px-2 py-1.5 text-slate-600 hover:text-brand shrink-0">
                          {copiedId === d.id ? <Check size={13} /> : <Copy size={13} />} {copiedId === d.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <ol className="text-xs text-slate-500 list-decimal list-inside space-y-0.5">
                      <li>Install <strong>SMS Forwarder</strong> from the Play Store on that phone.</li>
                      <li>Open it → add a new destination → choose <strong>Webhook</strong>.</li>
                      <li>Paste the URL above.</li>
                      <li>Send a test text to that phone's number to confirm it appears here within a few seconds.</li>
                    </ol>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Last payload received</p>
                      <pre className="text-[11px] bg-white border border-slate-200 rounded-lg p-2 overflow-x-auto max-h-40">
                        {d.last_raw_payload ? JSON.stringify(d.last_raw_payload, null, 2) : 'Nothing received yet.'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add phone modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center p-4" onClick={() => !saving && setAddOpen(false)}>
          <form onSubmit={handleAdd} onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-sm flex items-center gap-1.5"><Smartphone size={15} className="text-brand" /> Add a phone</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
                <input className={inputCls} placeholder="Front desk phone" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Phone number (optional, cosmetic only)</label>
                <input className={inputCls} placeholder="+1 555 010 1234" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button type="button" onClick={() => setAddOpen(false)}
                className="text-sm rounded-lg px-4 py-2 font-medium border border-slate-300 text-slate-600">Cancel</button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 text-sm rounded-lg px-4 py-2 font-medium bg-brand text-white disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {saving ? 'Adding…' : 'Add phone'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
