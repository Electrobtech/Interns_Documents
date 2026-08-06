'use client';
/**
 * Campaign detail drawer — Overview · Items · Delivery.
 *
 * Items are the message sequence the `campaign_planner` capability emits.
 * Until the item CRUD endpoints existed, adjusting one AI-drafted message
 * meant regenerating the whole campaign; this is where that's fixed.
 *
 * Delivery reads `marketing_campaign_recipients`. When a campaign hasn't sent,
 * it says so — it does not render a 0% delivery rate, which would be
 * indistinguishable from "sent and nobody received it".
 *
 * Reordering is up/down controls writing `sequence`, not drag-and-drop:
 * nothing else in the hub has drag-and-drop, and a drip sequence is a handful
 * of rows, so this isn't the place to introduce an inconsistent interaction.
 */
import { useState } from 'react';
import {
  X, Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, Search,
  AlertTriangle, Inbox, Send,
} from 'lucide-react';

import {
  useCampaign, useCampaignHistory, useCampaignItems, useAddCampaignItem,
  useUpdateCampaignItem, useDeleteCampaignItem, useCampaignRecipients,
  PLATFORMS, STATUSES, OBJECTIVES, DELIVERY_STATUSES, ITEM_EDITABLE_STATUSES,
} from '@/lib/queries/campaigns';
import { Card, Badge, Button, EmptyState, fmt } from './MarketingUI';
import { Skeleton, useToast, timeAgo } from './sections/Shared';

const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.label]));
const STATUS_TONE = Object.fromEntries(STATUSES.map((s) => [s.value, s.tone]));
const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));
const OBJECTIVE_LABEL = Object.fromEntries(OBJECTIVES.map((o) => [o.value, o.label]));
const DELIVERY_TONE = Object.fromEntries(DELIVERY_STATUSES.map((d) => [d.value, d.tone]));
const DELIVERY_LABEL = Object.fromEntries(DELIVERY_STATUSES.map((d) => [d.value, d.label]));

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'items', label: 'Items' },
  { id: 'delivery', label: 'Delivery' },
];

export default function CampaignDetailDrawer({ campaignId, onClose, onEdit }) {
  const [tab, setTab] = useState('overview');
  const { data: campaign, isLoading } = useCampaign(campaignId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px]" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-[#F7F8FC] h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#E4E8F0] px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {isLoading ? (
                <Skeleton className="h-6 w-52" />
              ) : (
                <>
                  <h2
                    className="text-lg font-bold text-[#0F1929] truncate"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {campaign?.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge tone={STATUS_TONE[campaign?.status]}>
                      {STATUS_LABEL[campaign?.status] || campaign?.status}
                    </Badge>
                    <Badge tone="violet">
                      {OBJECTIVE_LABEL[campaign?.objective] || campaign?.objective}
                    </Badge>
                    <span className="text-[11px] text-slate-400">
                      Updated {timeAgo(campaign?.updated_at)}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onEdit && <Button icon={Pencil} onClick={() => onEdit(campaignId)}>Edit</Button>}
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-xl text-slate-400 hover:bg-slate-100 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex gap-1 mt-4 -mb-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-[13px] font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-rose-600 text-rose-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 flex-1">
          {tab === 'overview' && <Overview campaign={campaign} isLoading={isLoading} />}
          {tab === 'items' && <Items campaignId={campaignId} campaign={campaign} />}
          {tab === 'delivery' && <Delivery campaignId={campaignId} campaign={campaign} />}
        </div>
      </div>
    </div>
  );
}

/* ── Overview ───────────────────────────────────────────────────────── */

function Overview({ campaign, isLoading }) {
  const { data: history } = useCampaignHistory(campaign?.id);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!campaign) return null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
          <Field label="Budget">
            <span className="font-mono">
              {campaign.currency} {Number(campaign.budget_amount).toLocaleString()}
            </span>
            <span className="text-slate-400 text-[11px] ml-1.5">{campaign.budget_type}</span>
          </Field>
          <Field label="Bid strategy">{campaign.bid_strategy}</Field>
          <Field label="Platforms">
            {(campaign.platforms || []).map((p) => PLATFORM_LABEL[p] || p).join(', ') || '—'}
          </Field>
          <Field label="Timezone">{campaign.timezone}</Field>
          <Field label="Starts">{fmtDate(campaign.start_date)}</Field>
          <Field label="Ends">{fmtDate(campaign.end_date)}</Field>
        </dl>
        {campaign.description && (
          <p className="text-[13px] text-slate-600 mt-4 pt-4 border-t border-[#EEF1F6]">
            {campaign.description}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-bold text-[#0F1929] mb-3">Status history</h3>
        {!history?.length ? (
          <p className="text-[12px] text-slate-400">No transitions recorded yet.</p>
        ) : (
          <ol className="space-y-2.5">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-2.5 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-700">
                    {h.from_status || 'created'} → <strong>{h.to_status}</strong>
                  </span>
                  <span className="text-slate-400 ml-2">{timeAgo(h.created_at)}</span>
                  {h.reason && <p className="text-slate-500 mt-0.5">{h.reason}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-slate-700 mt-0.5">{children}</dd>
    </div>
  );
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Items ──────────────────────────────────────────────────────────── */

function Items({ campaignId, campaign }) {
  const toast = useToast();
  const { data: items, isLoading } = useCampaignItems(campaignId);
  const add = useAddCampaignItem(campaignId);
  const update = useUpdateCampaignItem(campaignId);
  const del = useDeleteCampaignItem(campaignId);

  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const editable = ITEM_EDITABLE_STATUSES.includes(campaign?.status);
  const rows = [...(items || [])].sort((a, b) => a.sequence - b.sequence);

  const move = async (item, dir) => {
    const idx = rows.findIndex((r) => r.id === item.id);
    const swap = rows[idx + dir];
    if (!swap) return;
    try {
      // Two writes, not one: there's no bulk-reorder endpoint, and swapping
      // the pair is enough for the up/down affordance offered here.
      await update.mutateAsync({ itemId: item.id, sequence: swap.sequence });
      await update.mutateAsync({ itemId: swap.id, sequence: item.sequence });
    } catch (e) {
      toast({ tone: 'error', message: e.message || 'Could not reorder.' });
    }
  };

  const save = async (body, itemId) => {
    try {
      if (itemId) await update.mutateAsync({ itemId, ...body });
      else await add.mutateAsync(body);
      setEditing(null);
      setAdding(false);
      toast({ message: itemId ? 'Message updated.' : 'Message added.' });
    } catch (e) {
      toast({ tone: 'error', message: e.message || 'Could not save.' });
    }
  };

  const remove = async (item) => {
    try {
      await del.mutateAsync(item.id);
      toast({ message: 'Message removed.' });
    } catch (e) {
      toast({ tone: 'error', message: e.message || 'Could not remove.' });
    }
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-3">
      {!editable && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-amber-800">
            This campaign is <strong>{campaign?.status}</strong>, so its message sequence is locked.
            Editing a message now would change what later recipients get relative to those already sent.
          </p>
        </div>
      )}

      {rows.length === 0 && !adding ? (
        <EmptyState
          icon={Inbox}
          title="No messages in this sequence"
          body="Add one, or ask the Marketing Agent to draft a sequence for this campaign."
          action={
            editable && (
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add message
              </Button>
            )
          }
        />
      ) : (
        rows.map((item, i) =>
          editing === item.id ? (
            <ItemForm
              key={item.id}
              initial={item}
              busy={update.isPending}
              onCancel={() => setEditing(null)}
              onSave={(body) => save(body, item.id)}
            />
          ) : (
            <Card key={item.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 text-[12px] font-bold flex items-center justify-center">
                    {item.sequence}
                  </span>
                  {editable && (
                    <>
                      <IconMini icon={ChevronUp} label="Move up" disabled={i === 0}
                                onClick={() => move(item, -1)} />
                      <IconMini icon={ChevronDown} label="Move down" disabled={i === rows.length - 1}
                                onClick={() => move(item, 1)} />
                    </>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge tone="slate">{PLATFORM_LABEL[item.channel] || item.channel}</Badge>
                    <span className="text-[11px] text-slate-400">
                      Day {item.day_offset}
                    </span>
                    {item.call_to_action && (
                      <span className="text-[11px] text-rose-600">CTA: {item.call_to_action}</span>
                    )}
                  </div>
                  {item.subject && (
                    <p className="text-[13px] font-semibold text-slate-800">{item.subject}</p>
                  )}
                  <p className="text-[13px] text-slate-600 whitespace-pre-wrap">{item.message_body}</p>
                </div>

                {editable && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <IconMini icon={Pencil} label="Edit" onClick={() => setEditing(item.id)} />
                    <IconMini icon={Trash2} label="Remove" danger onClick={() => remove(item)} />
                  </div>
                )}
              </div>
            </Card>
          ),
        )
      )}

      {adding && (
        <ItemForm
          initial={{ sequence: (rows.at(-1)?.sequence ?? 0) + 1, channel: campaign?.platforms?.[0] || 'whatsapp' }}
          busy={add.isPending}
          onCancel={() => setAdding(false)}
          onSave={(body) => save(body)}
        />
      )}

      {editable && rows.length > 0 && !adding && (
        <Button icon={Plus} onClick={() => setAdding(true)}>Add message</Button>
      )}
    </div>
  );
}

function ItemForm({ initial, onSave, onCancel, busy }) {
  const [form, setForm] = useState({
    sequence: initial.sequence ?? 1,
    channel: initial.channel ?? 'whatsapp',
    day_offset: initial.day_offset ?? 0,
    subject: initial.subject ?? '',
    message_body: initial.message_body ?? '',
    call_to_action: initial.call_to_action ?? '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () =>
    onSave({
      sequence: Number(form.sequence),
      channel: form.channel,
      day_offset: Number(form.day_offset),
      subject: form.subject || null,
      message_body: form.message_body,
      call_to_action: form.call_to_action || null,
    });

  return (
    <Card className="p-4 border-rose-200">
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Labeled label="Sequence">
          <input type="number" min={0} value={form.sequence} onChange={set('sequence')} className={inputCls} />
        </Labeled>
        <Labeled label="Channel">
          <select value={form.channel} onChange={set('channel')} className={inputCls}>
            {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Labeled>
        <Labeled label="Day offset">
          <input type="number" min={0} value={form.day_offset} onChange={set('day_offset')} className={inputCls} />
        </Labeled>
      </div>
      <Labeled label="Subject (optional)">
        <input value={form.subject} onChange={set('subject')} className={inputCls} />
      </Labeled>
      <div className="mt-3">
        <Labeled label="Message">
          <textarea rows={4} value={form.message_body} onChange={set('message_body')} className={inputCls} />
        </Labeled>
      </div>
      <div className="mt-3">
        <Labeled label="Call to action (optional)">
          <input value={form.call_to_action} onChange={set('call_to_action')} className={inputCls} />
        </Labeled>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" icon={Check} onClick={submit} disabled={busy || !form.message_body.trim()}>
          {busy ? 'Saving…' : 'Save message'}
        </Button>
      </div>
    </Card>
  );
}

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-[#E4E8F0] outline-none ' +
  'focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all';

function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-500 block mb-1">{label}</span>
      {children}
    </label>
  );
}

function IconMini({ icon: Icon, label, onClick, disabled, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors
        disabled:opacity-25 disabled:cursor-not-allowed ${
          danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
        }`}
    >
      <Icon size={13} />
    </button>
  );
}

/* ── Delivery ───────────────────────────────────────────────────────── */

function Delivery({ campaignId, campaign }) {
  const [status, setStatus] = useState(null);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCampaignRecipients(campaignId, {
    status: status ? [status] : undefined,
    search: search || undefined,
  });

  const counts = data?.counts || {};
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  // No recipient rows at all — say so plainly. A 0% delivery rate here would
  // read as "sent and nobody got it", which is a different and worse claim.
  if (totalAll === 0) {
    return (
      <EmptyState
        icon={Send}
        title="Not yet sent"
        body={
          campaign?.status === 'running' || campaign?.status === 'completed'
            ? 'This campaign has no recipient rows. Delivery is recorded per person as messages go out.'
            : `This campaign is ${campaign?.status}. Delivery figures appear once it starts sending.`
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* funnel counts — click to filter */}
      <div className="flex flex-wrap gap-2">
        <CountChip label="All" value={totalAll} active={!status} onClick={() => setStatus(null)} />
        {DELIVERY_STATUSES.filter((d) => counts[d.value]).map((d) => (
          <CountChip
            key={d.value}
            label={d.label}
            value={counts[d.value]}
            tone={d.tone}
            active={status === d.value}
            onClick={() => setStatus(status === d.value ? null : d.value)}
          />
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by destination or name…"
          className={`${inputCls} pl-9`}
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-[#E4E8F0]">
                <Th>Recipient</Th>
                <Th>Status</Th>
                <Th>Attempts</Th>
                <Th>Sent</Th>
                <Th>Opened</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} className="border-b border-[#EEF1F6] hover:bg-slate-50/70">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">{r.display_name || '—'}</p>
                    <p className="text-[11px] font-mono text-slate-400">{r.destination}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={DELIVERY_TONE[r.status]}>{DELIVERY_LABEL[r.status] || r.status}</Badge>
                    {r.last_error && (
                      <p className="text-[10px] text-red-500 mt-0.5 max-w-[180px] truncate" title={r.last_error}>
                        {r.last_error}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-slate-500">
                    {r.attempts}/{r.max_attempts}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-400">{r.sent_at ? timeAgo(r.sent_at) : '—'}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-400">{r.opened_at ? timeAgo(r.opened_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.total > data.items.length && (
          <p className="text-[11px] text-slate-400 px-4 py-2.5 border-t border-[#EEF1F6]">
            Showing {data.items.length} of {data.total}
          </p>
        )}
      </Card>
    </div>
  );
}

function CountChip({ label, value, tone = 'slate', active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl border text-[12px] transition-colors ${
        active ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-[#E4E8F0] bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label} <span className="font-mono font-semibold ml-0.5">{value}</span>
    </button>
  );
}

function Th({ children }) {
  return (
    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
      {children}
    </th>
  );
}
