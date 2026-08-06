'use client';
/**
 * Content Studio — generate copy with the `content_generator` capability and
 * keep what's worth keeping in /ai-agents/marketing/content.
 *
 * Saving is explicit: a rejected draft shouldn't clutter the library.
 */
import { useState } from 'react';
import { FileText, Trash2, Plus, Copy, Check, Loader2, ShieldCheck, X } from 'lucide-react';

import {
  useContent, useCreateContent, useDeleteContent, useUpdateContent,
  useContentVersions, useSubmitContent, CONTENT_TYPES,
} from '@/lib/queries/marketing';
import { PLATFORMS } from '@/lib/queries/campaigns';
import { Card, Badge, Button, EmptyState, SectionTitle } from '../MarketingUI';
import {
  PageHeader, Toolbar, ToolButton, ToolSearch, StatsStrip,
} from '../HubUI';
import {
  AIPanel, Modal, Field, Input, Textarea, Select, SearchInput, TagsInput, ErrorNote, timeAgo,
  useToast,
} from './Shared';

const TYPE_LABEL = Object.fromEntries(CONTENT_TYPES.map((t) => [t.value, t.label]));

/** Pulls the body out of whatever shape the capability returned. The
 *  content_generator schema varies by content type, so this checks the known
 *  fields rather than assuming one. */
function extractBody(out) {
  return (
    out?.body ||
    out?.content ||
    out?.primary_texts?.[0] ||
    out?.variants?.[0]?.body ||
    out?.variants?.[0]?.text ||
    (Array.isArray(out?.ad_headlines) ? out.ad_headlines.join('\n') : null) ||
    ''
  );
}

export default function ContentStudio() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const { data: rows = [], isLoading } = useContent({
    search: search || undefined,
    content_type: typeFilter || undefined,
  });
  const create = useCreateContent();
  const del = useDeleteContent();

  const saveFromAI = async (output, meta) => {
    const body = extractBody(output);
    if (!body) return;
    await create.mutateAsync({
      title: output?.title || output?.headline || 'AI draft',
      content_type: output?.content_type || 'ad_copy',
      body,
      variants: output?.variants || [],
      tone: output?.tone || null,
      claims_requiring_verification: output?.claims_requiring_verification || [],
      ai_execution_id: meta?.execution_id || null,
      ai_confidence: meta?.confidence ?? null,
    });
  };

  const copy = (c) => {
    navigator.clipboard?.writeText(c.body);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Content Studio"
        subtitle="Generate copy, verify its claims, then submit for approval."
        count={rows.length}
      />

      <Toolbar
        right={
          <>
            <ToolSearch value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search content…" />
            <div className="w-44">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={CONTENT_TYPES} placeholder="All types" />
            </div>
          </>
        }
      >
        <Button variant="primary" icon={Plus} onClick={() => setManualOpen(true)} className="!py-1.5 !px-3 !text-[12px]">
          New content
        </Button>
        <ToolButton icon={ShieldCheck} disabled title="Open a piece to verify its claims and submit">Submit for approval</ToolButton>
      </Toolbar>

      <StatsStrip
        items={[
          { label: 'Pieces', value: rows.length, tone: 'violet' },
          { label: 'AI-drafted', value: rows.filter((c) => c.ai_generated).length, tone: 'blue' },
          { label: 'Needs verifying', value: rows.filter((c) => outstandingClaims(c) > 0).length, tone: 'amber' },
          { label: 'Submitted', value: rows.filter((c) => c.approval_id).length, tone: 'green' },
          { label: 'Templates', value: rows.filter((c) => c.is_template).length, tone: 'slate' },
        ]}
      />

      <AIPanel
        capability="content_generator"
        placeholder="e.g. Write a launch email for our WhatsApp automation product, aimed at Indian SMB owners"
        examples={['Launch email for SMB owners', '3 ad headlines for Meta', 'WhatsApp message for cold leads']}
        onSave={saveFromAI}
        saving={create.isPending}
        saveLabel="Save to library"
        renderResult={(out) => (
          <div className="space-y-2">
            <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{extractBody(out)}</p>
            {out?.claims_requiring_verification?.length > 0 && (
              <div className="pt-2 border-t border-[#E4E8F0]">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">
                  Verify before publishing
                </p>
                <ul className="space-y-0.5">
                  {out.claims_requiring_verification.map((c, i) => (
                    <li key={i} className="text-[11px] text-amber-700">· {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      />

      <Card className="p-4">
        <SectionTitle
          title="Content library"
          subtitle={`${rows.length} saved item${rows.length === 1 ? '' : 's'}`}
          action={<Button icon={Plus} onClick={() => setManualOpen(true)}>Write manually</Button>}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search content…" />
          <div className="w-48">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={CONTENT_TYPES}
              placeholder="All types"
            />
          </div>
        </div>
      </Card>

      <ErrorNote error={create.error || del.error} />

      {isLoading ? (
        <Card className="p-10 flex justify-center text-slate-300">
          <Loader2 size={20} className="animate-spin" />
        </Card>
      ) : !rows.length ? (
        <Card className="p-5">
          <EmptyState
            icon={FileText}
            title="Nothing saved yet"
            body="Run the agent above and save the drafts you want to keep, or write one manually."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Card key={c.id} hover className="p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-[#0F1929] truncate">{c.title}</p>
                <Badge tone="violet">{TYPE_LABEL[c.content_type] || c.content_type}</Badge>
              </div>
              <p className="text-[12px] text-slate-600 line-clamp-5 whitespace-pre-wrap flex-1">{c.body}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {c.platform && <Badge tone="blue">{c.platform}</Badge>}
                {c.ai_generated && (
                  <Badge tone="slate">
                    AI{c.ai_confidence != null ? ` · ${Math.round(c.ai_confidence * 100)}%` : ''}
                  </Badge>
                )}
                {outstandingClaims(c) > 0 && (
                  <Badge tone="amber">{outstandingClaims(c)} to verify</Badge>
                )}
                {c.approval_id && <Badge tone="green">Submitted</Badge>}
              </div>
              <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#EEF1F6]">
                <button
                  onClick={() => setDetailId(c.id)}
                  className="text-[10px] text-slate-400 hover:text-rose-600"
                >
                  v{c.version} · {timeAgo(c.created_at)}
                </button>
                <div className="flex items-center gap-1.5">
                  <Button icon={ShieldCheck} onClick={() => setDetailId(c.id)} className="!px-2 !py-1.5" title="Review & submit" />
                  <Button
                    icon={copiedId === c.id ? Check : Copy}
                    onClick={() => copy(c)}
                    className="!px-2 !py-1.5"
                  />
                  <Button
                    variant="danger" icon={Trash2}
                    onClick={() => del.mutate(c.id)}
                    className="!px-2 !py-1.5"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ManualContentModal open={manualOpen} onClose={() => setManualOpen(false)} />

      {detailId && <ContentDetail contentId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

/** Claims the generator flagged that no human has signed off yet. The server
 *  refuses submission while any remain, so the count has to be visible. */
function outstandingClaims(c) {
  const total = c.claims_requiring_verification?.length || 0;
  const verified = new Set(c.claims_verified || []);
  return Array.from({ length: total }).filter((_, i) => !verified.has(i)).length;
}

/* ── Detail: claims checklist, version history, submit ──────────────── */

function ContentDetail({ contentId, onClose }) {
  const toast = useToast();
  const [tab, setTab] = useState('review');

  const { data: rows = [] } = useContent();
  const doc = rows.find((r) => r.id === contentId);
  const { data: versions = [] } = useContentVersions(contentId);
  const update = useUpdateContent();
  const submit = useSubmitContent();

  if (!doc) return null;

  const claims = doc.claims_requiring_verification || [];
  const verified = new Set(doc.claims_verified || []);
  const outstanding = claims.length - verified.size;

  const toggleClaim = async (i) => {
    const next = new Set(verified);
    next.has(i) ? next.delete(i) : next.add(i);
    try {
      await update.mutateAsync({ id: contentId, claims_verified: [...next].sort((a, b) => a - b) });
    } catch (e) {
      toast({ tone: 'error', message: e.message || 'Could not update claim.' });
    }
  };

  const doSubmit = async () => {
    try {
      await submit.mutateAsync({ id: contentId });
      toast({ message: 'Submitted for approval. It now needs a human decision before publishing.' });
    } catch (e) {
      toast({ tone: 'error', message: e.message || 'Could not submit.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#F7F8FC] h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-[#E4E8F0] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#0F1929] truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {doc.title}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge tone="violet">{TYPE_LABEL[doc.content_type] || doc.content_type}</Badge>
                <span className="text-[11px] text-slate-400">v{doc.version}</span>
                {doc.approval_id && <Badge tone="green">Submitted for approval</Badge>}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close"
                    className="w-9 h-9 rounded-xl text-slate-400 hover:bg-slate-100 flex items-center justify-center">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-1 mt-4 -mb-4">
            {[{ id: 'review', label: `Review${outstanding ? ` (${outstanding})` : ''}` },
              { id: 'history', label: `History (${versions.length})` }].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-[13px] font-medium border-b-2 transition-colors ${
                  tab === t.id ? 'border-rose-600 text-rose-700'
                              : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {tab === 'review' ? (
            <>
              <Card className="p-4">
                <SectionTitle
                  title="Claims to verify"
                  subtitle="Statements the generator could not ground in your knowledge base"
                />
                {claims.length === 0 ? (
                  <p className="text-[12px] text-slate-400">
                    Nothing was flagged — every statement was grounded, or this was written by hand.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {claims.map((claim, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={verified.has(i)}
                          onChange={() => toggleClaim(i)}
                          disabled={update.isPending}
                          className="mt-0.5 rounded"
                          id={`claim-${i}`}
                        />
                        <label
                          htmlFor={`claim-${i}`}
                          className={`text-[12px] cursor-pointer ${
                            verified.has(i) ? 'text-slate-400 line-through' : 'text-slate-700'
                          }`}
                        >
                          {typeof claim === 'string' ? claim : JSON.stringify(claim)}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <SectionTitle title="Body" subtitle={`Version ${doc.version}`} />
                <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{doc.body}</p>
              </Card>

              <Card className="p-4">
                <SectionTitle
                  title="Publish"
                  subtitle="Publishing always needs a human decision — it can't be auto-approved"
                />
                {doc.approval_id ? (
                  <p className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    Already submitted. Track it in the Approvals queue.
                  </p>
                ) : (
                  <>
                    {outstanding > 0 && (
                      <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                        {outstanding} claim{outstanding === 1 ? '' : 's'} still unverified. Verify each one
                        above, or edit them out of the body, before submitting.
                      </p>
                    )}
                    <Button
                      variant="primary"
                      icon={ShieldCheck}
                      onClick={doSubmit}
                      disabled={outstanding > 0 || submit.isPending}
                    >
                      {submit.isPending ? 'Submitting…' : 'Submit for approval'}
                    </Button>
                  </>
                )}
              </Card>
            </>
          ) : (
            <Card className="p-4">
              <SectionTitle title="Version history" subtitle="Read-only snapshots of prior versions" />
              {versions.length === 0 ? (
                <p className="text-[12px] text-slate-400">No prior versions — this document hasn’t been edited yet.</p>
              ) : (
                <ul className="space-y-3">
                  {versions.map((v) => (
                    <li key={v.id} className="rounded-xl border border-[#E4E8F0] bg-white p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge tone="slate">v{v.version}</Badge>
                        <span className="text-[11px] text-slate-400">{timeAgo(v.created_at)}</span>
                        {v.change_note && (
                          <span className="text-[11px] text-slate-500 italic">“{v.change_note}”</span>
                        )}
                      </div>
                      <p className="text-[12px] text-slate-600 whitespace-pre-wrap line-clamp-6">{v.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ManualContentModal({ open, onClose }) {
  const create = useCreateContent();
  const [form, setForm] = useState({
    title: '', content_type: 'ad_copy', platform: '', body: '', tone: '', tags: [],
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    await create.mutateAsync({
      title: form.title.trim(),
      content_type: form.content_type,
      platform: form.platform || null,
      body: form.body.trim(),
      tone: form.tone.trim() || null,
      tags: form.tags,
    });
    setForm({ title: '', content_type: 'ad_copy', platform: '', body: '', tone: '', tags: [] });
    onClose();
  };

  const valid = form.title.trim() && form.body.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New content"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <ErrorNote error={create.error} />
      <Field label="Title" required>
        <Input value={form.title} onChange={set('title')} placeholder="Diwali launch email" />
      </Field>
      <Field label="Type" required>
        <Select value={form.content_type} onChange={set('content_type')} options={CONTENT_TYPES} />
      </Field>
      <Field label="Platform">
        <Select value={form.platform} onChange={set('platform')} options={PLATFORMS} placeholder="None" />
      </Field>
      <Field label="Body" required>
        <Textarea rows={7} value={form.body} onChange={set('body')} />
      </Field>
      <Field label="Tone">
        <Input value={form.tone} onChange={set('tone')} placeholder="Warm, direct" />
      </Field>
      <Field label="Tags" hint="Comma-separated.">
        <TagsInput value={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} placeholder="launch, q4" />
      </Field>
    </Modal>
  );
}
