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
import { Users, Plus, Loader2 } from 'lucide-react';

import { useAudiences, useCreateAudience } from '@/lib/queries/campaigns';
import { Card, Badge, Button, EmptyState, SectionTitle, fmt } from '../MarketingUI';
import {
  AIPanel, Modal, Field, Input, Textarea, Select, SearchInput, TagsInput, ErrorNote, timeAgo,
} from './Shared';

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

  const { data: rows = [], isLoading } = useAudiences(search || undefined);
  const create = useCreateAudience();

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
            <Card key={a.id} hover className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-sm font-semibold text-[#0F1929] truncate">{a.name}</p>
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
                <span className="text-[10px] text-slate-400 ml-auto">{timeAgo(a.created_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewAudienceModal open={createOpen} onClose={() => setCreateOpen(false)} />
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
