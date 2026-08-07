'use client';
import { useState, useEffect } from 'react';
import { Plus, Search, RefreshCw, ChevronDown, BarChart2, Zap, Download, FileText } from 'lucide-react';
import MHBadge from '../ui/MHBadge';
import MHDrawer from '../ui/MHDrawer';
import MHModal from '../ui/MHModal';
import { useMHToast } from '../ui/MHToast';
import {
  useBroadcasts, useCreateBroadcast, usePublishBroadcast, useBroadcastRecipients,
  useAudiences, CHANNELS, OBJECTIVES,
} from '@/lib/queries/marketingHub';
import { broadcasts as MOCK_BROADCASTS } from '../mockData';

// Normalise mock broadcasts to the shape the table expects
const MOCK_BROADCASTS_NORMALISED = MOCK_BROADCASTS.map((b, i) => ({
  id: `mock-${i}`,
  name: b.name,
  channel: (b.channel || 'email').toLowerCase(),
  status: (b.status || 'draft').toLowerCase(),
  objective: '',
  total_recipients: b.sent || 0,
  sent_count: b.delivered || 0,
  delivered_count: b.delivered || 0,
  read_count: b.opened || 0,
  replied_count: b.responses || 0,
  failed_count: Math.round((b.sent || 0) * 0.02),
  message_body: null,
  created_at: null,
}));
import { useMarketingHubSocketEvent, useCampaignRoom } from '@/lib/marketingHubSocket';
import { consumePrefillChannel } from '../prefill';
import { downloadCsv, printReport } from '../export';
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

  const saveDraft = async () => {
    try {
      setError('');
      const result = await createBroadcast.mutateAsync(payload());
      console.log('Broadcast saved successfully:', result);
      toast.show('Broadcast saved as draft.', 'success');
      onClose();
    } catch (err) {
      console.error('Failed to save broadcast:', err);
      setError(err.message || 'Could not save broadcast.');
    }
  };

  const publish = async () => {
    if (!form.audience_id) { setError("Select an audience — a broadcast can't send without one."); return; }
    if (!form.message_body.trim()) { setError('Write a message before sending.'); return; }
    try {
      setError('');
      const broadcast = await createBroadcast.mutateAsync(payload());
      console.log('Broadcast created successfully:', broadcast);
      await publishBroadcast.mutateAsync(broadcast.id);
      toast.show('Broadcast sent — delivery is in progress.', 'success');
      onClose();
    } catch (err) {
      console.error('Failed to send broadcast:', err);
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
              {audiences && audiences.length > 0 ? audiences.map((a) => <option key={a.id} value={a.id}>{a.name}{a.size_cached != null ? ` (~${a.size_cached})` : ''}</option>) : null}
            </select>
            {!audiences || audiences.length === 0 ? (
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>No audiences yet — create one on the Audience page first.</p>
            ) : null}
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="mh-btn mh-btn-ghost" disabled={busy || !form.name.trim()} onClick={saveDraft}>{createBroadcast.isPending ? 'Saving…' : 'Save as Draft'}</button>
          {step < STEPS.length - 1
            ? <button className="mh-btn mh-btn-primary" disabled={!canNext()} style={{ opacity: canNext() ? 1 : 0.5 }} onClick={() => setStep((s) => s + 1)}>Next</button>
            : <button className="mh-btn mh-btn-primary" disabled={busy} onClick={publish}>{busy ? 'Sending…' : 'Send Broadcast'}</button>}
        </div>
      </div>
    </MHModal>
  );
}

function ScoreRing({ score, size = 56 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 85 ? '#059669' : score >= 70 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: 13, fontWeight: 700, fill: color }}>{score}</text>
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
  const { data: rawBroadcasts = [], isLoading, isError, refetch } = useBroadcasts();
  // Fall back to rich mock data when the backend is down or returns nothing
  const broadcasts = (!isLoading && (isError || rawBroadcasts.length === 0)) ? MOCK_BROADCASTS_NORMALISED : rawBroadcasts;
  const [showCreate, setShowCreate] = useState(false);
  const [initialChannel, setInitialChannel] = useState('');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('All');
  const [drawer, setDrawer] = useState(null);

  useMarketingHubSocketEvent('campaign:updated', () => refetch());

  // Handoff from Channels page's "Create Broadcast" button — see ../prefill.js.
  useEffect(() => {
    const ch = consumePrefillChannel();
    if (ch) { setInitialChannel(ch); setShowCreate(true); }
  }, []);

  const filtered = broadcasts.filter((b) =>
    (channel === 'All' || b.channel === channel) &&
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = { Total: broadcasts.length };
  broadcasts.forEach((b) => { statusCounts[b.status] = (statusCounts[b.status] || 0) + 1; });

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

  const exportReportPdf = () => {
    const rows = filtered.length ? filtered : broadcasts;
    if (rows.length === 0) return toast.show('Nothing to report on', 'error');
    const html = `
      <h1>Broadcast Report</h1>
      <div class="meta">Generated ${new Date().toLocaleString()} · ${rows.length} broadcast(s)</div>
      <table><thead><tr><th>Name</th><th>Channel</th><th>Status</th><th>Recipients</th><th>Sent</th><th>Delivered</th><th>Read</th><th>Failed</th></tr></thead>
      <tbody>${rows.map((b) => `<tr><td>${b.name}</td><td>${b.channel}</td><td>${b.status}</td><td>${b.total_recipients || 0}</td><td>${b.sent_count || 0}</td><td>${b.delivered_count || 0}</td><td>${b.read_count || 0}</td><td>${b.failed_count || 0}</td></tr>`).join('')}</tbody></table>`;
    if (!printReport('Broadcast Report', html)) toast.show('Enable pop-ups to open the report', 'error');
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="mh-btn mh-btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New Broadcast
        </button>
        <button className="mh-btn mh-btn-ghost" onClick={() => refetch()}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button className="mh-btn mh-btn-ghost" onClick={exportCsv}>
          <Download size={14} /> Export CSV
        </button>
        <button className="mh-btn mh-btn-ghost" onClick={exportReportPdf}>
          <FileText size={14} /> Report (PDF)
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

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
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
                {filtered.map((b) => {
                  const score = deliveryScore(b);
                  return (
                    <tr key={b.id} onClick={() => setDrawer(b)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', maxWidth: 220 }}>{b.name}</div>
                      </td>
                      <td style={{ padding: '10px 14px', textTransform: 'capitalize', fontSize: 12, color: '#374151' }}>{b.channel}</td>
                      <td style={{ padding: '10px 14px' }}><MHBadge label={b.status} variant={STATUS_VARIANT[b.status] || 'default'} dot /></td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{(b.total_recipients || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{(b.sent_count || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{(b.delivered_count || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{(b.read_count || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: b.failed_count > 0 ? '#dc2626' : '#9ca3af' }}>{(b.failed_count || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="progress-track" style={{ width: 48 }}>
                            <div className="progress-fill" style={{ width: `${score}%`, background: score >= 85 ? '#059669' : score >= 70 ? '#d97706' : '#dc2626' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{score}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawer && (
        <MHDrawer title={drawer.name} subtitle={drawer.channel} onClose={() => setDrawer(null)} width={640}>
          <BroadcastDrawer broadcast={drawer} />
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
