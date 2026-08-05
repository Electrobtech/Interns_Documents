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
import { Modal, Field, Input, Textarea, Select, SearchInput, ErrorNote, timeAgo } from './Shared';

const TONE = Object.fromEntries(BROADCAST_STATUSES.map((s) => [s.value, s.tone]));
const LABEL = Object.fromEntries(BROADCAST_STATUSES.map((s) => [s.value, s.label]));
const RISK_TONE = { low: 'green', medium: 'amber', high: 'red', critical: 'red' };

export default function Broadcasts() {
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [checkingId, setCheckingId] = useState(null);

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
                          <Badge tone={RISK_TONE[b.policy_risk_level]}>
                            {b.policy_risk_level} · {b.policy_risk_score}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-slate-300">not checked</span>
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
    </div>
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
