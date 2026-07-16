'use client';
import { useMemo, useState } from 'react';
import {
  Megaphone, Plus, Search, X, Edit, Trash2, Calendar,
  Clock, CheckCircle2, Play, Pause, XCircle, Radio, Mail,
  Smartphone, MessageCircle, Instagram, MessageSquare,
  Sparkles, TrendingUp, Send, Filter, MoreHorizontal,
  BarChart3, Users, AlertTriangle, ChevronDown, ShieldCheck, Check,
} from 'lucide-react';
import { useCampaigns, useUpdateCampaign, useCampaignDecision } from '@/lib/queries/crm';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

function useCreateCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/campaigns', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns', 'list'] }),
  });
}

function useDeleteCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns', 'list'] }),
  });
}

/* ─── look-up tables ────────────────────────────────────── */
const CHANNEL_CFG = {
  whatsapp:  { label: 'WhatsApp',  Icon: MessageCircle, bg: 'bg-emerald-50', text: 'text-emerald-700', accent: 'from-emerald-500 to-teal-500',   dot: 'bg-emerald-500' },
  instagram: { label: 'Instagram', Icon: Instagram,     bg: 'bg-pink-50',    text: 'text-pink-700',    accent: 'from-pink-500 to-rose-500',       dot: 'bg-pink-500'    },
  messenger: { label: 'Messenger', Icon: MessageSquare, bg: 'bg-blue-50',    text: 'text-blue-700',    accent: 'from-blue-500 to-indigo-500',     dot: 'bg-blue-500'    },
  sms:       { label: 'SMS / RCS', Icon: Smartphone,    bg: 'bg-amber-50',   text: 'text-amber-700',   accent: 'from-amber-500 to-orange-500',    dot: 'bg-amber-500'   },
  email:     { label: 'Email',     Icon: Mail,          bg: 'bg-violet-50',  text: 'text-violet-700',  accent: 'from-violet-500 to-purple-500',   dot: 'bg-violet-500'  },
  default:   { label: 'Channel',   Icon: Radio,         bg: 'bg-slate-100',  text: 'text-slate-600',   accent: 'from-slate-400 to-slate-500',     dot: 'bg-slate-400'   },
};

const STATUS_CFG = {
  draft:          { label: 'Draft',           Icon: Edit,         bg: 'bg-slate-100',  text: 'text-slate-600',  pulse: false },
  needs_approval: { label: 'Needs Approval',  Icon: ShieldCheck,  bg: 'bg-violet-50',  text: 'text-violet-700', pulse: false },
  scheduled:      { label: 'Scheduled',       Icon: Clock,        bg: 'bg-amber-50',   text: 'text-amber-700',  pulse: false },
  sent:           { label: 'Sent',            Icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-700',pulse: false },
  active:         { label: 'Active',          Icon: Play,         bg: 'bg-blue-50',    text: 'text-blue-700',   pulse: true  },
  paused:         { label: 'Paused',          Icon: Pause,        bg: 'bg-orange-50',  text: 'text-orange-700', pulse: false },
  rejected:       { label: 'Rejected',        Icon: XCircle,      bg: 'bg-red-50',     text: 'text-red-700',    pulse: false },
  failed:         { label: 'Failed',          Icon: XCircle,      bg: 'bg-red-50',     text: 'text-red-700',    pulse: false },
};

const TYPE_CFG = {
  broadcast:     { label: 'Broadcast',     bg: 'bg-blue-50   text-blue-700'    },
  drip:          { label: 'Drip',          bg: 'bg-violet-50 text-violet-700'  },
  transactional: { label: 'Transactional', bg: 'bg-teal-50   text-teal-700'    },
};

const ALL_CHANNELS = ['all', 'whatsapp', 'instagram', 'messenger', 'sms', 'email'];
const ALL_STATUSES = ['all', 'draft', 'needs_approval', 'scheduled', 'sent', 'active', 'paused', 'rejected'];
const ALL_TYPES    = ['all', 'broadcast', 'drip', 'transactional'];

/* ─── helpers ───────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/* ─── CampaignCard ──────────────────────────────────────── */
function CampaignCard({ c, onDelete, onSubmitForApproval, idx }) {
  const ch  = CHANNEL_CFG[c.channel_type] || CHANNEL_CFG.default;
  const st  = STATUS_CFG[c.status]        || STATUS_CFG.draft;
  const ty  = TYPE_CFG[c.type]            || { label: c.type || '—', bg: 'bg-slate-100 text-slate-600' };
  const { Icon: ChIcon } = ch;
  const { Icon: StIcon } = st;
  const [menu, setMenu] = useState(false);

  return (
    <div
      className="group bg-white rounded-2xl border border-slate-100 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 overflow-hidden animate-slide-up"
      style={{ animationDelay: `${idx * 40}ms` }}
    >
      {/* coloured top bar */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${ch.accent}`} />

      <div className="p-5">
        {/* header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${ch.bg}`}>
              <ChIcon size={15} className={ch.text} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800 text-sm truncate">{c.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ch.bg} ${ch.text}`}>
                  {ch.label}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ty.bg}`}>
                  {ty.label}
                </span>
              </div>
            </div>
          </div>

          {/* status + menu */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${st.bg} ${st.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${ch.dot} ${st.pulse ? 'animate-pulse' : ''}`} />
              {st.label}
            </span>
            <div className="relative">
              <button
                onClick={() => setMenu((p) => !p)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <MoreHorizontal size={14} />
              </button>
              {menu && (
                <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-card-lg border border-slate-200 py-1 w-44 animate-scale-in">
                  <button className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                    <Edit size={12} /> Edit
                  </button>
                  {c.status === 'draft' && (
                    <button
                      onClick={() => { onSubmitForApproval(c.id); setMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-violet-600 hover:bg-violet-50"
                    >
                      <ShieldCheck size={12} /> Submit for Approval
                    </button>
                  )}
                  <button
                    onClick={() => { onDelete(c.id); setMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* message preview */}
        {c.message_body && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
            {c.message_body}
          </p>
        )}

        {/* footer row */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          {c.scheduled_at ? (
            <span className="flex items-center gap-1.5">
              <Calendar size={11} className="text-blue-400" />
              {fmtDate(c.scheduled_at)} {fmtTime(c.scheduled_at)}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Clock size={11} /> Not scheduled
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── CreateModal ───────────────────────────────────────── */
function CreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '', type: 'broadcast', channel_type: 'whatsapp',
    message_body: '', scheduled_at: '', status: 'draft',
  });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true); setErr('');
    try {
      await onCreate({ ...form, scheduled_at: form.scheduled_at || null });
    } catch (ex) {
      setErr(ex.message || 'Failed to create campaign');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-lg animate-scale-in border border-slate-200 max-h-[90vh] overflow-y-auto">
        {/* modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600">
              <Megaphone size={15} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm">New Campaign</h2>
              <p className="text-[11px] text-slate-400">Set up a broadcast or drip campaign</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Campaign Name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Summer Sale Blast" className="input-premium" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className="input-premium">
                {ALL_TYPES.filter((t) => t !== 'all').map((t) => (
                  <option key={t} value={t}>{TYPE_CFG[t]?.label || t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Channel</label>
              <select value={form.channel_type} onChange={(e) => set('channel_type', e.target.value)} className="input-premium">
                {ALL_CHANNELS.filter((c) => c !== 'all').map((c) => (
                  <option key={c} value={c}>{CHANNEL_CFG[c]?.label || c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Message Body</label>
            <textarea rows={4} value={form.message_body}
              onChange={(e) => set('message_body', e.target.value)}
              placeholder="Write your broadcast message here…"
              className="input-premium resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Schedule</label>
              <input type="datetime-local" value={form.scheduled_at}
                onChange={(e) => set('scheduled_at', e.target.value)} className="input-premium" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className="input-premium">
                {['draft', 'scheduled'].map((s) => (
                  <option key={s} value={s}>{STATUS_CFG[s]?.label || s}</option>
                ))}
              </select>
            </div>
          </div>

          {err && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{err}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={busy || !form.name.trim()} className="btn-primary flex-1">
              <Send size={14} />
              {busy ? 'Creating…' : 'Create Campaign'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost px-5">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────── */
export default function CampaignsPage() {
  const { data, isLoading, isError } = useCampaigns();
  const create = useCreateCampaign();
  const remove = useDeleteCampaign();
  const updateCampaign = useUpdateCampaign();
  const decide = useCampaignDecision();

  const [showCreate,     setCreate]   = useState(false);
  const [search,         setSearch]   = useState('');
  const [filterChannel,  setChannel]  = useState('all');
  const [filterStatus,   setStatus]   = useState('all');
  const [filterType,     setType]     = useState('all');

  const campaigns = Array.isArray(data) ? data : [];
  const pendingApproval = useMemo(
    () => campaigns.filter((c) => c.status === 'needs_approval'),
    [campaigns],
  );

  /* ── computed stats ── */
  const stats = useMemo(() => ({
    total:          campaigns.length,
    active:         campaigns.filter((c) => ['active', 'sent'].includes(c.status)).length,
    scheduled:      campaigns.filter((c) => c.status === 'scheduled').length,
    draft:          campaigns.filter((c) => c.status === 'draft').length,
    needsApproval:  campaigns.filter((c) => c.status === 'needs_approval').length,
  }), [campaigns]);

  /* ── channel breakdown ── */
  const channelBreakdown = useMemo(() => {
    const map = new Map();
    for (const c of campaigns) {
      const key = c.channel_type || 'default';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([ch, count]) => ({ ch, count, pct: Math.round((count / (campaigns.length || 1)) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [campaigns]);

  /* ── filtered list ── */
  const filtered = useMemo(() => campaigns.filter((c) => {
    if (filterChannel !== 'all' && c.channel_type !== filterChannel) return false;
    if (filterStatus  !== 'all' && c.status       !== filterStatus)  return false;
    if (filterType    !== 'all' && c.type         !== filterType)    return false;
    if (search.trim() && !c.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [campaigns, filterChannel, filterStatus, filterType, search]);

  const handleCreate = async (payload) => {
    await create.mutateAsync(payload);
    setCreate(false);
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this campaign?')) return;
    remove.mutate(id);
  };

  const handleSubmitForApproval = (id) => {
    updateCampaign.mutate({ id, status: 'needs_approval' });
  };

  const handleDecision = (id, decision) => {
    decide.mutate({ id, decision });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* ── page header ─────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600 shadow-sm">
            <Megaphone size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Campaigns & Broadcasts</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Marketing Agent–powered campaigns across every channel
            </p>
          </div>
        </div>
        <button onClick={() => setCreate(true)} className="btn-primary">
          <Plus size={15} /> New Campaign
        </button>
      </div>

      {/* ── KPI stats row ───────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total',          value: stats.total,         icon: Megaphone,   from: 'from-blue-50',    to: 'to-indigo-100', text: 'text-blue-600'    },
          { label: 'Active',         value: stats.active,        icon: TrendingUp,  from: 'from-emerald-50', to: 'to-teal-100',   text: 'text-emerald-600' },
          { label: 'Scheduled',      value: stats.scheduled,     icon: Calendar,    from: 'from-amber-50',   to: 'to-orange-100', text: 'text-amber-600'   },
          { label: 'Needs Approval', value: stats.needsApproval, icon: ShieldCheck, from: 'from-violet-50',  to: 'to-purple-100', text: 'text-violet-600'  },
          { label: 'Drafts',         value: stats.draft,         icon: Edit,        from: 'from-slate-50',   to: 'to-slate-100',  text: 'text-slate-500'   },
        ].map(({ label, value, icon: Icon, from, to, text }, i) => (
          <div key={label}
            className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 animate-slide-up"
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${from} ${to} ${text} shrink-0`}>
                <Icon size={16} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-slate-800 tabular-nums leading-tight">
                  {isLoading ? <span className="inline-block w-8 h-6 skeleton rounded-md" /> : value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── content area: channel breakdown + campaign grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">

        {/* LEFT: channel breakdown sidebar */}
        <div className="xl:col-span-1 space-y-4">

          {/* Approval Queue — human-approved execution: nothing sends without a decision here */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
                  <ShieldCheck size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Approval Queue</h4>
                  <p className="text-[11px] text-slate-400">Review before it can send</p>
                </div>
              </div>
              {pendingApproval.length > 0 && (
                <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-full">
                  {pendingApproval.length}
                </span>
              )}
            </div>
            {pendingApproval.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Nothing waiting on review.</p>
            ) : (
              <div className="space-y-3">
                {pendingApproval.map((c) => {
                  const ch = CHANNEL_CFG[c.channel_type] || CHANNEL_CFG.default;
                  return (
                    <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <p className="text-xs font-semibold text-slate-700 truncate">{c.name}</p>
                      <p className={`text-[10px] font-semibold mt-1 ${ch.text}`}>{ch.label}</p>
                      {c.message_body && (
                        <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">{c.message_body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          onClick={() => handleDecision(c.id, 'approved')}
                          disabled={decide.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60"
                        >
                          <Check size={11} /> Approve
                        </button>
                        <button
                          onClick={() => handleDecision(c.id, 'rejected')}
                          disabled={decide.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-60"
                        >
                          <X size={11} /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
                <BarChart3 size={15} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">By Channel</h4>
                <p className="text-[11px] text-slate-400">Distribution</p>
              </div>
            </div>
            {campaigns.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No data yet</p>
            ) : (
              <div className="space-y-3">
                {channelBreakdown.map(({ ch, count, pct }) => {
                  const cfg = CHANNEL_CFG[ch] || CHANNEL_CFG.default;
                  const { Icon: ChIcon } = cfg;
                  return (
                    <div key={ch}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <ChIcon size={12} className={cfg.text} />
                          <span className="text-xs font-semibold text-slate-700">{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">{count}</span>
                          <span className="text-[10px] text-slate-400">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${cfg.accent} transition-all duration-700`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Broadcast tip */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={15} className="text-blue-200" />
              <p className="text-xs font-bold text-blue-100">Marketing Agent</p>
            </div>
            <p className="text-sm font-bold leading-snug mb-3">
              Generate campaign content from your knowledge base
            </p>
            <p className="text-[11px] text-blue-200 leading-relaxed mb-4">
              The Marketing Agent can write broadcasts, drip sequences, and ad copy grounded in your uploaded documents.
            </p>
            <a href="/ai-agents"
              className="inline-flex items-center gap-2 text-xs font-bold text-white bg-white/20 hover:bg-white/30 border border-white/30 px-3 py-2 rounded-xl transition-all">
              <Sparkles size={12} /> Open Marketing Agent
            </a>
          </div>
        </div>

        {/* RIGHT: toolbar + cards grid */}
        <div className="xl:col-span-3 space-y-4">

          {/* toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-44">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaigns…"
                className="input-premium pl-9 w-full" />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* filter selects */}
            {[
              { value: filterChannel, onChange: setChannel, options: ALL_CHANNELS,
                label: (v) => v === 'all' ? 'All Channels' : (CHANNEL_CFG[v]?.label || v) },
              { value: filterStatus,  onChange: setStatus,  options: ALL_STATUSES,
                label: (v) => v === 'all' ? 'All Statuses' : (STATUS_CFG[v]?.label || v) },
              { value: filterType,    onChange: setType,    options: ALL_TYPES,
                label: (v) => v === 'all' ? 'All Types'    : (TYPE_CFG[v]?.label || v)   },
            ].map(({ value, onChange, options, label }, i) => (
              <div key={i} className="relative">
                <select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="input-premium pr-8 text-xs appearance-none cursor-pointer min-w-[120px]"
                >
                  {options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            ))}

            {(filterChannel !== 'all' || filterStatus !== 'all' || filterType !== 'all' || search) && (
              <button
                onClick={() => { setChannel('all'); setStatus('all'); setType('all'); setSearch(''); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-500 transition-colors px-2 py-2"
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>

          {/* results count */}
          {!isLoading && (
            <p className="text-[11px] text-slate-400">
              Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of {campaigns.length} campaigns
            </p>
          )}

          {/* loading skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
                  <div className="h-4 w-32 skeleton rounded-lg" />
                  <div className="h-3 w-24 skeleton rounded" />
                  <div className="h-3 w-full skeleton rounded" />
                </div>
              ))}
            </div>
          )}

          {/* error */}
          {isError && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-700">Failed to load campaigns. Please try again.</p>
            </div>
          )}

          {/* empty state */}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col items-center justify-center py-20 text-center">
              <div className="p-5 rounded-2xl bg-slate-50 mb-4">
                <Megaphone size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-400">
                {search || filterChannel !== 'all' || filterStatus !== 'all' || filterType !== 'all'
                  ? 'No campaigns match your filters'
                  : 'No campaigns yet'}
              </p>
              <p className="text-xs text-slate-300 mt-1">
                {search || filterChannel !== 'all' || filterStatus !== 'all' || filterType !== 'all'
                  ? 'Adjust your filters or create a new campaign'
                  : 'Create your first campaign or generate one with the Marketing Agent'}
              </p>
              {campaigns.length === 0 && (
                <button onClick={() => setCreate(true)} className="btn-primary mt-5 btn-sm">
                  <Plus size={13} /> Create Campaign
                </button>
              )}
            </div>
          )}

          {/* campaign cards grid */}
          {!isLoading && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((c, i) => (
                <CampaignCard key={c.id} c={c} onDelete={handleDelete} onSubmitForApproval={handleSubmitForApproval} idx={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* create modal */}
      {showCreate && (
        <CreateModal onClose={() => setCreate(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
