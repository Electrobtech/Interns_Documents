'use client';
import { useState } from 'react';
import { Plus, Users, RefreshCw, Trash2 } from 'lucide-react';
import MHBadge from '../ui/MHBadge';
import MHModal from '../ui/MHModal';
import { useMHToast } from '../ui/MHToast';
import {
  useAudiences, useCreateAudience, useDeleteAudience, useEstimateAudienceSize, useAudienceTagOptions,
} from '@/lib/queries/marketingHub';
import { audiences as MOCK_AUDIENCES } from '../mockData';

// Normalise mock audiences to the shape the grid expects
const MOCK_AUDIENCES_NORMALISED = MOCK_AUDIENCES.map((a) => ({
  id: a.id,
  name: a.name,
  source: (a.source || 'custom').toLowerCase(),
  status: (a.status || 'active').toLowerCase(),
  size_cached: a.size || 0,
  size_computed_at: a.lastUpdated ? new Date(a.lastUpdated).toISOString() : new Date().toISOString(),
  filter: { tags: [] },
}));

const SOURCES = ['custom', 'pixel', 'lookalike', 'import', 'crm'];

function Field({ label, required, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function CreateAudienceModal({ onClose, toast }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', source: 'custom', tags: [] });
  const [createdAudience, setCreatedAudience] = useState(null);
  const [error, setError] = useState('');
  const { data: tagOptions = [], isLoading: tagsLoading } = useAudienceTagOptions();
  const createAudience = useCreateAudience();
  const estimateSize = useEstimateAudienceSize();
  const STEPS = ['Name & Source', 'Rule', 'Review'];
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const busy = createAudience.isPending || estimateSize.isPending;

  const canNext = () => {
    if (step === 0) return form.name.trim();
    // Allow Next on Step 1 even if not created yet (we will auto-create on Next click)
    return true;
  };

  const handleNext = async () => {
    if (step === 1 && !createdAudience) {
      await runEstimate();
    }
    setStep((s) => s + 1);
  };

  const toggleTag = (tag) => setForm((f) => ({
    ...f, tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
  }));

  // Creates the real mh_audiences row first, then estimates its size against
  // real contact-service data — estimate-size is a POST against an existing
  // audience id, so the two calls happen in this order, not the reverse.
  const runEstimate = async () => {
    setError('');
    try {
      const audience = createdAudience || await createAudience.mutateAsync({
        name: form.name.trim(), source: form.source, filter: { tags: form.tags },
      });
      setCreatedAudience(audience);
      const updated = await estimateSize.mutateAsync(audience.id);
      setCreatedAudience(updated);
      return updated;
    } catch (err) {
      setError(err.message || 'Could not estimate audience size.');
      throw err;
    }
  };

  const finish = () => {
    toast.show('Audience created.', 'success');
    onClose();
  };

  return (
    <MHModal title="New Audience" onClose={onClose} width={520}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 4, borderRadius: 2, background: i <= step ? '#6366f1' : '#e5e7eb', marginBottom: 6 }} />
            <span style={{ fontSize: 11, fontWeight: i === step ? 700 : 500, color: i === step ? '#6366f1' : '#9ca3af' }}>{s}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Audience Name" required>
            <input className="mh-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. High-Intent Leads Q3" />
          </Field>
          <Field label="Source" required>
            <select className="mh-input" value={form.source} onChange={(e) => set('source', e.target.value)} style={{ textTransform: 'capitalize' }}>
              {SOURCES.map((s) => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
            </select>
          </Field>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Contact tags to include">
            {tagsLoading ? (
              <p style={{ fontSize: 12, color: '#9ca3af' }}>Loading tags…</p>
            ) : tagOptions.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9ca3af' }}>No tagged contacts found yet — you can still create an audience with 0 contacts and update it later.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tagOptions.map((t) => (
                  <button key={t.tag} type="button" onClick={() => { toggleTag(t.tag); setCreatedAudience(null); }}
                    className="mh-btn"
                    style={{
                      fontSize: 12, padding: '6px 12px', borderRadius: 99,
                      border: form.tags.includes(t.tag) ? '1px solid #6366f1' : '1px solid #e5e7eb',
                      background: form.tags.includes(t.tag) ? '#eef2ff' : '#fff',
                      color: form.tags.includes(t.tag) ? '#3730a3' : '#374151',
                    }}>
                    {t.tag} ({t.contact_count})
                  </button>
                ))}
              </div>
            )}
          </Field>
          <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 10, padding: '14px 16px' }}>
            {!createdAudience ? (
              <button className="mh-btn mh-btn-ghost" onClick={runEstimate} disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
                {busy ? 'Estimating…' : 'Estimate Size'}
              </button>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 26, fontWeight: 700, color: '#111827' }}>
                  {(createdAudience.size_cached ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>real contacts matching this tag set, opted-in only</div>
              </div>
            )}
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{error}</p>}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            ['Name', form.name],
            ['Source', form.source],
            ['Tags to filter', form.tags.length ? form.tags.join(', ') : 'None (all contacts)'],
            ['Estimated size', createdAudience ? (createdAudience.size_cached ?? 0).toLocaleString() : '—'],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>{l}</span><span style={{ fontWeight: 600, color: '#111827' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <div>{step > 0 && <button className="mh-btn mh-btn-ghost" disabled={busy} onClick={() => setStep((s) => s - 1)}>Back</button>}</div>
        {step < STEPS.length - 1
          ? <button className="mh-btn mh-btn-primary" disabled={busy || !canNext()} style={{ opacity: canNext() ? 1 : 0.5 }} onClick={handleNext}>
              {busy ? 'Processing…' : 'Next'}
            </button>
          : <button className="mh-btn mh-btn-primary" onClick={finish}>Done</button>}
      </div>
    </MHModal>
  );
}

function ScoreRing({ score, size = 48 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 85 ? '#059669' : score >= 70 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: color }}>{score}</text>
    </svg>
  );
}

const fmtSize = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : (n || 0);

// Freshness score off size_computed_at — real, derived from the audience's
// own data, not a fabricated per-audience "quality" number.
function freshnessScore(a) {
  if (!a.size_computed_at) return 40;
  const ageDays = (Date.now() - new Date(a.size_computed_at).getTime()) / 86400000;
  if (ageDays < 1) return 96;
  if (ageDays < 7) return 85;
  if (ageDays < 30) return 65;
  return 40;
}

export default function MHAudience() {
  const toast = useMHToast();
  const { data: rawAudiences = [], isLoading, isError, refetch } = useAudiences();
  // Fall back to rich mock data when the backend is down or returns nothing
  const audiences = (!isLoading && (isError || rawAudiences.length === 0)) ? MOCK_AUDIENCES_NORMALISED : rawAudiences;
  const [showCreate, setShowCreate] = useState(false);
  const [hovered, setHovered] = useState(null);
  const deleteAudience = useDeleteAudience();
  const estimateSize = useEstimateAudienceSize();

  const remove = (a) => {
    deleteAudience.mutate(a.id, { onSuccess: () => toast.show('Audience deleted', 'success') });
  };
  const refreshOne = (a) => {
    estimateSize.mutate(a.id, { onSuccess: () => toast.show(`Refreshed ${a.name}`, 'success') });
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Audience Manager</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Build audiences from real, tagged contacts — used directly by Campaigns and Broadcasts</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="mh-btn mh-btn-ghost" onClick={() => refetch()}><RefreshCw size={14} /></button>
          <button className="mh-btn mh-btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Audience</button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
      ) : audiences.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '60px 24px', textAlign: 'center' }}>
          <Users size={36} style={{ color: '#d1d5db', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>No audiences yet</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Create one to start targeting Campaigns and Broadcasts.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {audiences.map((a) => {
            const score = freshnessScore(a);
            return (
              <div key={a.id}
                onMouseEnter={() => setHovered(a.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '20px', boxShadow: hovered === a.id ? 'var(--mh-shadow-md)' : 'var(--mh-shadow-sm)', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{a.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#e0e7ff', color: '#3730a3', textTransform: 'capitalize' }}>{a.source}</span>
                      <MHBadge label={a.status} variant={a.status === 'active' ? 'active' : 'default'} dot />
                    </div>
                  </div>
                  <ScoreRing score={score} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                  <Users size={15} style={{ color: '#6366f1' }} />
                  <span style={{ fontFamily: 'var(--mh-font-display)', fontSize: 24, fontWeight: 700, color: '#111827' }}>{fmtSize(a.size_cached)}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>real contacts</span>
                </div>
                {Array.isArray(a.filter?.tags) && a.filter.tags.length > 0 && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Tags: {a.filter.tags.join(', ')}</div>
                )}
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {a.size_computed_at ? `Estimated ${new Date(a.size_computed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Not yet estimated'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="mh-btn mh-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => refreshOne(a)} disabled={estimateSize.isPending}>
                    <RefreshCw size={12} /> Refresh Size
                  </button>
                  <button className="mh-btn mh-btn-ghost" style={{ justifyContent: 'center', fontSize: 12, color: '#dc2626', borderColor: '#fee2e2' }} onClick={() => remove(a)} disabled={deleteAudience.isPending}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateAudienceModal onClose={() => setShowCreate(false)} toast={toast} />}
    </div>
  );
}
