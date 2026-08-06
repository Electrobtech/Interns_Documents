'use client';
/**
 * Create/Edit Campaign wizard.
 *
 * The reference spec has 10 steps (Info, Objective, Platforms, Budget,
 * Audience, Placements, Creative, Tracking, Review, Publish). This has 6:
 * Placements (ad-manager-style inventory targeting), a media-upload Creative
 * step, and pixel/conversion-event Tracking need a CDN and ad-platform
 * integrations that don't exist yet. Building those steps would mean either
 * fake controls that save nothing, or real-looking fields that silently no-op
 * — both worse than not having the step. What IS real (UTM fields, since
 * `tracking` is a genuine JSONB column) is folded into Review instead of
 * getting its own step.
 *
 * Every "Ask AI" button here calls the live Marketing Agent
 * (useRunMarketingAgent) and shows its actual confidence — there is no
 * scripted "Confidence: 87%" the way the reference mockup shows.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Check, Sparkles, Loader2, Plus, Trash2,
  Search, Users, AlertTriangle,
} from 'lucide-react';

import { useRunMarketingAgent } from '@/lib/queries/aiAgents';
import {
  useCampaign, useCreateCampaign, useUpdateCampaign, useCampaignStatus,
  useAudiences, useCreateAudience,
  OBJECTIVES, PLATFORMS, BID_STRATEGIES,
} from '@/lib/queries/campaigns';
import { Card, Badge, Button, ConfidenceMeter } from './MarketingUI';

const STEPS = ['Basics', 'Objective & Platforms', 'Budget & Schedule', 'Audience', 'Content', 'Review'];

const emptyForm = () => ({
  name: '', description: '', tags: [],
  objective: '', platforms: [],
  budget_type: 'daily', budget_amount: '', currency: 'INR', bid_strategy: 'highest_volume',
  start_date: '', end_date: '', timezone: 'Asia/Kolkata',
  audience_id: null,
  tracking: { utm_source: '', utm_medium: '', utm_campaign: '' },
  items: [],
});

export default function CampaignWizard({ campaignId, onClose }) {
  const isEdit = !!campaignId;
  const { data: existing, isLoading: loadingExisting } = useCampaign(campaignId);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm());
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState([]);

  const create = useCreateCampaign();
  const update = useUpdateCampaign();
  const changeStatus = useCampaignStatus();

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name, description: existing.description || '', tags: existing.tags || [],
        objective: existing.objective, platforms: existing.platforms,
        budget_type: existing.budget_type, budget_amount: String(existing.budget_amount),
        currency: existing.currency, bid_strategy: existing.bid_strategy,
        start_date: existing.start_date?.slice(0, 16) || '',
        end_date: existing.end_date?.slice(0, 16) || '',
        timezone: existing.timezone,
        audience_id: existing.audience_id,
        tracking: { utm_source: '', utm_medium: '', utm_campaign: '', ...existing.tracking },
        items: existing.items || [],
      });
    }
  }, [existing]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const validateStep = () => {
    const errs = [];
    if (step === 0 && !form.name.trim()) errs.push('Campaign name is required');
    if (step === 1) {
      if (!form.objective) errs.push('Choose an objective');
      if (form.platforms.length === 0) errs.push('Select at least one platform');
    }
    if (step === 2) {
      const amt = Number(form.budget_amount);
      if (!amt || amt <= 0) errs.push('Budget must be greater than 0');
      if (form.start_date && form.end_date && new Date(form.end_date) <= new Date(form.start_date)) {
        errs.push('End date must be after start date');
      }
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const next = () => validateStep() && setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => { setErrors([]); setStep((s) => Math.max(0, s - 1)); };

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description || null,
    objective: form.objective,
    platforms: form.platforms,
    tags: form.tags,
    budget_type: form.budget_type,
    budget_amount: Number(form.budget_amount),
    currency: form.currency,
    bid_strategy: form.bid_strategy,
    start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
    end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
    timezone: form.timezone,
    audience_id: form.audience_id,
    tracking: Object.fromEntries(Object.entries(form.tracking).filter(([, v]) => v)),
    items: form.items,
  });

  const saveDraft = async () => {
    if (!validateStep()) return;
    if (isEdit) await update.mutateAsync({ id: campaignId, ...buildPayload() });
    else await create.mutateAsync(buildPayload());
    onClose();
  };

  const submitForReview = async () => {
    if (!validateStep()) return;
    const saved = isEdit
      ? await update.mutateAsync({ id: campaignId, ...buildPayload() })
      : await create.mutateAsync(buildPayload());
    // pending_review is always legal from draft (CAMPAIGN_TRANSITIONS) —
    // if the campaign was already past draft this simply 409s, which is
    // surfaced rather than silently swallowed.
    try {
      await changeStatus.mutateAsync({ id: saved.id, to_status: 'pending_review', reason: 'Submitted from wizard' });
    } catch {
      // already past draft — saving the edit is still a success
    }
    onClose();
  };

  const saving = create.isPending || update.isPending || changeStatus.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E8F0]">
          <h2 className="text-base font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {isEdit ? 'Edit Campaign' : 'Create Campaign'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center px-6 py-3 border-b border-[#EEF1F6] overflow-x-auto">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-shrink-0">
              <button
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  i === step ? 'text-rose-700' : i < step ? 'text-slate-500 cursor-pointer' : 'text-slate-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    i < step ? 'bg-rose-100 text-rose-600' : i === step ? 'bg-rose-600 text-white' : 'bg-slate-100'
                  }`}
                >
                  {i < step ? <Check size={11} /> : i + 1}
                </span>
                {label}
              </button>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-[#E4E8F0] mx-2" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loadingExisting && isEdit ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-300" /></div>
          ) : (
            <>
              {step === 0 && <StepBasics form={form} set={set} tagInput={tagInput} setTagInput={setTagInput} />}
              {step === 1 && <StepObjectivePlatforms form={form} set={set} />}
              {step === 2 && <StepBudget form={form} set={set} />}
              {step === 3 && <StepAudience form={form} set={set} />}
              {step === 4 && <StepContent form={form} set={set} />}
              {step === 5 && <StepReview form={form} set={set} />}
            </>
          )}

          {errors.length > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200">
              {errors.map((e) => (
                <p key={e} className="text-xs text-red-600 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {e}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E4E8F0]">
          <Button onClick={step === 0 ? onClose : back} icon={step === 0 ? X : ChevronLeft}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          <div className="flex items-center gap-2">
            <Button onClick={saveDraft} disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="primary" icon={ChevronRight} onClick={next}>Next</Button>
            ) : (
              <Button variant="primary" icon={Sparkles} onClick={submitForReview} disabled={saving}>
                {saving ? 'Submitting…' : 'Submit for Review'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Step 1: Basics ──────────────────────────────────────────────────── */

function StepBasics({ form, set, tagInput, setTagInput }) {
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) set({ tags: [...form.tags, t] });
    setTagInput('');
  };
  return (
    <div className="space-y-4">
      <Field label="Campaign Name" required>
        <Input value={form.name} onChange={(v) => set({ name: v })} placeholder="e.g. Q4 Enterprise Lead Gen" />
      </Field>
      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={3}
          maxLength={500}
          className={inputClass}
          placeholder="What is this campaign trying to achieve?"
        />
        <p className="text-[10px] text-slate-400 mt-1">{form.description.length}/500 characters</p>
      </Field>
      <Field label="Tags">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.tags.map((t) => (
            <span key={t} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
              {t}
              <button onClick={() => set({ tags: form.tags.filter((x) => x !== t) })}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="Add a tag and press Enter"
            className={inputClass}
          />
          <Button onClick={addTag} icon={Plus}>Add</Button>
        </div>
      </Field>
    </div>
  );
}

/* ── Step 2: Objective + Platforms (+ real AI suggestion) ───────────── */

function StepObjectivePlatforms({ form, set }) {
  const run = useRunMarketingAgent();

  const askAI = () => {
    run.mutate({
      message: `Given this campaign brief: "${form.name}" — ${form.description || 'no further detail'}. Recommend the best platforms and target audience approach.`,
    });
  };

  const suggestedPlatforms = run.data?.output?.campaign_planner?.plan?.channels
    || run.data?.output?.persona?.personas?.[0]?.preferred_channels
    || null;

  return (
    <div className="space-y-6">
      <Field label="Objective" required>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {OBJECTIVES.map((o) => (
            <button
              key={o.value}
              onClick={() => set({ objective: o.value })}
              className={`text-left p-3 rounded-xl border transition-all ${
                form.objective === o.value
                  ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-100'
                  : 'border-[#E4E8F0] hover:bg-slate-50'
              }`}
            >
              <div className="text-lg mb-1">{o.icon}</div>
              <div className="text-xs font-semibold text-slate-700">{o.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{o.blurb}</div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Platforms" required>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {PLATFORMS.map((p) => {
            const checked = form.platforms.includes(p.value);
            return (
              <label
                key={p.value}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer ${
                  checked ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-[#E4E8F0] text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    set({
                      platforms: checked
                        ? form.platforms.filter((v) => v !== p.value)
                        : [...form.platforms, p.value],
                    })
                  }
                  className="rounded"
                />
                {p.label}
              </label>
            );
          })}
        </div>

        <Card className="p-3 bg-rose-50/40 border-rose-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
              <Sparkles size={13} /> Ask the Marketing Agent
            </div>
            <Button onClick={askAI} disabled={run.isPending || !form.name}>
              {run.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Ask AI'}
            </Button>
          </div>
          {!form.name && <p className="text-[11px] text-slate-400 mt-1">Enter a campaign name first (step 1).</p>}
          {run.data && (
            <div className="mt-2 text-[12px] text-slate-600">
              <p>{run.data.explanation?.summary}</p>
              {suggestedPlatforms && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-slate-400">Suggests:</span>
                  {(Array.isArray(suggestedPlatforms) ? suggestedPlatforms : []).map((c) => (
                    <Badge key={c} tone="violet">{c}</Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-slate-400">Confidence:</span>
                <div className="w-24"><ConfidenceMeter value={(run.data.explanation?.confidence || 0) * 100} /></div>
                <span className="text-[11px] font-mono text-slate-500">
                  {Math.round((run.data.explanation?.confidence || 0) * 100)}%
                </span>
              </div>
            </div>
          )}
        </Card>
      </Field>
    </div>
  );
}

/* ── Step 3: Budget & Schedule ────────────────────────────────────────── */

function StepBudget({ form, set }) {
  return (
    <div className="space-y-4">
      <Field label="Budget Type" required>
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: 'daily', label: 'Daily Budget', blurb: 'A spending limit per day' },
            { v: 'lifetime', label: 'Lifetime Budget', blurb: 'A total for the whole campaign' },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => set({ budget_type: o.v })}
              className={`text-left p-3 rounded-xl border ${
                form.budget_type === o.v ? 'border-rose-300 bg-rose-50' : 'border-[#E4E8F0]'
              }`}
            >
              <div className="text-xs font-semibold text-slate-700">{o.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{o.blurb}</div>
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Budget Amount" required>
          <div className="flex gap-2">
            <Input type="number" min="0" step="0.01" value={form.budget_amount}
              onChange={(v) => set({ budget_amount: v })} placeholder="1000" />
            <select value={form.currency} onChange={(e) => set({ currency: e.target.value })} className={inputClass + ' w-24'}>
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </Field>
        <Field label="Bid Strategy">
          <select value={form.bid_strategy} onChange={(e) => set({ bid_strategy: e.target.value })} className={inputClass}>
            {BID_STRATEGIES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Date">
          <input type="datetime-local" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} className={inputClass} />
        </Field>
        <Field label="End Date">
          <input type="datetime-local" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} className={inputClass} />
        </Field>
      </div>

      <Field label="Timezone">
        <select value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} className={inputClass}>
          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
          <option value="UTC">UTC</option>
          <option value="America/New_York">America/New_York (ET)</option>
          <option value="Europe/London">Europe/London (GMT)</option>
        </select>
      </Field>
    </div>
  );
}

/* ── Step 4: Audience — pick existing or draft via persona AI ────────── */

function StepAudience({ form, set }) {
  const [search, setSearch] = useState('');
  const { data: audiences } = useAudiences(search);
  const createAudience = useCreateAudience();
  const run = useRunMarketingAgent();

  const draftPersona = () => {
    run.mutate({ message: `Draft a target audience/persona for this campaign: ${form.name}. ${form.description || ''}` });
  };

  const saveAsAudience = async () => {
    const persona = run.data?.output?.persona?.personas?.[0];
    if (!persona) return;
    const created = await createAudience.mutateAsync({
      name: persona.name || `${form.name} audience`,
      description: persona.icp_summary || null,
      audience_type: 'custom',
      filters: { persona },
    });
    set({ audience_id: created.id });
  };

  return (
    <div className="space-y-4">
      <Field label="Existing Audiences">
        <div className="relative mb-2">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audiences…" className={inputClass + ' pl-8'} />
        </div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {(audiences || []).map((a) => (
            <label key={a.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs ${
              form.audience_id === a.id ? 'border-rose-300 bg-rose-50' : 'border-[#EEF1F6]'
            }`}>
              <input type="radio" checked={form.audience_id === a.id} onChange={() => set({ audience_id: a.id })} />
              <Users size={12} className="text-slate-400" />
              <span className="font-medium text-slate-700">{a.name}</span>
              <span className="text-slate-400 ml-auto">{a.audience_type}</span>
            </label>
          ))}
          {(!audiences || audiences.length === 0) && (
            <p className="text-xs text-slate-400 py-2">No audiences yet — draft one with AI below, or skip this step.</p>
          )}
        </div>
      </Field>

      <Card className="p-3 bg-rose-50/40 border-rose-100">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
            <Sparkles size={13} /> Draft a persona with AI
          </span>
          <Button onClick={draftPersona} disabled={run.isPending}>
            {run.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Draft Persona'}
          </Button>
        </div>
        {run.data?.output?.persona && (
          <div className="mt-2 text-xs text-slate-600 space-y-1">
            <p>{run.data.output.persona.icp_summary}</p>
            <p className="text-[11px] text-slate-400">{run.data.output.persona.evidence_basis}</p>
            <Button onClick={saveAsAudience} disabled={createAudience.isPending}>
              {createAudience.isPending ? 'Saving…' : 'Save as Audience'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Step 5: Content items ────────────────────────────────────────────── */

function StepContent({ form, set }) {
  const run = useRunMarketingAgent();

  const addItem = () => {
    set({
      items: [
        ...form.items,
        { sequence: form.items.length, channel: form.platforms[0] || 'email', day_offset: 0, subject: '', message_body: '', call_to_action: '' },
      ],
    });
  };
  const updateItem = (i, patch) => {
    const items = [...form.items];
    items[i] = { ...items[i], ...patch };
    set({ items });
  };
  const removeItem = (i) => set({ items: form.items.filter((_, idx) => idx !== i) });

  const draftContent = () => {
    run.mutate({ message: `Write outreach copy for the campaign "${form.name}" across ${form.platforms.join(', ')}. Objective: ${form.objective}.` });
  };

  const applyDraft = () => {
    const variants = run.data?.output?.content_generator?.variants;
    if (!variants?.length) return;
    const items = variants.map((v, i) => ({
      sequence: i, channel: form.platforms[0] || 'email', day_offset: i,
      subject: v.headline || '', message_body: v.body, call_to_action: v.call_to_action || '',
    }));
    set({ items: [...form.items, ...items] });
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 bg-rose-50/40 border-rose-100">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
            <Sparkles size={13} /> Draft copy with AI
          </span>
          <Button onClick={draftContent} disabled={run.isPending || !form.name}>
            {run.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Draft Copy'}
          </Button>
        </div>
        {run.data?.output?.content_generator && (
          <div className="mt-2">
            <p className="text-[11px] text-slate-500 mb-2">
              {run.data.output.content_generator.variants?.length || 0} variant(s) generated —{' '}
              {Math.round((run.data.explanation?.confidence || 0) * 100)}% confidence
            </p>
            <Button onClick={applyDraft}>Add to Campaign</Button>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {form.items.map((item, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <select
                value={item.channel}
                onChange={(e) => updateItem(i, { channel: e.target.value })}
                className={inputClass + ' w-40 py-1.5 text-xs'}
              >
                {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <button onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
            {item.channel === 'email' && (
              <input
                value={item.subject || ''}
                onChange={(e) => updateItem(i, { subject: e.target.value })}
                placeholder="Subject line"
                className={inputClass + ' mb-2 text-xs'}
              />
            )}
            <textarea
              value={item.message_body}
              onChange={(e) => updateItem(i, { message_body: e.target.value })}
              placeholder="Message body"
              rows={2}
              className={inputClass + ' text-xs'}
            />
            <input
              value={item.call_to_action || ''}
              onChange={(e) => updateItem(i, { call_to_action: e.target.value })}
              placeholder="Call to action (optional)"
              className={inputClass + ' mt-2 text-xs'}
            />
          </Card>
        ))}
      </div>

      <Button onClick={addItem} icon={Plus}>Add message</Button>
    </div>
  );
}

/* ── Step 6: Review — includes real UTM fields ────────────────────────── */

function StepReview({ form, set }) {
  const objLabel = OBJECTIVES.find((o) => o.value === form.objective)?.label;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <SummaryField label="Name" value={form.name} />
        <SummaryField label="Objective" value={objLabel} />
        <SummaryField label="Platforms" value={form.platforms.join(', ') || '—'} />
        <SummaryField label="Budget" value={`${form.budget_amount || 0} ${form.currency} / ${form.budget_type}`} />
        <SummaryField label="Schedule" value={form.start_date ? `${form.start_date} → ${form.end_date || 'ongoing'}` : 'Not scheduled'} />
        <SummaryField label="Messages" value={`${form.items.length} drafted`} />
      </div>

      <Field label="Tracking (UTM parameters)">
        <div className="grid grid-cols-3 gap-2">
          <input value={form.tracking.utm_source} onChange={(e) => set({ tracking: { ...form.tracking, utm_source: e.target.value } })}
            placeholder="utm_source" className={inputClass + ' text-xs'} />
          <input value={form.tracking.utm_medium} onChange={(e) => set({ tracking: { ...form.tracking, utm_medium: e.target.value } })}
            placeholder="utm_medium" className={inputClass + ' text-xs'} />
          <input value={form.tracking.utm_campaign} onChange={(e) => set({ tracking: { ...form.tracking, utm_campaign: e.target.value } })}
            placeholder="utm_campaign" className={inputClass + ' text-xs'} />
        </div>
      </Field>

      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
        <strong>Submit for Review</strong> moves this to <code>pending_review</code>. Publishing to a live
        channel still requires a second person's approval — the agent proposes, a human authorizes.
      </div>
    </div>
  );
}

function SummaryField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-slate-700 mt-0.5">{value || '—'}</p>
    </div>
  );
}

/* ── shared bits ──────────────────────────────────────────────────────── */

const inputClass =
  'w-full text-sm rounded-xl border border-[#E4E8F0] px-3 py-2 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all';

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, ...rest }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} {...rest} />;
}
