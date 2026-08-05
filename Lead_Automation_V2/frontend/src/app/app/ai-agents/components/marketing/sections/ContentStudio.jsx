'use client';
/**
 * Content Studio — generate copy with the `content_generator` capability and
 * keep what's worth keeping in /ai-agents/marketing/content.
 *
 * Saving is explicit: a rejected draft shouldn't clutter the library.
 */
import { useState } from 'react';
import { FileText, Trash2, Plus, Copy, Check, Loader2 } from 'lucide-react';

import {
  useContent, useCreateContent, useDeleteContent, CONTENT_TYPES,
} from '@/lib/queries/marketing';
import { PLATFORMS } from '@/lib/queries/campaigns';
import { Card, Badge, Button, EmptyState, SectionTitle } from '../MarketingUI';
import {
  AIPanel, Modal, Field, Input, Textarea, Select, SearchInput, TagsInput, ErrorNote, timeAgo,
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
                {c.claims_requiring_verification?.length > 0 && (
                  <Badge tone="amber">{c.claims_requiring_verification.length} to verify</Badge>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#EEF1F6]">
                <span className="text-[10px] text-slate-400">v{c.version} · {timeAgo(c.created_at)}</span>
                <div className="flex items-center gap-1.5">
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
