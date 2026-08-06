'use client';
/**
 * Audience — saved targeting definitions at /ai-agents/marketing/audiences,
 * plus the `persona` capability for building an ICP.
 *
 * `size` is a cached estimate, so it renders with the age of the computation
 * rather than as a live number. It stays blank until something computes it —
 * a made-up audience size would drive real budget decisions.
 */
import { useState } from 'react';
import { Users, Plus, Loader2, Pencil, Trash2, Megaphone, Calculator, X } from 'lucide-react';

import {
  useAudiences, useCreateAudience, useAudience, useUpdateAudience,
  useDeleteAudience, useAudienceCampaigns, useEstimateAudienceSize, STATUSES,
} from '@/lib/queries/campaigns';
import { Card, Badge, Button, EmptyState, SectionTitle, fmt } from '../MarketingUI';
import {
  PageHeader, Toolbar, ToolButton, ToolSearch, StatsStrip,
} from '../HubUI';
import {
  AIPanel, Modal, Field, Input, Textarea, Select, SearchInput, TagsInput, ErrorNote, timeAgo,
  ConfirmDialog, useToast,
} from './Shared';

const STATUS_TONE = Object.fromEntries(STATUSES.map((s) => [s.value, s.tone]));

const AUDIENCE_TYPES = [
  { value: 'rule_based', label: 'Rule-based' },
  { value: 'custom', label: 'Custom' },
  { value: 'lookalike', label: 'Lookalike' },
  { value: 'saved', label: 'Saved' },
];

const TYPE_LABEL = Object.fromEntries(AUDIENCE_TYPES.map((t) => [t.value, t.label]));

export default function Audience() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const toast = useToast();
  const { data: rows = [], isLoading } = useAudiences(search || undefined);
  const create = useCreateAudience();
  const del = useDeleteAudience();

  const doDelete = async () => {
    try {
      await del.mutateAsync(confirmDelete.id);
      toast({ message: `Deleted "${confirmDelete.name}".` });
    } catch (e) {
      // The server's in-use guard names the blocking campaigns — show that,
      // not a generic failure.
      toast({ tone: 'error', message: e.message || 'Could not delete audience.' });
    }
    setConfirmDelete(null);
  };

  const saveFromAI = async (out) => {
    const personas = out?.personas || (out?.persona ? [out.persona] : []);
    const list = personas.length ? personas : [out];
    for (const p of list) {
      const name = p?.name || p?.persona_name || p?.title;
      if (!name) continue;
      await create.mutateAsync({
        name: String(name).slice(0, 200),
        description: p?.summary || p?.description || null,
        audience_type: 'custom',
        // The persona is the rule at this stage — no filter engine has turned
        // it into predicates yet, so it's stored as-is rather than as a fake
        // rule tree that would silently match nobody.
        filters: { persona: p },
        tags: p?.segments || p?.tags || [],
      });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audience"
        subtitle="Targeting rules. Sizes are cached estimates shown with their age, never live counts."
        count={rows.length}
      />

      <Toolbar
        right={<ToolSearch value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audiences…" />}
      >
        <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)} className="!py-1.5 !px-3 !text-[12px]">
          New audience
        </Button>
        <ToolButton icon={Calculator} disabled title="Open an audience to record a size estimate">Estimate size</ToolButton>
        <ToolButton icon={Megaphone} disabled title="Open an audience to see the campaigns using it">Used by</ToolButton>
      </Toolbar>

      <StatsStrip
        items={[
          { label: 'Audiences', value: rows.length, tone: 'violet' },
          { label: 'Rule-based', value: rows.filter((a) => a.audience_type === 'rule_based').length, tone: 'blue' },
          { label: 'Lookalike', value: rows.filter((a) => a.audience_type === 'lookalike').length, tone: 'green' },
          { label: 'Estimated', value: rows.filter((a) => a.size != null).length, tone: 'amber' },
          { label: 'In use', value: rows.filter((a) => a.campaign_count > 0).length, tone: 'violet' },
          { label: 'Reachable', value: null, tone: 'slate', note: 'needs CRM contacts' },
        ]}
      />

      <AIPanel
        capability="persona"
        placeholder="e.g. Build personas for our mid-market WhatsApp automation buyers"
        examples={['Define our ICP', 'Personas for enterprise buyers']}
        onSave={saveFromAI}
        saving={create.isPending}
        saveLabel="Save as audiences"
        renderResult={(out) => {
          const personas = out?.personas || (out?.persona ? [out.persona] : [out]);
          return (
            <div className="space-y-3">
              {personas.map((p, i) => (
                <div key={i} className="rounded-lg border border-[#E4E8F0] bg-white p-3">
                  <p className="text-[13px] font-semibold text-[#0F1929]">
                    {p?.name || p?.persona_name || `Persona ${i + 1}`}
                  </p>
                  {(p?.summary || p?.description) && (
                    <p className="text-[12px] text-slate-600 mt-1">{p.summary || p.description}</p>
                  )}
                  {p?.pain_points?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
                        Pain points
                      </p>
                      {p.pain_points.map((pt, j) => (
                        <p key={j} className="text-[11px] text-slate-600">· {typeof pt === 'string' ? pt : JSON.stringify(pt)}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        }}
      />

      <Card className="p-4">
        <SectionTitle
          title="Saved audiences"
          subtitle="A targeting rule, not a member list — contacts stay in the CRM."
          action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>New audience</Button>}
        />
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audiences…" />
      </Card>

      <ErrorNote error={create.error} />

      {isLoading ? (
        <Card className="p-10 flex justify-center text-slate-300"><Loader2 size={20} className="animate-spin" /></Card>
      ) : !rows.length ? (
        <Card className="p-5">
          <EmptyState
            icon={Users}
            title="No audiences yet"
            body="Build a persona above and save it, or define a targeting rule manually."
            action={<Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>New audience</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((a) => (
            <Card key={a.id} hover className="p-4 group">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <button
                  onClick={() => setDetailId(a.id)}
                  className="text-sm font-semibold text-[#0F1929] truncate text-left hover:text-rose-600"
                >
                  {a.name}
                </button>
                <Badge tone="blue">{TYPE_LABEL[a.audience_type] || a.audience_type}</Badge>
              </div>
              {a.description && <p className="text-[12px] text-slate-600 line-clamp-3">{a.description}</p>}

              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-lg font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {fmt(a.size)}
                </span>
                <span className="text-[11px] text-slate-400">
                  {a.size_computed_at ? `estimated ${timeAgo(a.size_computed_at)}` : 'size not computed'}
                </span>
              </div>

              {a.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {a.tags.map((t) => <Badge key={t} tone="slate">{t}</Badge>)}
                </div>
              )}

              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#EEF1F6]">
                {a.ai_generated && <Badge tone="violet">AI</Badge>}
                {a.campaign_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <Megaphone size={10} /> {a.campaign_count}
                  </span>
                )}
                <span className="text-[10px] text-slate-400 ml-auto">{timeAgo(a.created_at)}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <IconBtn label="Edit" icon={Pencil} onClick={() => setEditing(a)} />
                  <IconBtn label="Delete" icon={Trash2} danger onClick={() => setConfirmDelete(a)} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewAudienceModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {editing && <EditAudienceModal audience={editing} onClose={() => setEditing(null)} />}

      {detailId && (
        <AudienceDetail
          audienceId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(a) => { setDetailId(null); setEditing(a); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        busy={del.isPending}
        title="Delete audience?"
        message={
          confirmDelete?.campaign_count > 0
            ? `"${confirmDelete.name}" is targeted by ${confirmDelete.campaign_count} campaign(s). The server refuses this while any are still active.`
            : `Delete "${confirmDelete?.name}"? Campaigns that already ran keep their history.`
        }
      />
    </div>
  );
}

function IconBtn({ label, icon: Icon, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-7 h-7 rounded-lg border bg-white transition-colors flex items-center justify-center ${
        danger ? 'border-red-200 text-red-500 hover:bg-red-50'
               : 'border-[#E4E8F0] text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      <Icon size={12} />
    </button>
  );
}

/** Editing the rule clears the cached size server-side — the old estimate
 *  describes a different audience — so the form says so before saving. */
function EditAudienceModal({ audience, onClose }) {
  const toast = useToast();
  const update = useUpdateAudience();
  const [form, setForm] = useState({
    name: audience.name ?? '',
    description: audience.description ?? '',
    audience_type: audience.audience_type ?? 'rule_based',
    tags: audience.tags ?? [],
    filters: JSON.stringify(audience.filters ?? {}, null, 2),
  });
  const [jsonError, setJsonError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const original = JSON.stringify(audience.filters ?? {}, null, 2);
  const ruleChanged = form.filters !== original;

  const submit = async () => {
    let filters;
    try {
      filters = JSON.parse(form.filters);
    } catch {
      setJsonError('Not valid JSON — check for a trailing comma or an unquoted key.');
      return;
    }
    try {
      await update.mutateAsync({
        id: audience.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        audience_type: form.audience_type,
        tags: form.tags,
        ...(ruleChanged ? { filters } : {}),
      });
      toast({ message: 'Audience updated.' });
      onClose();
    } catch (e) {
      toast({ tone: 'error', message: e.message || 'Could not save audience.' });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit audience"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!form.name.trim() || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <ErrorNote error={update.error} />
      <Field label="Name" required>
        <Input value={form.name} onChange={set('name')} />
      </Field>
      <Field label="Type" required>
        <Select value={form.audience_type} onChange={set('audience_type')} options={AUDIENCE_TYPES} />
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={set('description')} />
      </Field>
      <Field label="Tags">
        <TagsInput value={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
      </Field>
      <Field label="Targeting rule" hint="Stored as-is; no filter engine translates it yet.">
        <Textarea
          rows={6}
          value={form.filters}
          onChange={(e) => { setJsonError(null); set('filters')(e); }}
          className="font-mono text-[12px]"
        />
      </Field>
      {jsonError && <p className="text-[11px] text-red-600 mb-2">{jsonError}</p>}
      {ruleChanged && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Changing the rule clears the cached size estimate.
        </p>
      )}
    </Modal>
  );
}

function AudienceDetail({ audienceId, onClose, onEdit }) {
  const toast = useToast();
  const { data: audience, isLoading } = useAudience(audienceId);
  const { data: campaigns = [] } = useAudienceCampaigns(audienceId);
  const estimate = useEstimateAudienceSize();
  const [sizeInput, setSizeInput] = useState('');

  const saveEstimate = async () => {
    const n = Number(sizeInput);
    if (!Number.isFinite(n) || n < 0) {
      toast({ tone: 'error', message: 'Enter a whole number of contacts.' });
      return;
    }
    try {
      await estimate.mutateAsync({ id: audienceId, size: Math.round(n) });
      setSizeInput('');
      toast({ message: 'Size estimate recorded.' });
    } catch (e) {
      toast({ tone: 'error', message: e.message || 'Could not record estimate.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#F7F8FC] h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-[#E4E8F0] px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {isLoading ? (
              <div className="h-6 w-40 bg-slate-100 rounded animate-pulse" />
            ) : (
              <>
                <h2 className="text-lg font-bold text-[#0F1929] truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {audience?.name}
                </h2>
                <Badge tone="blue">{TYPE_LABEL[audience?.audience_type] || audience?.audience_type}</Badge>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {audience && <Button icon={Pencil} onClick={() => onEdit(audience)}>Edit</Button>}
            <button onClick={onClose} aria-label="Close"
                    className="w-9 h-9 rounded-xl text-slate-400 hover:bg-slate-100 flex items-center justify-center">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <Card className="p-4">
            <SectionTitle title="Estimated size" subtitle="Recorded against this rule — not measured live" />
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {fmt(audience?.size)}
              </span>
              <span className="text-[11px] text-slate-400">
                {audience?.size_computed_at ? `as of ${timeAgo(audience.size_computed_at)}` : 'not yet estimated'}
              </span>
            </div>
            <div className="flex items-end gap-2 mt-3 pt-3 border-t border-[#EEF1F6]">
              <div className="flex-1">
                <Field label="Record an estimate">
                  <Input type="number" min={0} value={sizeInput}
                         onChange={(e) => setSizeInput(e.target.value)} placeholder="e.g. 4820" />
                </Field>
              </div>
              <Button icon={Calculator} onClick={saveEstimate} disabled={estimate.isPending || !sizeInput}>
                {estimate.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Orbq holds the rule, not the contacts, so the count comes from wherever the rule
              can actually be evaluated. Storing it keeps its age visible.
            </p>
          </Card>

          <Card className="p-4">
            <SectionTitle title="Targeting rule" />
            <pre className="text-[11px] font-mono text-slate-600 bg-slate-50 rounded-xl p-3 overflow-x-auto">
              {JSON.stringify(audience?.filters ?? {}, null, 2)}
            </pre>
          </Card>

          <Card className="p-4">
            <SectionTitle title="Used by" subtitle="Campaigns targeting this audience" />
            {campaigns.length === 0 ? (
              <p className="text-[12px] text-slate-400">No campaigns target this audience.</p>
            ) : (
              <ul className="space-y-2">
                {campaigns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-slate-700 truncate">{c.name}</span>
                    <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function NewAudienceModal({ open, onClose }) {
  const create = useCreateAudience();
  const [form, setForm] = useState({ name: '', description: '', audience_type: 'rule_based', tags: [] });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    await create.mutateAsync({
      name: form.name.trim(),
      description: form.description.trim() || null,
      audience_type: form.audience_type,
      tags: form.tags,
    });
    setForm({ name: '', description: '', audience_type: 'rule_based', tags: [] });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New audience"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!form.name.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </>
      }
    >
      <ErrorNote error={create.error} />
      <Field label="Name" required>
        <Input value={form.name} onChange={set('name')} placeholder="Mid-market SaaS buyers" />
      </Field>
      <Field label="Type" required>
        <Select value={form.audience_type} onChange={set('audience_type')} options={AUDIENCE_TYPES} />
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={set('description')} placeholder="Who is in this audience and why" />
      </Field>
      <Field label="Tags" hint="Comma-separated.">
        <TagsInput value={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} placeholder="smb, india" />
      </Field>
    </Modal>
  );
}
