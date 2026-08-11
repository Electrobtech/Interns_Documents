'use client';
import { useMemo, useState, useRef } from 'react';
import {
  Plus, Copy, Archive, Pause, Play, Trash2,
  BarChart3, Wand2, Search, LayoutGrid, List, Columns,
  MoreHorizontal, TrendingUp, TrendingDown, Sparkles,
  Filter, RefreshCw, Upload, Download, Loader2, AlertCircle, Activity
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import MHBadge from '../ui/MHBadge';
import MHDrawer from '../ui/MHDrawer';
import MHModal from '../ui/MHModal';
import { useMHToast } from '../ui/MHToast';
import {
  useMarketingCampaigns,
  useCreateMarketingCampaign,
  useUpdateMarketingCampaign,
  useDeleteMarketingCampaign,
  useMarketingAudiences as useAudiences,
  useCreateCampaign,
  usePublishCampaign,
  useOptimizeCampaign,
  useCampaignRecipients,
  CHANNELS,
  OBJECTIVES,
} from '@/lib/queries/marketingHub';
import { useCampaignRoom, useMarketingHubSocketEvent } from '@/lib/marketingHubSocket';

/** Map API row (snake_case / numeric strings from Postgres) → UI shape. */
function normalizeCampaign(row) {
  if (!row) return row;
  const n = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  return {
    id: row.id,
    name: row.name || '',
    platform: row.platform || '',
    objective: row.objective || '',
    status: row.status || 'Draft',
    budget: n(row.budget),
    spend: n(row.spend),
    ctr: n(row.ctr),
    cpm: n(row.cpm),
    cpc: n(row.cpc),
    reach: n(row.reach),
    impressions: n(row.impressions),
    leads: n(row.leads),
    conversions: n(row.conversions),
    revenue: n(row.revenue),
    roas: n(row.roas),
    createdBy: row.created_by || row.createdBy || '',
    startDate: row.start_date || row.startDate || '',
    endDate: row.end_date || row.endDate || '',
    aiScore: row.ai_score != null ? n(row.ai_score) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const STATUS_VARIANT = {
  draft: 'default', scheduled: 'scheduled', queued: 'scheduled', processing: 'active',
  completed: 'active', paused: 'warning', failed: 'danger', archived: 'default',
};
const KANBAN_STATUSES = ['draft', 'processing', 'completed', 'paused'];

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

function CreateCampaignModal({ onClose, toast, initialChannel }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', objective: '', channel: initialChannel || '', budget_amount: '', start_date: '', end_date: '', audience_id: '', message_body: '' });
  const [error, setError] = useState('');
  const { data: audiences = [] } = useAudiences();
  const createCampaign = useCreateCampaign();
  const publishCampaign = usePublishCampaign();
  const STEPS = ['Basics', 'Budget & Schedule', 'Audience & Message', 'Review'];
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const busy = createCampaign.isPending || publishCampaign.isPending;

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.objective && form.channel;
    if (step === 1) return form.budget_amount && Number(form.budget_amount) > 0;
    return true;
  };

  const payload = () => ({
    name: form.name.trim(), channel: form.channel, objective: form.objective,
    budget_amount: Number(form.budget_amount) || null,
    start_date: form.start_date || null, end_date: form.end_date || null,
    audience_id: form.audience_id || null, message_body: form.message_body || null,
  });

  const saveDraft = async () => {
    try {
      setError('');
      const result = await createCampaign.mutateAsync(payload());
      console.log('Campaign saved successfully:', result);
      toast.show('Campaign saved as draft.', 'success');
      onClose();
    } catch (err) {
      console.error('Failed to save campaign:', err);
      setError(err.message || 'Could not save campaign.');
    }
  };

  const launch = async () => {
    if (!form.audience_id) { setError('Select an audience to launch — or Save as Draft instead.'); return; }
    if (!form.message_body.trim()) { setError('Write a message before launching.'); return; }
    try {
      const campaign = await createCampaign.mutateAsync(payload());
      await publishCampaign.mutateAsync(campaign.id);
      toast.show('Campaign launched — sending is in progress.', 'success');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not launch campaign.');
    }
  };

  return (
    <MHModal title="Create Campaign" onClose={onClose} width={560}>
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
          <Field label="Campaign Name" required>
            <input className="mh-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Diwali Sale Push" />
          </Field>
          <Field label="Objective" required>
            <select className="mh-input" value={form.objective} onChange={e => set('objective', e.target.value)}>
              <option value="">Select objective…</option>
              {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Channel" required>
            <select className="mh-input" value={form.channel} onChange={e => set('channel', e.target.value)}>
              <option value="">Select channel…</option>
              {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Budget (Rs.)" required>
            <input className="mh-input" type="number" min="0" value={form.budget_amount} onChange={e => set('budget_amount', e.target.value)} placeholder="e.g. 5000" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Start Date"><input className="mh-input" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></Field>
            <Field label="End Date"><input className="mh-input" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></Field>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Audience" hint>
            <select className="mh-input" value={form.audience_id} onChange={e => { set('audience_id', e.target.value); setError(''); }}>
              <option value="">No audience yet — required to launch, optional for a draft</option>
              {audiences && audiences.length > 0 ? audiences.map(a => <option key={a.id} value={a.id}>{a.name}{a.size_cached != null ? ` (~${a.size_cached})` : ''}</option>) : null}
            </select>
            {!audiences || audiences.length === 0 ? (
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>No audiences yet — create one on the Audience page first, or save this as a draft.</p>
            ) : null}
          </Field>
          <Field label="Message">
            <textarea className="mh-input" rows={5} value={form.message_body} onChange={e => { set('message_body', e.target.value); setError(''); }}
              placeholder="What should this campaign send to each recipient?" style={{ resize: 'none', lineHeight: 1.6 }} />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            ['Name', form.name || '—'],
            ['Objective', form.objective || '—'],
            ['Channel', CHANNELS.find(c => c.value === form.channel)?.label || '—'],
            ['Budget', form.budget_amount ? `Rs.${Number(form.budget_amount).toLocaleString()}` : '—'],
            ['Audience', audiences.find(a => a.id === form.audience_id)?.name || 'None selected'],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>{l}</span><span style={{ fontWeight: 600, color: '#111827' }}>{v}</span>
            </div>
          ))}
          {error && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 10 }}>{error}</p>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <div>{step > 0 && <button className="mh-btn mh-btn-ghost" disabled={busy} onClick={() => setStep(s => s - 1)}>Back</button>}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="mh-btn mh-btn-ghost" disabled={busy || !form.name.trim()} onClick={saveDraft}>{createCampaign.isPending ? 'Saving…' : 'Save as Draft'}</button>
          {step < STEPS.length - 1
            ? <button className="mh-btn mh-btn-primary" disabled={!canNext()} style={{ opacity: canNext() ? 1 : 0.5 }} onClick={() => setStep(s => s + 1)}>Next</button>
            : <button className="mh-btn mh-btn-primary" disabled={busy} onClick={launch}>{busy ? 'Launching…' : 'Launch Campaign'}</button>}
        </div>
      </div>
    </MHModal>
  );
}

// Small human-readable feed of raw 'recipient:updated' socket events, joined
// against the recipients list (already fetched every 4s by
// useCampaignRecipients) so a name can be shown instead of a bare UUID.
// Purely additive — the aggregate counters above are still the source of
// truth; this just makes a running send visibly *do* something in between.
function LiveActivityFeed({ campaignId, recipients }) {
  const [events, setEvents] = useState([]);
  const nameById = useRef({});
  nameById.current = Object.fromEntries(recipients.map((r) => [r.id, r.display_name || r.destination]));

  useCampaignRoom(campaignId);
  useMarketingHubSocketEvent('recipient:updated', ({ recipientId, campaignId: cid, status }) => {
    if (cid !== campaignId) return;
    if (!['delivered', 'read', 'replied', 'failed'].includes(status)) return;
    const who = nameById.current[recipientId] || 'a contact';
    const verb = { delivered: 'Delivered to', read: 'Read by', replied: 'Replied:', failed: 'Failed for' }[status];
    setEvents((prev) => [{ id: `${recipientId}-${status}-${Date.now()}`, text: `${verb} ${who}`, status, t: Date.now() }, ...prev].slice(0, 12));
  }, [campaignId]);

  if (events.length === 0) return null;

  const colorFor = { delivered: '#3b82f6', read: '#10b981', replied: '#f59e0b', failed: '#dc2626' };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        <Activity size={12} /> Live Activity
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
        {events.map((e) => (
          <div key={e.id} style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorFor[e.status], flexShrink: 0 }} />
            {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function OptimizePanel({ campaignId }) {
  const optimize = useOptimizeCampaign();
  const [result, setResult] = useState(null);

  const run = () => optimize.mutate(campaignId, { onSuccess: setResult });

  return (
    <div style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: result ? 10 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wand2 size={14} color="#a855f7" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#a855f7' }}>AI Optimize</span>
        </div>
        <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={run} disabled={optimize.isPending}>
          {optimize.isPending ? 'Analyzing…' : result ? 'Re-analyze' : 'Analyze'}
        </button>
      </div>
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {result.suggestions.map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: '#374151', background: '#fff', border: '1px solid #f3e8ff', borderRadius: 8, padding: '8px 10px' }}>
              {s.action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignDrawer({ campaign: c }) {
  const total = c.total_recipients || 0;
  const sentPct = total > 0 ? Math.round(((c.sent_count || 0) / total) * 100) : 0;
  const failRate = total > 0 ? (c.failed_count || 0) / total : 0;
  const { data: recipients = [] } = useCampaignRecipients(c.id);
  const metrics = [
    { label: 'Recipients', value: total.toLocaleString() },
    { label: 'Sent', value: (c.sent_count || 0).toLocaleString() },
    { label: 'Delivered', value: (c.delivered_count || 0).toLocaleString() },
    { label: 'Read', value: (c.read_count || 0).toLocaleString() },
    { label: 'Replied', value: (c.replied_count || 0).toLocaleString() },
    { label: 'Failed', value: (c.failed_count || 0).toLocaleString() },
  ];
  var spendPct = c.budget > 0 ? Math.min(100, Math.round((c.spend / c.budget) * 100)) : 0;
  var data = sparkline((String(c.id).replace(/\D/g, '').slice(-6) || '1') * 7, 12);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 4 }}>{m.value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Send Progress</span>
          <span style={{ fontWeight: 700 }}>{sentPct}%</span>
        </div>
        <div className="progress-track" style={{ height: 8 }}>
          <div className="progress-fill" style={{ width: sentPct + '%', background: '#6366f1' }} />
        </div>
      </div>
      {c.status === 'processing' && <LiveActivityFeed campaignId={c.id} recipients={recipients} />}
      {c.message_body && (
        <div style={{ marginBottom: 20, background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message</div>
          <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{c.message_body}</div>
        </div>
      )}
      <OptimizePanel campaignId={c.id} />
      <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Sparkles size={14} color="#6366f1" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>Delivery Note</span>
        </div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
          {total === 0
            ? 'No recipients queued yet — this campaign is still a draft.'
            : failRate > 0.15
              ? `${Math.round(failRate * 100)}% of sends have failed — check that recipient contact details are current.`
              : c.status === 'processing'
                ? 'Sending is in progress. Delivered/read/replied counts update live.'
                : 'Send completed.'}
        </div>
      </div>
    </div>
  );
}

export default function MHCampaigns() {
  var toast = useMHToast();
  var show = toast.show;
  var _view = useState('list');
  var view = _view[0];
  var setView = _view[1];
  var _sel = useState([]);
  var selected = _sel[0];
  var setSelected = _sel[1];
  var _srch = useState('');
  var search = _srch[0];
  var setSearch = _srch[1];
  var _sf = useState('All');
  var statusFilter = _sf[0];
  var setStatusFilter = _sf[1];
  var _drw = useState(null);
  var drawer = _drw[0];
  var setDrawer = _drw[1];
  var _am = useState(null);
  var actionMenu = _am[0];
  var setActionMenu = _am[1];
  var _showCreate = useState(false);
  var showCreate = _showCreate[0];
  var setShowCreate = _showCreate[1];
  var _form = useState({ name: '', platform: 'Facebook', objective: 'Lead Generation', status: 'Draft', budget: '' });
  var form = _form[0];
  var setForm = _form[1];

  var query = useMarketingCampaigns();
  var rawCampaigns = query.data;
  var isLoading = query.isLoading;
  var isError = query.isError;
  var refetch = query.refetch;
  var isFetching = query.isFetching;
  var createMut = useCreateMarketingCampaign();
  var updateMut = useUpdateMarketingCampaign();
  var deleteMut = useDeleteMarketingCampaign();

  var campaigns = useMemo(function() {
    return (Array.isArray(rawCampaigns) ? rawCampaigns : []).map(normalizeCampaign);
  }, [rawCampaigns]);

  var filtered = campaigns.filter(function(c) {
    var matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.platform.toLowerCase().includes(search.toLowerCase());
    var matchStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const toggleSelect = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const allSelected = filtered.length > 0 && filtered.every(c => selected.includes(c.id));
  const toggleAll = () => setSelected(allSelected ? [] : filtered.map(c => c.id));

  const statusCounts = { All: campaigns.length };
  campaigns.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });

  const pause = (c) => setCampaignStatus.mutate({ id: c.id, status: 'paused' }, { onSuccess: () => toast.show('Campaign paused', 'success') });
  const resume = (c) => setCampaignStatus.mutate({ id: c.id, status: 'processing' }, { onSuccess: () => toast.show('Campaign resumed', 'success') });
  const remove = (c) => deleteCampaign.mutate(c.id, { onSuccess: () => { toast.show('Campaign deleted', 'success'); setActionMenu(null); } });

  // Duplicates every selected campaign as a new draft — real POST /campaigns
  // per row, id/status/counters stripped so each starts clean.
  const duplicateSelected = async () => {
    if (selected.length === 0) return toast.show('Select campaigns first', 'error');
    try {
      await Promise.all(selected.map((id) => {
        const c = campaigns.find((x) => x.id === id);
        if (!c) return null;
        const { id: _id, status, sent_count, delivered_count, read_count, replied_count, failed_count, total_recipients, created_at, updated_at, ...rest } = c;
        return createCampaign.mutateAsync({ ...rest, name: `${c.name} (Copy)` });
      }));
      toast.show(`Duplicated ${selected.length} campaign(s) as drafts`, 'success');
      setSelected([]);
      refetch();
    } catch (err) {
      toast.show(err.message || 'Duplicate failed', 'error');
    }
  };

  async function setStatusForSelected(status) {
    if (!selected.length) return;
    try {
      await Promise.all(selected.map(function(id) {
        return updateMut.mutateAsync({ id: id, status: status });
      }));
      show(status === 'Paused' ? 'Paused' : status === 'Active' ? 'Resumed' : status, 'success');
      setSelected([]);
    } catch (e) {
      show((e && e.message) || 'Update failed', 'error');
    }
  }

  async function deleteSelected() {
    if (!selected.length) return;
    if (!window.confirm('Delete ' + selected.length + ' campaign(s)?')) return;
    try {
      await Promise.all(selected.map(function(id) { return deleteMut.mutateAsync(id); }));
      show('Deleted', 'success');
      setSelected([]);
    } catch (e) {
      show((e && e.message) || 'Delete failed', 'error');
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      show('Name is required', 'error');
      return;
    }
    try {
      await createMut.mutateAsync({
        name: form.name.trim(),
        platform: form.platform,
        objective: form.objective,
        status: form.status,
        budget: parseFloat(form.budget) || 0,
      });
      show('Campaign created', 'success');
      setShowCreate(false);
      setForm({ name: '', platform: 'Facebook', objective: 'Lead Generation', status: 'Draft', budget: '' });
    } catch (e) {
      show((e && e.message) || 'Failed to create', 'error');
    }
  }

  var toolbarBtns = [
    { icon: Copy, label: 'Duplicate', fn: function() { show('Duplicate coming soon', 'info'); } },
    { icon: Archive, label: 'Archive', fn: function() { setStatusForSelected('Paused'); } },
    { icon: Pause, label: 'Pause', fn: function() { setStatusForSelected('Paused'); } },
    { icon: Play, label: 'Resume', fn: function() { setStatusForSelected('Active'); } },
    { icon: Trash2, label: 'Delete', fn: function() { deleteSelected(); } },
    { icon: Upload, label: 'Import', fn: function() { show('Import coming soon', 'info'); } },
    { icon: Download, label: 'Export', fn: function() { show('Exporting...', 'info'); } },
    { icon: BarChart3, label: 'Report', fn: function() { show('Report coming soon', 'info'); } },
    { icon: Wand2, label: 'AI Optimize', fn: function() { show('AI optimizing...', 'success'); } },
  ];

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Campaigns</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 0 }}>
            {campaigns.length} campaigns - Manage and track all marketing campaigns
          </p>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={function() { setShowCreate(true); }}>
          <Plus size={14} /> Create Campaign
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {toolbarBtns.map(b => (
          <button key={b.label} className="mh-btn mh-btn-ghost" onClick={b.fn}>
            <b.icon size={13} />{b.label}
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input className="mh-input" placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, width: '100%' }} />
        </div>
        <button className="mh-btn mh-btn-ghost"><Filter size={13} /> Filter</button>
        <button className="mh-btn mh-btn-ghost" onClick={function() { refetch(); show('Refreshed', 'success'); }}><RefreshCw size={13} /></button>
        <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {[['list', List], ['grid', LayoutGrid], ['kanban', Columns]].map(([v, Ic]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '6px 10px', background: view === v ? '#f3f4f6' : '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: view === v ? '#111827' : '#9ca3af' }}>
              <Ic size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Status pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Object.entries(statusCounts).map(([s, count]) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', textTransform: 'capitalize',
              background: statusFilter === s ? '#6366f1' : '#fff', color: statusFilter === s ? '#fff' : '#374151',
              borderColor: statusFilter === s ? '#6366f1' : '#e5e7eb' }}>
            {count} {s === 'All' ? 'Total' : s}
          </button>
        ))}
      </div>

      {isLoading && <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading campaigns…</div>}

      {!isLoading && filtered.length === 0 && (
        <div style={{ background: '#fff', border: '1px dashed #e5e7eb', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No campaigns yet</div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Create one to get started.</p>
        </div>
      )}

      {/* LIST VIEW */}
      
      {isLoading && (
        <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#6b7280', fontSize: 13 }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading campaigns…
        </div>
      )}
      {isError && !isLoading && (
        <div style={{ padding: 24, borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={16} /> Couldn't load campaigns.
          <button type="button" onClick={function() { refetch(); }} style={{ marginLeft: 8, border: '1px solid #fca5a5', background: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: '#6b7280', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 12, background: '#fafafa' }}>
          No campaigns yet. Create one to track ad-platform spend &amp; performance.
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={function() { setShowCreate(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <Plus size={14} /> New Campaign
            </button>
          </div>
        </div>
      )}

{!isLoading && !isError && view === 'list' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', width: 32 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                  </th>
                  {['CAMPAIGN', 'STATUS', 'CHANNEL', 'BUDGET', 'RECIPIENTS', 'SENT', 'DELIVERED', 'FAILED', 'START', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: (h === '' || h === 'CAMPAIGN' || h === 'STATUS' || h === 'CHANNEL') ? 'left' : 'right', color: '#9ca3af', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => setDrawer(c)}
                    style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '10px 12px' }} onClick={e => { e.stopPropagation(); toggleSelect(c.id); }}>
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: 180 }}>
                      <div style={{ fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{c.objective || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}><MHBadge label={c.status} variant={STATUS_VARIANT[c.status] || 'default'} /></td>
                    <td style={{ padding: '10px 12px', color: '#374151', textTransform: 'capitalize' }}>{c.channel}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>{c.budget_amount ? `Rs.${Number(c.budget_amount).toLocaleString()}` : '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>{c.total_recipients || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>{c.sent_count || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669' }}>{c.delivered_count || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: c.failed_count > 0 ? '#dc2626' : '#9ca3af' }}>{c.failed_count || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{c.start_date || '—'}</td>
                    <td style={{ padding: '10px 12px' }} onClick={e => { e.stopPropagation(); setActionMenu(actionMenu === c.id ? null : c.id); }}>
                      <div style={{ position: 'relative' }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 4, display: 'flex' }}>
                          <MoreHorizontal size={14} />
                        </button>
                        {actionMenu === c.id && (
                          <div style={{ position: 'absolute', right: 0, top: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 130, overflow: 'hidden' }}>
                            <button onClick={() => { pause(c); setActionMenu(null); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#374151', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'none'}><Pause size={12} />Pause</button>
                            <button onClick={() => { resume(c); setActionMenu(null); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#374151', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'none'}><Play size={12} />Resume</button>
                            <button onClick={() => remove(c)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#dc2626', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'none'}><Trash2 size={12} />Delete</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRID VIEW */}
      {!isLoading && !isError && view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {filtered.map(c => {
            const total = c.total_recipients || 0;
            const sentPct = total > 0 ? Math.round(((c.sent_count || 0) / total) * 100) : 0;
            return (
              <div key={c.id} onClick={() => setDrawer(c)}
                style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.objective || '—'}</div>
                  </div>
                  <MHBadge label={c.status} variant={STATUS_VARIANT[c.status] || 'default'} />
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, textTransform: 'capitalize' }}>
                  <span style={{ fontWeight: 600 }}>{c.channel}</span> - {c.start_date || 'unscheduled'}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                    <span>Send progress</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{c.sent_count || 0} / {total}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: sentPct + '%', background: '#6366f1' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Delivered</div>
                    <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 18, fontWeight: 700, color: '#111827', marginTop: 2 }}>{c.delivered_count || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Read</div>
                    <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 18, fontWeight: 700, color: '#111827', marginTop: 2 }}>{c.read_count || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Failed</div>
                    <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 18, fontWeight: 700, color: c.failed_count > 0 ? '#dc2626' : '#111827', marginTop: 2 }}>{c.failed_count || 0}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KANBAN VIEW */}
      {!isLoading && !isError && view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, alignItems: 'flex-start' }}>
          {KANBAN_STATUSES.map(status => {
            const colCampaigns = filtered.filter(c => c.status === status);
            const colColor = status === 'completed' ? '#059669' : status === 'processing' ? '#6366f1' : status === 'paused' ? '#d97706' : '#9ca3af';
            return (
              <div key={status} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, minHeight: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '6px 8px', borderRadius: 8, background: colColor + '18' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: colColor, textTransform: 'capitalize' }}>{status}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: colColor }}>{colCampaigns.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colCampaigns.map(c => (
                    <div key={c.id} onClick={() => setDrawer(c)}
                      style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6, textTransform: 'capitalize' }}>{c.channel}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
                        <span>{c.total_recipients || 0} recipients</span>
                        <span style={{ fontWeight: 700, color: '#059669' }}>{c.sent_count || 0} sent</span>
                      </div>
                    </div>
                  ))}
                  {colCampaigns.length === 0 && <div style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', padding: '16px 0' }}>Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {drawer && (
        <MHDrawer title={drawer.name} subtitle={(drawer.objective || '') + ' - ' + drawer.channel} onClose={() => setDrawer(null)}>
          <CampaignDrawer campaign={drawer} />
        </MHDrawer>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={function() { setShowCreate(false); }}>
          <div onClick={function(e) { e.stopPropagation(); }}
            style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>New Campaign</div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Name</label>
            <input value={form.name} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { name: e.target.value }); }); }}
              placeholder="e.g. AI Bootcamp Lead Gen"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12, fontSize: 13 }} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Platform</label>
            <select value={form.platform} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { platform: e.target.value }); }); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12, fontSize: 13 }}>
              {['Facebook', 'Google Ads', 'LinkedIn', 'Instagram', 'WhatsApp', 'Email'].map(function(p) {
                return <option key={p} value={p}>{p}</option>;
              })}
            </select>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Objective</label>
            <input value={form.objective} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { objective: e.target.value }); }); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12, fontSize: 13 }} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Budget (Rs.)</label>
            <input type="number" value={form.budget} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { budget: e.target.value }); }); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 16, fontSize: 13 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={function() { setShowCreate(false); }}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleCreate} disabled={createMut.isPending}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: createMut.isPending ? 0.7 : 1 }}>
                {createMut.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}