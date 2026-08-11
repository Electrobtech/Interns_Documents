'use client';
import { useState } from 'react';
import { Plus, Search, Send, Pause, RefreshCw, ShieldCheck, ChevronDown, BarChart2, Zap, Loader2 } from 'lucide-react';
import MHBadge from '../ui/MHBadge';
import MHDrawer from '../ui/MHDrawer';
import MHModal from '../ui/MHModal';
import { useMHToast } from '../ui/MHToast';
import {
  useMarketingBroadcasts,
  useCreateMarketingBroadcast,
  useSendMarketingBroadcast,
  useMarketingAudiences,
  CHANNELS,
  OBJECTIVES,
} from '@/lib/queries/marketingHub';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STATUS_VARIANT = {
  draft: 'default', scheduled: 'scheduled', queued: 'scheduled', processing: 'active',
  completed: 'active', paused: 'warning', failed: 'danger', archived: 'default',
};
const BROADCAST_CHANNELS = CHANNELS.filter((c) => c.broadcastsSupported);

function Field({ label, required, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function CreateBroadcastModal({ onClose, toast, initialChannel }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', channel: initialChannel || '', objective: '', audience_id: '', message_body: '' });
  const [error, setError] = useState('');
  const { data: audiences = [] } = useAudiences();
  const createBroadcast = useCreateBroadcast();
  const publishBroadcast = usePublishBroadcast();
  const STEPS = ['Setup', 'Message', 'Review'];
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const busy = createBroadcast.isPending || publishBroadcast.isPending;

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.channel && form.audience_id;
    if (step === 1) return form.message_body.trim();
    return true;
  };

  const payload = () => ({
    name: form.name.trim(), channel: form.channel, objective: form.objective || null,
    audience_id: form.audience_id || null, message_body: form.message_body || null,
  });

  const publish = async () => {
    if (!form.audience_id) { setError("Select an audience — a broadcast can't send without one."); return; }
    if (!form.message_body.trim()) { setError('Write a message before sending.'); return; }
    try {
      const broadcast = await createBroadcast.mutateAsync(payload());
      await publishBroadcast.mutateAsync(broadcast.id);
      toast.show('Broadcast sent — delivery is in progress.', 'success');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not send broadcast.');
    }
  };

  return (
    <MHModal title="New Broadcast" onClose={onClose} width={520}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 4, borderRadius: 2, background: i <= step ? '#6366f1' : '#e5e7eb', marginBottom: 6 }} />
            <span style={{ fontSize: 11, fontWeight: i === step ? 700 : 500, color: i === step ? '#6366f1' : '#9ca3af' }}>{s}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Broadcast Name" required>
            <input className="mh-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Flash Sale - August" />
          </Field>
          <Field label="Channel" required>
            <select className="mh-input" value={form.channel} onChange={(e) => set('channel', e.target.value)}>
              <option value="">Select channel…</option>
              {BROADCAST_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}{c.broadcastsSupported === 'limited' ? ' (limited)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Objective">
            <select className="mh-input" value={form.objective} onChange={(e) => set('objective', e.target.value)}>
              <option value="">Select objective…</option>
              {OBJECTIVES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Audience" required>
            <select className="mh-input" value={form.audience_id} onChange={(e) => { set('audience_id', e.target.value); setError(''); }}>
              <option value="">Select audience…</option>
              {audiences.map((a) => <option key={a.id} value={a.id}>{a.name}{a.size_cached != null ? ` (~${a.size_cached})` : ''}</option>)}
            </select>
            {audiences.length === 0 && (
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>No audiences yet — create one on the Audience page first.</p>
            )}
          </Field>
        </div>
      )}

      {step === 1 && (
        <Field label="Message" required>
          <textarea className="mh-input" rows={6} value={form.message_body} onChange={(e) => { set('message_body', e.target.value); setError(''); }}
            placeholder="What should this broadcast send to each recipient?" style={{ resize: 'none', lineHeight: 1.6 }} />
        </Field>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            ['Name', form.name || '—'],
            ['Channel', BROADCAST_CHANNELS.find((c) => c.value === form.channel)?.label || '—'],
            ['Audience', audiences.find((a) => a.id === form.audience_id)?.name || 'None selected'],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>{l}</span><span style={{ fontWeight: 600, color: '#111827' }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8, padding: 10, fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>
            {form.message_body || 'No message written.'}
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 10 }}>{error}</p>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <div>{step > 0 && <button className="mh-btn mh-btn-ghost" disabled={busy} onClick={() => setStep((s) => s - 1)}>Back</button>}</div>
        {step < STEPS.length - 1
          ? <button className="mh-btn mh-btn-primary" disabled={!canNext()} style={{ opacity: canNext() ? 1 : 0.5 }} onClick={() => setStep((s) => s + 1)}>Next</button>
          : <button className="mh-btn mh-btn-primary" disabled={busy} onClick={publish}>{busy ? 'Sending…' : 'Send Broadcast'}</button>}
      </div>
    </MHModal>
  );
}

function ScoreRing({ score, size = 56 }) {
  const s = score ?? 0;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (s / 100) * circ;
  const color = s >= 85 ? '#059669' : s >= 70 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: 13, fontWeight: 700, fill: color }}>{s}</text>
    </svg>
  );
}

// Read-rate-driven score (0-100), computed off real counters — replaces the
// old hardcoded `aiScore` mock field.
function deliveryScore(b) {
  const total = b.total_recipients || 0;
  if (total === 0) return 0;
  const delivered = (b.delivered_count || 0) / total;
  const read = (b.delivered_count || 0) > 0 ? (b.read_count || 0) / b.delivered_count : 0;
  return Math.round(delivered * 60 + read * 40);
}

function BroadcastDrawer({ broadcast: b }) {
  const { data: recipients = [] } = useBroadcastRecipients(b.id);
  useCampaignRoom(b.id);
  const score = deliveryScore(b);
  const funnel = [
    { stage: 'Sent', value: b.sent_count || 0, color: '#6366f1' },
    { stage: 'Delivered', value: b.delivered_count || 0, color: '#3b82f6' },
    { stage: 'Read', value: b.read_count || 0, color: '#10b981' },
    { stage: 'Replied', value: b.replied_count || 0, color: '#f59e0b' },
  ];
  const failed = recipients.filter((r) => r.status === 'failed');

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        {[
          { l: 'Sent', v: (b.sent_count || 0).toLocaleString() },
          { l: 'Delivered', v: (b.delivered_count || 0).toLocaleString() },
          { l: 'Read', v: (b.read_count || 0).toLocaleString() },
          { l: 'Replied', v: (b.replied_count || 0).toLocaleString() },
          { l: 'Failed', v: (b.failed_count || 0).toLocaleString() },
          { l: 'Delivery Score', v: `${score}/100` },
        ].map((m) => (
          <div key={m.l} style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', border: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 4 }}>{m.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{m.v}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Delivery Funnel</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={funnel} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={70} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {funnel.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {failed.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Failed Sends ({failed.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
            {failed.slice(0, 20).map((r) => (
              <div key={r.id} style={{ fontSize: 12, background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ fontWeight: 600, color: '#991b1b' }}>{r.display_name || r.destination}</span>
                <span style={{ color: '#b91c1c' }}> — {r.error || 'send failed'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(135deg,rgba(168,85,247,0.06),rgba(99,102,241,0.06))', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(99,102,241,0.15)' }}>
        <ScoreRing score={score} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            <Zap size={13} style={{ color: '#a855f7', marginRight: 4 }} />Delivery Note
          </div>
          <div style={{ fontSize: 13, color: '#374151' }}>
            {(b.total_recipients || 0) === 0
              ? 'No recipients queued yet.'
              : b.status === 'processing'
                ? 'Sending is in progress. Counts update live.'
                : score >= 85
                  ? 'Excellent delivery/read rate for this broadcast.'
                  : score >= 60
                    ? 'Solid delivery rate — read rate has room to improve.'
                    : 'Low delivery/read rate — check audience quality and message.'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MHBroadcasts({ onNavigate }) {
  const toast = useMHToast();
  const [showCreate, setShowCreate] = useState(false);
  const [initialChannel, setInitialChannel] = useState('');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('All');
  const [drawer, setDrawer] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [form, setForm] = useState({ name: '', channel: 'WhatsApp', audience_id: '', message_body: '' });

  const { data: broadcasts = [], isLoading, isError, error, refetch, isFetching } = useMarketingBroadcasts({ channel });
  const { data: audiences = [] } = useMarketingAudiences();
  const createMut = useCreateMarketingBroadcast();
  const sendMut = useSendMarketingBroadcast();

  const filtered = broadcasts.filter(b =>
    (b.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = {
    Total: broadcasts.length,
    Active: broadcasts.filter(b => b.status === 'Active').length,
    Sent: broadcasts.filter(b => b.status === 'Sent').length,
    Scheduled: broadcasts.filter(b => b.status === 'Scheduled').length,
    Draft: broadcasts.filter(b => b.status === 'Draft').length,
  };

  const exportCsv = () => {
    const rows = filtered.length ? filtered : broadcasts;
    if (rows.length === 0) return toast.show('Nothing to export', 'error');
    downloadCsv('broadcasts', rows, [
      { label: 'Name', value: 'name' }, { label: 'Channel', value: 'channel' }, { label: 'Status', value: 'status' },
      { label: 'Recipients', value: 'total_recipients' }, { label: 'Sent', value: 'sent_count' },
      { label: 'Delivered', value: 'delivered_count' }, { label: 'Read', value: 'read_count' },
      { label: 'Failed', value: 'failed_count' },
    ]);
    toast.show('CSV downloaded', 'success');
  };

  const funnelForDrawer = (b) => [
    { stage: 'Sent', value: b.sent || 0, color: '#6366f1' },
    { stage: 'Delivered', value: b.delivered || 0, color: '#3b82f6' },
    { stage: 'Opened', value: b.opened || 0, color: '#10b981' },
    { stage: 'Clicked', value: b.clicked || 0, color: '#f59e0b' },
  ];

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.show('Name is required', 'error');
      return;
    }
    try {
      await createMut.mutateAsync({
        name: form.name.trim(),
        channel: form.channel,
        audience_id: form.audience_id || null,
        message_body: form.message_body || null,
        status: 'Draft',
      });
      toast.show('Broadcast created', 'success');
      setComposerOpen(false);
      setForm({ name: '', channel: 'WhatsApp', audience_id: '', message_body: '' });
    } catch (e) {
      toast.show(e?.message || 'Failed to create broadcast', 'error');
    }
  };

  const handleSendOne = async (id) => {
    try {
      await sendMut.mutateAsync({ id });
      toast.show('Broadcast sent', 'success');
      refetch();
    } catch (e) {
      toast.show(e?.message || 'Failed to send', 'error');
    }
  };

  const handleSendSelected = async () => {
    if (!selected.length) {
      toast.show('Select broadcasts first', 'error');
      return;
    }
    try {
      for (const id of selected) {
        await sendMut.mutateAsync({ id });
      }
      toast.show(`Sent ${selected.length} broadcast(s)`, 'success');
      setSelected([]);
      refetch();
    } catch (e) {
      toast.show(e?.message || 'Failed to send', 'error');
    }
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="mh-btn mh-btn-primary" onClick={() => setComposerOpen(true)}>
          <Plus size={15} /> New Broadcast
        </button>
        <button className="mh-btn mh-btn-ghost" onClick={() => toast.show('Running policy check…', 'info')}>
          <ShieldCheck size={14} /> Policy Check
        </button>
        <button
          className="mh-btn mh-btn-ghost"
          disabled={sendMut.isPending}
          onClick={handleSendSelected}
        >
          <Send size={14} /> Send
        </button>
        <button className="mh-btn mh-btn-ghost" onClick={exportCsv}>
          <Download size={14} /> Export CSV
        </button>
        <button className="mh-btn mh-btn-ghost" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input className="mh-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search broadcasts…" style={{ paddingLeft: 32, width: '100%' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select className="mh-input" value={channel} onChange={(e) => setChannel(e.target.value)} style={{ paddingRight: 28, appearance: 'none', cursor: 'pointer' }}>
            <option value="All">All Channels</option>
            {BROADCAST_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af' }} />
        </div>
      </div>

      {/* Status Pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(statusCounts).map(([k, v]) => (
          <span key={k} style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: '#fff', border: '1px solid var(--mh-border)', color: 'var(--mh-text-2)', textTransform: 'capitalize' }}>
            {v} {k}
          </span>
        ))}
      </div>

      {isError && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#991b1b', fontSize: 13 }}>
          Failed to load broadcasts: {error?.message || 'Unknown error'}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <Loader2 size={28} style={{ color: '#6366f1', margin: '0 auto 12px' }} className="animate-spin" />
            <div style={{ fontSize: 13, color: '#6b7280' }}>Loading broadcasts…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <BarChart2 size={36} style={{ color: '#d1d5db', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>No broadcasts found</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Try adjusting your filters or create a new broadcast.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['NAME', 'CHANNEL', 'STATUS', 'RECIPIENTS', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SCORE'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '10px 14px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const ai = b.aiScore ?? b.ai_score ?? 0;
                  return (
                    <tr key={b.id} onClick={() => setDrawer(b)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '10px 14px' }} onClick={e => { e.stopPropagation(); handleSelect(b.id); }}>
                        <input type="checkbox" checked={selected.includes(b.id)} readOnly />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', maxWidth: 220 }}>{b.name}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: b.channel === 'WhatsApp' ? '#d1fae5' : b.channel === 'Email' ? '#e0e7ff' : '#fef3c7', color: b.channel === 'WhatsApp' ? '#065f46' : b.channel === 'Email' ? '#3730a3' : '#92400e' }}>{b.channel}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 12, color: '#6b7280' }}>{b.audience || '—'}</span></td>
                      <td style={{ padding: '10px 14px' }}><MHBadge label={b.status} variant={STATUS_VARIANT[b.status] || 'default'} dot /></td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{(b.sent || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{(b.delivered || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{(b.opened || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{(b.clicked || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: b.conversion > 0 ? '#059669' : '#9ca3af', fontWeight: 600 }}>{b.conversion > 0 ? `${b.conversion}%` : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="progress-track" style={{ width: 48 }}>
                            <div className="progress-fill" style={{ width: `${ai}%`, background: ai >= 85 ? '#059669' : ai >= 70 ? '#d97706' : '#dc2626' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{ai || '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                        {b.status !== 'Sent' && (
                          <button
                            className="mh-btn mh-btn-ghost"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            disabled={sendMut.isPending}
                            onClick={() => handleSendOne(b.id)}
                          >
                            <Send size={12} /> Send
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Composer modal */}
      {composerOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setComposerOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: 480, maxWidth: '92vw', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>New Broadcast</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Name</label>
                <input className="mh-input" style={{ width: '100%', marginTop: 4 }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Welcome Series" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Channel</label>
                <select className="mh-input" style={{ width: '100%', marginTop: 4 }} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                  {['WhatsApp', 'Email', 'SMS'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Audience</label>
                <select className="mh-input" style={{ width: '100%', marginTop: 4 }} value={form.audience_id} onChange={e => setForm(f => ({ ...f, audience_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {audiences.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({Number(a.size || 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Message</label>
                <textarea className="mh-input" style={{ width: '100%', marginTop: 4, minHeight: 80 }} value={form.message_body} onChange={e => setForm(f => ({ ...f, message_body: e.target.value }))} placeholder="Message body…" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="mh-btn mh-btn-ghost" onClick={() => setComposerOpen(false)}>Cancel</button>
              <button className="mh-btn mh-btn-primary" disabled={createMut.isPending} onClick={handleCreate}>
                {createMut.isPending ? 'Creating…' : 'Create Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawer && (
        <MHDrawer title={drawer.name} subtitle={`${drawer.channel} · ${drawer.audience || 'No audience'}`} onClose={() => setDrawer(null)} width={640}>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
              {[
                { l: 'Sent', v: (drawer.sent || 0).toLocaleString() },
                { l: 'Delivered', v: (drawer.delivered || 0).toLocaleString() },
                { l: 'Opened', v: (drawer.opened || 0).toLocaleString() },
                { l: 'Clicked', v: (drawer.clicked || 0).toLocaleString() },
                { l: 'Conversion', v: drawer.conversion > 0 ? `${drawer.conversion}%` : '—' },
                { l: 'AI Score', v: `${drawer.aiScore ?? drawer.ai_score ?? 0}/100` },
              ].map(m => (
                <div key={m.l} style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 4 }}>{m.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Delivery Funnel</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={funnelForDrawer(drawer)} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={70} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelForDrawer(drawer).map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {drawer.status !== 'Sent' && (
              <button
                className="mh-btn mh-btn-primary"
                style={{ width: '100%', marginBottom: 16 }}
                disabled={sendMut.isPending}
                onClick={() => handleSendOne(drawer.id).then(() => setDrawer(null))}
              >
                <Send size={14} /> Send Broadcast
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(135deg,rgba(168,85,247,0.06),rgba(99,102,241,0.06))', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(99,102,241,0.15)' }}>
              <ScoreRing score={drawer.aiScore ?? drawer.ai_score ?? 0} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                  <Zap size={13} style={{ color: '#a855f7', marginRight: 4 }} />AI Recommendation
                </div>
                <div style={{ fontSize: 13, color: '#374151' }}>
                  {(drawer.aiScore ?? drawer.ai_score ?? 0) >= 85
                    ? 'Excellent performance. Consider replicating this broadcast structure for future campaigns.'
                    : (drawer.aiScore ?? drawer.ai_score ?? 0) >= 70
                      ? 'Good delivery rate. Improve subject lines and send time to boost open rates.'
                      : 'Low engagement detected. Review audience segmentation and message relevance.'}
                </div>
              </div>
            </div>
          </div>
        </MHDrawer>
      )}

      {showCreate && (
        <CreateBroadcastModal
          onClose={() => { setShowCreate(false); setInitialChannel(''); }}
          toast={toast}
          initialChannel={initialChannel}
        />
      )}
    </div>
  );
}