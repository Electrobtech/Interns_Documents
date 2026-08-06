'use client';
/**
 * Broadcasts — real CRUD against /ai-agents/marketing/broadcasts.
 *
 * The policy check is the point of this screen. The server refuses to move a
 * broadcast to `sending` without a stored, passing anti_ban verdict, so the
 * "Check policy" button here isn't advisory — it's the gate.
 */
import { useState } from 'react';
import {
  Plus, RefreshCw, Radio, Trash2, Send, ShieldCheck, ShieldAlert, Loader2, Ban, Pause,
} from 'lucide-react';

import {
  useBroadcasts, useCreateBroadcast, useDeleteBroadcast, useBroadcastPolicyCheck,
  useBroadcastStatus, BROADCAST_CHANNELS, BROADCAST_STATUSES, NEXT_BROADCAST_STATUSES,
} from '@/lib/queries/marketing';
import { useAudiences } from '@/lib/queries/campaigns';
import { useRunMarketingAgent } from '@/lib/queries/aiAgents';
import { Card, Badge, Button, EmptyState } from '../MarketingUI';
import {
  PageHeader, Toolbar, ToolButton, ToolSearch, StatsStrip,
} from '../HubUI';
import { Modal, Field, Input, Textarea, Select, SearchInput, ErrorNote, timeAgo } from './Shared';

const TONE = Object.fromEntries(BROADCAST_STATUSES.map((s) => [s.value, s.tone]));
const LABEL = Object.fromEntries(BROADCAST_STATUSES.map((s) => [s.value, s.label]));
const RISK_TONE = { low: 'green', medium: 'amber', high: 'red', critical: 'red' };

export default function Broadcasts() {
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [policyFor, setPolicyFor] = useState(null);

  const { data: rows = [], isLoading, isFetching, refetch } = useBroadcasts({
    search: search || undefined,
    channel: channel || undefined,
  });

  const del = useDeleteBroadcast();
  const status = useBroadcastStatus();
  const policy = useBroadcastPolicyCheck();
  const antiBan = useRunMarketingAgent();

  /** Runs the anti_ban capability, then persists its verdict so the send gate
   *  has something durable to check. */
  const checkPolicy = async (b) => {
    setCheckingId(b.id);
    try {
      const res = await antiBan.mutateAsync({ message: b.body, capability: 'anti_ban' });
      const out = res?.output?.anti_ban ?? (res?.output ? Object.values(res.output)[0] : null);
      if (!out?.risk_level) return;
      await policy.mutateAsync({
        id: b.id,
        risk_level: out.risk_level,
        risk_score: out.risk_score ?? 0,
        flags: out.flags || [],
      });
    } finally {
      setCheckingId(null);
    }
  };

  const move = (id, to_status) => status.mutate({ id, to_status });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Broadcasts"
        subtitle="One-off sends. A broadcast cannot leave draft without a passing policy check."
        count={rows.length}
      />

      <Toolbar
        right={
          <>
            <ToolSearch value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search broadcasts…" />
            <div className="w-40">
              <Select value={channel} onChange={(e) => setChannel(e.target.value)} options={BROADCAST_CHANNELS} placeholder="All channels" />
            </div>
          </>
        }
      >
        <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)} className="!py-1.5 !px-3 !text-[12px]">
          New broadcast
        </Button>
        <ToolButton icon={ShieldCheck} disabled title="Select a broadcast row to run its policy check">Policy check</ToolButton>
        <ToolButton icon={Send} disabled title="Sending is per-broadcast — use the row action">Send</ToolButton>
        <ToolButton icon={Pause} disabled title="Pausing is per-broadcast — use the row action">Pause</ToolButton>
        <ToolButton icon={RefreshCw} onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </ToolButton>
      </Toolbar>

      <StatsStrip
        items={[
          { label: 'Total', value: rows.length, tone: 'violet' },
          { label: 'Draft', value: rows.filter((b) => b.status === 'draft').length, tone: 'slate' },
          { label: 'Scheduled', value: rows.filter((b) => b.status === 'scheduled').length, tone: 'blue' },
          { label: 'Sending', value: rows.filter((b) => b.status === 'sending').length, tone: 'violet' },
          { label: 'Sent', value: rows.filter((b) => b.status === 'sent').length, tone: 'green' },
          { label: 'Policy checked', value: rows.filter((b) => b.policy_risk_level).length, tone: 'amber' },
          { label: 'Delivered', value: null, tone: 'slate', note: 'needs a send provider' },
        ]}
      />

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>New Broadcast</Button>
          <Button icon={RefreshCw} onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search broadcasts…" />
          <div className="w-44">
            <Select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              options={BROADCAST_CHANNELS}
              placeholder="All channels"
            />
          </div>
        </div>
      </Card>

      {(status.isError || del.isError || policy.isError) && (
        <ErrorNote error={status.error || del.error || policy.error} />
      )}

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center text-slate-300"><Loader2 size={20} className="animate-spin" /></div>
        ) : !rows.length ? (
          <div className="p-6">
            <EmptyState
              icon={Radio}
              title="No broadcasts yet"
              body="A broadcast is a one-off send to an audience. Create one, run the policy check, then send."
              action={<Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>New Broadcast</Button>}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-[#EEF1F6]">
                  {['Name', 'Channel', 'Status', 'Policy', 'Scheduled', 'Created', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const next = NEXT_BROADCAST_STATUSES[b.status] || [];
                  const busy = checkingId === b.id;
                  return (
                    <tr key={b.id} className="border-b border-[#F4F6FA] last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#0F1929] truncate max-w-[220px]">{b.name}</p>
                        <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{b.body}</p>
                      </td>
                      <td className="px-4 py-3"><Badge tone="blue">{b.channel}</Badge></td>
                      <td className="px-4 py-3"><Badge tone={TONE[b.status]}>{LABEL[b.status] || b.status}</Badge></td>
                      <td className="px-4 py-3">
                        {b.policy_risk_level ? (
                          <button
                            onClick={() => setPolicyFor(b)}
                            title="View the full verdict"
                            className="text-left"
                          >
                            <Badge tone={RISK_TONE[b.policy_risk_level]}>
                              {b.policy_risk_level} · {b.policy_risk_score}
                            </Badge>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {b.policy_checked_at ? timeAgo(b.policy_checked_at) : ''}
                            </p>
                          </button>
                        ) : (
                          // Distinguishes "never checked" from "checked, then
                          // edited". The server clears the verdict on any edit
                          // to body/content/channel, so a broadcast that was
                          // green a moment ago and now reads "recheck required"
                          // is telling the truth about what happened.
                          <span
                            className="text-[11px] text-slate-400"
                            title="A policy check is required before this can send"
                          >
                            {b.status === 'draft' || b.status === 'scheduled'
                              ? 'recheck required'
                              : 'not checked'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-400">{timeAgo(b.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            icon={busy ? Loader2 : (b.policy_risk_level ? ShieldCheck : ShieldAlert)}
                            onClick={() => checkPolicy(b)}
                            disabled={busy}
                            className="!px-2.5 !py-1.5 !text-[11px]"
                          >
                            {busy ? 'Checking…' : 'Check policy'}
                          </Button>
                          {next.includes('sending') && (
                            <Button
                              variant="primary" icon={Send}
                              onClick={() => move(b.id, 'sending')}
                              className="!px-2.5 !py-1.5 !text-[11px]"
                            >
                              Send
                            </Button>
                          )}
                          {next.includes('paused') && (
                            <Button icon={Pause} onClick={() => move(b.id, 'paused')} className="!px-2 !py-1.5" />
                          )}
                          {next.includes('cancelled') && (
                            <Button icon={Ban} onClick={() => move(b.id, 'cancelled')} className="!px-2 !py-1.5" />
                          )}
                          <Button
                            variant="danger" icon={Trash2}
                            onClick={() => del.mutate(b.id)}
                            className="!px-2 !py-1.5"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateBroadcastModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {policyFor && <PolicyVerdictModal broadcast={policyFor} onClose={() => setPolicyFor(null)} />}
    </div>
  );
}

/** The stored verdict, readable at any time.
 *
 *  Previously the flag list appeared once as a toast at check time and was
 *  then unreachable — so a broadcast held back for review showed a red badge
 *  with no way to see *why* short of re-running the check. All of this reads
 *  straight off the broadcast row; there is no extra fetch. */
function PolicyVerdictModal({ broadcast: b, onClose }) {
  const flags = Array.isArray(b.policy_flags) ? b.policy_flags : [];
  const blocking = flags.filter((f) => f.severity === 'block');

  return (
    <Modal
      open
      onClose={onClose}
      title="Policy check verdict"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex items-center gap-2 mb-3">
        <Badge tone={RISK_TONE[b.policy_risk_level]}>
          {b.policy_risk_level} risk · {b.policy_risk_score}/100
        </Badge>
        <span className="text-[11px] text-slate-400">
          checked {b.policy_checked_at ? timeAgo(b.policy_checked_at) : 'unknown'}
        </span>
      </div>

      {blocking.length > 0 && (
        <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {blocking.length} blocking issue{blocking.length === 1 ? '' : 's'} — this cannot send until resolved.
        </p>
      )}

      {flags.length === 0 ? (
        <p className="text-[12px] text-slate-500">No issues were flagged.</p>
      ) : (
        <ul className="space-y-2">
          {flags.map((f, i) => (
            <li key={i} className="rounded-lg border border-[#E4E8F0] bg-white p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge tone={f.severity === 'block' ? 'red' : f.severity === 'warn' ? 'amber' : 'slate'}>
                  {f.severity}
                </Badge>
                <span className="text-[12px] font-semibold text-[#0F1929]">{f.issue}</span>
              </div>
              {f.offending_text && (
                <p className="text-[11px] font-mono text-red-600 bg-red-50 rounded px-2 py-1 my-1">
                  “{f.offending_text}”
                </p>
              )}
              {f.fix && <p className="text-[11px] text-slate-600">Fix: {f.fix}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-slate-400 mt-3">
        Editing the message body, content, or channel clears this verdict — a check
        only describes the message it was run against.
      </p>
    </Modal>
  );
}

function CreateBroadcastModal({ open, onClose }) {
  const create = useCreateBroadcast();
  const { data: audiences = [] } = useAudiences();
  const draft = useRunMarketingAgent();

  const [form, setForm] = useState({
    name: '', channel: 'whatsapp', body: '', subject: '', audience_id: '', scheduled_at: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const askAI = async () => {
    const res = await draft.mutateAsync({
      message: `Draft a ${form.channel} broadcast message${form.name ? ` for "${form.name}"` : ''}. Keep it short and compliant.`,
    });
    const out = res?.output ? Object.values(res.output)[0] : null;
    const text = out?.body || out?.primary_texts?.[0] || out?.variants?.[0]?.body || out?.message;
    if (text) setForm((f) => ({ ...f, body: text }));
  };

  const submit = async () => {
    await create.mutateAsync({
      name: form.name.trim(),
      channel: form.channel,
      body: form.body.trim(),
      subject: form.subject.trim() || null,
      audience_id: form.audience_id || null,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    });
    setForm({ name: '', channel: 'whatsapp', body: '', subject: '', audience_id: '', scheduled_at: '' });
    onClose();
  };

  const valid = form.name.trim() && form.body.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Broadcast"
      subtitle="It starts as a draft. You'll run the policy check before it can send."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </>
      }
    >
      <ErrorNote error={create.error} />
      <Field label="Name" required>
        <Input value={form.name} onChange={set('name')} placeholder="Diwali offer — WhatsApp" />
      </Field>
      <Field label="Channel" required>
        <Select value={form.channel} onChange={set('channel')} options={BROADCAST_CHANNELS} />
      </Field>
      {form.channel === 'email' && (
        <Field label="Subject">
          <Input value={form.subject} onChange={set('subject')} placeholder="20% off this week" />
        </Field>
      )}
      <Field label="Message" required hint="Use {{name}} for personalization.">
        <Textarea value={form.body} onChange={set('body')} placeholder="Hi {{name}}, …" />
      </Field>
      <Button
        icon={draft.isPending ? Loader2 : undefined}
        onClick={askAI}
        disabled={draft.isPending}
        className="mb-4"
      >
        {draft.isPending ? 'Drafting…' : 'Draft with AI'}
      </Button>
      <Field label="Audience" hint="Optional. Audiences are managed in the Audience tab.">
        <Select
          value={form.audience_id}
          onChange={set('audience_id')}
          options={audiences.map((a) => ({ value: a.id, label: a.name }))}
          placeholder="No audience"
        />
      </Field>
      <Field label="Schedule for" hint="Leave empty to keep it a draft.">
        <Input type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} />
      </Field>
    </Modal>
  );
}
