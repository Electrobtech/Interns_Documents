'use client';
/**
 * Competitor Analysis — competitors and their snapshots, persisted at
 * /ai-agents/marketing/competitors.
 *
 * `unverified_claim_count` and `data_gaps` are surfaced prominently rather
 * than buried: competitor intel is the capability most prone to confident
 * invention, so the UI shows how much of a snapshot is unsupported.
 */
import { useState } from 'react';
import { BarChart2, Plus, ChevronRight, Loader2, AlertTriangle, Pencil, Trash2 } from 'lucide-react';

import {
  useCompetitors, useCreateCompetitor, useCompetitorSnapshots, useAddCompetitorSnapshot,
  useCompetitor, useUpdateCompetitor, useDeleteCompetitor, useDeleteSnapshot,
} from '@/lib/queries/marketing';
import { Card, Badge, Button, EmptyState, SectionTitle } from '../MarketingUI';
import {
  PageHeader, Toolbar, ToolButton, ToolSearch, StatsStrip,
} from '../HubUI';
import {
  AIPanel, Modal, Field, Input, TagsInput, ErrorNote, timeAgo, fmtDate, ConfirmDialog,
} from './Shared';

export default function CompetitorAnalysis() {
  const [createOpen, setCreateOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const del = useDeleteCompetitor();

  // Two or three reads well side by side; more becomes unreadable columns.
  const toggleCompare = (id) =>
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id],
    );

  const { data: competitors = [], isLoading } = useCompetitors();
  const active = competitors.find((c) => c.id === activeId) || competitors[0] || null;
  const addSnapshot = useAddCompetitorSnapshot();

  const saveFromAI = async (out, meta) => {
    if (!active) return;
    await addSnapshot.mutateAsync({
      competitorId: active.id,
      strengths: normalize(out?.strengths),
      weaknesses: normalize(out?.weaknesses),
      pricing_notes: normalize(out?.pricing_notes || out?.pricing),
      own_swot: out?.own_swot || out?.swot || {},
      differentiation_angles: out?.differentiation_angles || [],
      unverified_claim_count: out?.unverified_claim_count ?? countUnverified(out),
      data_gaps: out?.data_gaps || [],
      confidence: meta?.confidence ?? null,
      ai_execution_id: meta?.execution_id || null,
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Competitor Analysis"
        subtitle="Snapshots carry their own unverified-claim count. Check it before acting on one."
        count={competitors.length}
      />

      <Toolbar
        right={
          compareIds.length > 0 && (
            <ToolButton onClick={() => setCompareIds([])}>Clear comparison ({compareIds.length})</ToolButton>
          )
        }
      >
        <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)} className="!py-1.5 !px-3 !text-[12px]">
          Add competitor
        </Button>
        <ToolButton icon={Pencil} disabled title="Hover a competitor card to edit it">Edit</ToolButton>
      </Toolbar>

      <StatsStrip
        items={[
          { label: 'Tracked', value: competitors.length, tone: 'violet' },
          { label: 'Snapshots', value: competitors.reduce((s, c) => s + (c.snapshot_count || 0), 0), tone: 'blue' },
          { label: 'Analyzed', value: competitors.filter((c) => c.last_analyzed_at).length, tone: 'green' },
          { label: 'Never analyzed', value: competitors.filter((c) => !c.last_analyzed_at).length, tone: 'amber' },
          { label: 'Auto-refresh', value: null, tone: 'slate', note: 'no scheduled job yet' },
        ]}
      />

      <AIPanel
        capability="competitor_intel"
        placeholder="e.g. Compare us against Wati and AiSensy on positioning and pricing"
        examples={['SWOT against our top 3 rivals', 'Where we win vs Wati']}
        onSave={active ? saveFromAI : undefined}
        saving={addSnapshot.isPending}
        saveLabel={active ? `Save snapshot for "${active.name}"` : 'Save'}
        renderResult={(out) => (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <ItemList label="Their strengths" items={out?.strengths} />
              <ItemList label="Their weaknesses" items={out?.weaknesses} tone="green" />
            </div>
            {out?.differentiation_angles?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  How we differentiate
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {out.differentiation_angles.map((d, i) => <Badge key={i} tone="violet">{d}</Badge>)}
                </div>
              </div>
            )}
            {out?.data_gaps?.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">
                  Not verified — check before acting
                </p>
                <ul className="space-y-0.5">
                  {out.data_gaps.map((g, i) => <li key={i} className="text-[11px] text-amber-700">· {g}</li>)}
                </ul>
              </div>
            )}
            {!active && <p className="text-[11px] text-amber-600">Add a competitor below before saving.</p>}
          </div>
        )}
      />

      <Card className="p-4">
        <SectionTitle
          title="Competitors"
          subtitle="Each one keeps a history of snapshots so you can see how positioning shifts."
          action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Add competitor</Button>}
        />
        {isLoading ? (
          <div className="py-6 flex justify-center text-slate-300"><Loader2 size={18} className="animate-spin" /></div>
        ) : !competitors.length ? (
          <EmptyState
            icon={BarChart2}
            title="No competitors tracked"
            body="Add the companies you're up against, then run the agent to build a snapshot."
            action={<Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>Add competitor</Button>}
          />
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {competitors.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveId(c.id)}
                onKeyDown={(e) => e.key === 'Enter' && setActiveId(c.id)}
                className={`group text-left rounded-xl border px-3.5 py-3 transition-all cursor-pointer ${
                  active?.id === c.id ? 'border-rose-300 bg-rose-50/50' : 'border-[#E4E8F0] hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#0F1929] truncate">{c.name}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer"
                      title="Compare side by side"
                    >
                      <input
                        type="checkbox"
                        checked={compareIds.includes(c.id)}
                        onChange={() => toggleCompare(c.id)}
                        className="rounded"
                      />
                    </label>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(c); }}
                      title="Edit"
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded text-slate-400 hover:bg-slate-100 flex items-center justify-center"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(c); }}
                      title="Delete"
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded text-red-400 hover:bg-red-50 flex items-center justify-center"
                    >
                      <Trash2 size={11} />
                    </button>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 truncate">{c.domain || 'No domain set'}</p>
                {c.positioning && (
                  <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">{c.positioning}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                  <span>{c.snapshot_count} snapshot{c.snapshot_count === 1 ? '' : 's'}</span>
                  <span>{c.last_analyzed_at ? fmtDate(c.last_analyzed_at) : 'never analyzed'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {compareIds.length >= 2 && (
        <ComparisonView
          competitors={competitors.filter((c) => compareIds.includes(c.id))}
          onClear={() => setCompareIds([])}
        />
      )}

      {active && <SnapshotHistory competitor={active} />}

      <AddCompetitorModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {editing && <EditCompetitorModal competitor={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          await del.mutateAsync(confirmDelete.id);
          if (activeId === confirmDelete.id) setActiveId(null);
          setConfirmDelete(null);
        }}
        busy={del.isPending}
        title="Stop tracking this competitor?"
        message={`Remove "${confirmDelete?.name}"? Its snapshots stay on file — they record what was believed and when.`}
      />
    </div>
  );
}

/** Side-by-side latest snapshots.
 *
 *  Composed client-side from data each card already has, plus a per-competitor
 *  detail fetch — no comparison endpoint needed for a first version. */
function ComparisonView({ competitors, onClear }) {
  return (
    <Card className="p-4">
      <SectionTitle
        title={`Comparing ${competitors.length}`}
        subtitle="Latest snapshot from each, side by side"
        action={<Button onClick={onClear}>Clear</Button>}
      />
      <div className="overflow-x-auto">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${competitors.length}, minmax(240px, 1fr))` }}
        >
          {competitors.map((c) => (
            <ComparisonColumn key={c.id} competitorId={c.id} fallbackName={c.name} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function ComparisonColumn({ competitorId, fallbackName }) {
  const { data, isLoading } = useCompetitor(competitorId);
  const snap = data?.latest_snapshot;

  return (
    <div className="rounded-xl border border-[#E4E8F0] p-3">
      <p className="text-sm font-semibold text-[#0F1929] truncate mb-0.5">{data?.name || fallbackName}</p>
      <p className="text-[11px] text-slate-400 truncate mb-2">{data?.domain || 'No domain'}</p>

      {isLoading ? (
        <p className="text-[11px] text-slate-300">Loading…</p>
      ) : !snap ? (
        <p className="text-[11px] text-slate-400">No snapshot yet — run the agent to build one.</p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {snap.confidence != null && <Badge tone="slate">{Math.round(snap.confidence * 100)}% conf.</Badge>}
            {snap.unverified_claim_count > 0 && (
              <Badge tone="amber">{snap.unverified_claim_count} unverified</Badge>
            )}
          </div>
          <ItemList label="Strengths" items={snap.strengths} />
          <ItemList label="Weaknesses" items={snap.weaknesses} tone="green" />
          <ItemList label="Pricing" items={snap.pricing_notes} />
          {snap.data_gaps?.length > 0 && (
            <p className="text-[10px] text-amber-700">
              {snap.data_gaps.length} data gap{snap.data_gaps.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EditCompetitorModal({ competitor, onClose }) {
  const update = useUpdateCompetitor();
  const [form, setForm] = useState({
    name: competitor.name ?? '',
    domain: competitor.domain ?? '',
    positioning: competitor.positioning ?? '',
    target_segments: competitor.target_segments ?? [],
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    await update.mutateAsync({
      id: competitor.id,
      name: form.name.trim(),
      domain: form.domain.trim() || null,
      positioning: form.positioning.trim() || null,
      target_segments: form.target_segments,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit competitor"
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
      <Field label="Name" required><Input value={form.name} onChange={set('name')} /></Field>
      <Field label="Domain"><Input value={form.domain} onChange={set('domain')} placeholder="rival.com" /></Field>
      <Field label="Positioning">
        <Input value={form.positioning} onChange={set('positioning')} placeholder="Low-cost challenger" />
      </Field>
      <Field label="Target segments">
        <TagsInput
          value={form.target_segments}
          onChange={(v) => setForm((f) => ({ ...f, target_segments: v }))}
          placeholder="smb, enterprise"
        />
      </Field>
    </Modal>
  );
}

function SnapshotHistory({ competitor }) {
  const { data: snapshots = [], isLoading } = useCompetitorSnapshots(competitor.id);
  const delSnap = useDeleteSnapshot();
  const [confirmSnap, setConfirmSnap] = useState(null);

  if (isLoading) {
    return <Card className="p-8 flex justify-center text-slate-300"><Loader2 size={18} className="animate-spin" /></Card>;
  }
  if (!snapshots.length) {
    return (
      <Card className="p-5">
        <EmptyState icon={BarChart2} title={`No snapshots for ${competitor.name} yet`} body="Run the agent above and save the result." />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {snapshots.map((s) => (
        <Card key={s.id} className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-semibold text-[#0F1929]">Snapshot · {timeAgo(s.created_at)}</p>
            <div className="flex items-center gap-1.5">
              {s.confidence != null && <Badge tone="slate">{Math.round(s.confidence * 100)}% confidence</Badge>}
              {s.unverified_claim_count > 0 && (
                <Badge tone="amber">{s.unverified_claim_count} unverified</Badge>
              )}
              {/* Deleting is allowed — duplicates and bad runs happen — but
                  confirmed, because a snapshot is an audit record of what was
                  believed at a point in time. */}
              <Button
                variant="danger" icon={Trash2}
                onClick={() => setConfirmSnap(s)}
                className="!px-2 !py-1"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <ItemList label="Strengths" items={s.strengths} />
            <ItemList label="Weaknesses" items={s.weaknesses} tone="green" />
            <ItemList label="Pricing notes" items={s.pricing_notes} />
          </div>

          {s.differentiation_angles?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#EEF1F6]">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                How we differentiate
              </p>
              <div className="flex flex-wrap gap-1.5">
                {s.differentiation_angles.map((d, i) => <Badge key={i} tone="violet">{d}</Badge>)}
              </div>
            </div>
          )}

          {s.data_gaps?.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
              <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Data gaps</p>
                {s.data_gaps.map((g, i) => <p key={i} className="text-[11px] text-amber-700">· {g}</p>)}
              </div>
            </div>
          )}
        </Card>
      ))}

      <ConfirmDialog
        open={!!confirmSnap}
        onClose={() => setConfirmSnap(null)}
        onConfirm={async () => {
          await delSnap.mutateAsync({ competitorId: competitor.id, snapshotId: confirmSnap.id });
          setConfirmSnap(null);
        }}
        busy={delSnap.isPending}
        title="Delete this snapshot?"
        message="Snapshots record what was believed about a competitor at a point in time. Delete it only if it was a duplicate or a bad run."
      />
    </div>
  );
}

function ItemList({ label, items, tone = 'slate' }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      {!items?.length ? (
        <p className="text-[11px] text-slate-300">None</p>
      ) : (
        <ul className="space-y-0.5">
          {items.slice(0, 6).map((it, i) => (
            <li key={i} className={`text-[11px] ${tone === 'green' ? 'text-emerald-700' : 'text-slate-600'}`}>
              · {typeof it === 'string' ? it : it.point || it.text || it.note || JSON.stringify(it)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddCompetitorModal({ open, onClose }) {
  const create = useCreateCompetitor();
  const [form, setForm] = useState({ name: '', domain: '', positioning: '', target_segments: [] });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    await create.mutateAsync({
      name: form.name.trim(),
      domain: form.domain.trim() || null,
      positioning: form.positioning.trim() || null,
      target_segments: form.target_segments,
    });
    setForm({ name: '', domain: '', positioning: '', target_segments: [] });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add competitor"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!form.name.trim() || create.isPending}>
            {create.isPending ? 'Adding…' : 'Add'}
          </Button>
        </>
      }
    >
      <ErrorNote error={create.error} />
      <Field label="Name" required>
        <Input value={form.name} onChange={set('name')} placeholder="Wati" />
      </Field>
      <Field label="Domain">
        <Input value={form.domain} onChange={set('domain')} placeholder="wati.io" />
      </Field>
      <Field label="Positioning">
        <Input value={form.positioning} onChange={set('positioning')} placeholder="WhatsApp-first team inbox for SMBs" />
      </Field>
      <Field label="Target segments" hint="Comma-separated.">
        <TagsInput
          value={form.target_segments}
          onChange={(target_segments) => setForm((f) => ({ ...f, target_segments }))}
          placeholder="SMB, e-commerce"
        />
      </Field>
    </Modal>
  );
}

/** The capability may return strings or objects; the column is JSONB either
 *  way, so normalize to objects for a stable read path. */
function normalize(items) {
  if (!Array.isArray(items)) return [];
  return items.map((it) => (typeof it === 'string' ? { point: it } : it));
}

function countUnverified(out) {
  return (out?.data_gaps || []).length;
}
