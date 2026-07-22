'use client';
import { useMemo, useState } from 'react';
import {
  Sparkles, Users2, Search, Hash, FileText, Smile,
  MessageSquareReply, TrendingUp, ListChecks, HelpCircle, UserCheck,
  Mail, Radio, BookOpen, Database, Megaphone, Wand2, Tag, Send, CheckCircle2,
} from 'lucide-react';
import CreateCampaignFromDraftModal from './CreateCampaignFromDraftModal';
import { useBulkTagContacts, usePostReviewReply, useReviews } from '@/lib/queries/crm';

/* ── helpers ─────────────────────────────────────────── */
function isEmpty(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

function Chip({ children, tone = 'slate', onClick, title }) {
  const tones = {
    slate:   'bg-slate-100 text-slate-600',
    blue:    'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    violet:  'bg-violet-50 text-violet-700',
  };
  const cls = `inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full mr-1.5 mb-1.5 ${tones[tone]}`;
  if (!onClick) return <span className={cls}>{children}</span>;
  return (
    <button type="button" onClick={onClick} title={title} className={`${cls} hover:brightness-95 transition-all cursor-pointer`}>
      <Wand2 size={10} /> {children}
    </button>
  );
}

function slugTag(name) {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'segment';
}

/* Bulk-tags contacts by a real, existing `source` value — the AI segment is
   a free-text persona with no contact_id mapping, so the user picks which
   actual audience (a real source, not a guessed match) gets the tag. */
function TagSegmentControl({ segment, contacts }) {
  const bulkTag = useBulkTagContacts();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState('');
  const [tag, setTag] = useState(slugTag(segment.name));
  const [result, setResult] = useState(null);

  const sources = useMemo(() => {
    const set = new Set((contacts || []).map((c) => c.source).filter(Boolean));
    return Array.from(set);
  }, [contacts]);

  if (result != null) {
    return (
      <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1.5">
        <CheckCircle2 size={11} /> Tagged {result} contact{result === 1 ? '' : 's'} with "{tag}"
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 mt-1.5"
      >
        <Tag size={11} /> Tag Contacts
      </button>
    );
  }

  return (
    <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
      {sources.length === 0 ? (
        <p className="text-[11px] text-slate-400">No contact sources found to tag yet.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="input-premium py-1.5 text-[11px] flex-1"
            >
              <option value="">Which real audience?</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="input-premium py-1.5 text-[11px] flex-1"
              placeholder="tag name"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!source || !tag.trim() || bulkTag.isPending}
              onClick={async () => {
                const res = await bulkTag.mutateAsync({ source, tag: tag.trim() });
                setResult(res.tagged);
              }}
              className="btn-emerald btn-sm"
            >
              {bulkTag.isPending ? 'Tagging…' : 'Apply Tag'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

/* Attaches a generic AI-drafted reply scenario to a real, existing review —
   the agent's review_replies are scenario templates, not tied to a specific
   review_id, so the user picks which real review it answers. */
function PostReplyControl({ reply }) {
  const { data: reviews } = useReviews();
  const post = usePostReviewReply();
  const [open, setOpen] = useState(false);
  const [reviewId, setReviewId] = useState('');
  const [posted, setPosted] = useState(false);

  const candidates = useMemo(
    () => (Array.isArray(reviews) ? reviews.filter((r) => !r.reply) : []),
    [reviews],
  );

  if (posted) {
    return (
      <p className="text-[11px] text-emerald-600 font-semibold mt-2 flex items-center gap-1.5">
        <CheckCircle2 size={11} /> Posted as reply
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-600 hover:text-teal-700 mt-2"
      >
        <Send size={11} /> Post Reply
      </button>
    );
  }

  return (
    <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
      {candidates.length === 0 ? (
        <p className="text-[11px] text-slate-400">No unreplied reviews found in Reviews & Social.</p>
      ) : (
        <>
          <select value={reviewId} onChange={(e) => setReviewId(e.target.value)} className="input-premium py-1.5 text-[11px] w-full">
            <option value="">Which review?</option>
            {candidates.map((r) => (
              <option key={r.id} value={r.id}>
                {(r.author || 'Anonymous')} · {r.rating ? `${r.rating}★` : ''} · {(r.body || '').slice(0, 40)}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!reviewId || post.isPending}
              onClick={async () => {
                await post.mutateAsync({ id: reviewId, reply: reply.reply });
                setPosted(true);
              }}
              className="btn-emerald btn-sm"
            >
              {post.isPending ? 'Posting…' : 'Confirm & Post'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

function SectionCard({ icon: Icon, title, accent = 'from-blue-50 to-indigo-100', iconColor = 'text-blue-600', children, empty }) {
  if (empty) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`p-2 rounded-xl bg-gradient-to-br ${accent} ${iconColor}`}>
          <Icon size={14} />
        </div>
        <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
      </div>
      {children}
    </div>
  );
}

/* ── main export ─────────────────────────────────────── */
export default function MarketingRunResult({ out, contacts = [], onGenerateIdea, generating = false }) {
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  if (!out) return null;

  const generateIdea = (prefix, text) => {
    if (!onGenerateIdea || !text) return;
    onGenerateIdea(`${prefix} "${text}" for our next channel post or broadcast.`);
  };

  const hasContentToExecute = !isEmpty(out.content_assets) || !isEmpty(out.campaign_summary);

  return (
    <div className="space-y-4 animate-slide-up">

      {hasContentToExecute && (
        <button
          onClick={() => setShowCreateCampaign(true)}
          className="btn-primary w-full justify-center"
        >
          <Megaphone size={14} /> Create Campaign from This Draft
        </button>
      )}

      {out.human_handoff && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <UserCheck size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">This brief needs human review before acting on it.</p>
        </div>
      )}

      {/* Campaign summary */}
      <SectionCard icon={Sparkles} title="Campaign Summary" empty={isEmpty(out.campaign_summary)}>
        <p className="text-sm text-slate-600 leading-relaxed">{out.campaign_summary}</p>
      </SectionCard>

      {/* Audience segments */}
      <SectionCard icon={Users2} title="Audience Segments"
        accent="from-emerald-50 to-teal-100" iconColor="text-emerald-600"
        empty={isEmpty(out.audience_segments)}>
        <div className="space-y-3">
          {(out.audience_segments || []).map((seg, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-sm font-semibold text-slate-700">{seg.name || `Segment ${i + 1}`}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{seg.description}</p>
              {seg.rationale && (
                <p className="text-[11px] text-slate-400 mt-1.5 italic border-t border-slate-100 pt-1.5">{seg.rationale}</p>
              )}
              <TagSegmentControl segment={seg} contacts={contacts} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Content assets */}
      <SectionCard icon={FileText} title="Content Assets"
        accent="from-amber-50 to-orange-100" iconColor="text-amber-600"
        empty={isEmpty(out.content_assets)}>
        <div className="space-y-5">
          {out.content_assets?.social_post && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Radio size={11} className="text-violet-500" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Social Post</p>
              </div>
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{out.content_assets.social_post}</p>
              </div>
            </div>
          )}
          {out.content_assets?.email_subject && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Mail size={11} className="text-blue-500" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Email Campaign</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-bold text-blue-700 mb-1.5">Subject: {out.content_assets.email_subject}</p>
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{out.content_assets.email_body}</p>
              </div>
            </div>
          )}
          {out.content_assets?.ad_copy && (
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Ad Copy</p>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-sm text-slate-700">{out.content_assets.ad_copy}</p>
              </div>
            </div>
          )}
          {out.content_assets?.blog_outline?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={11} className="text-emerald-500" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Blog Outline</p>
              </div>
              <ul className="space-y-1.5">
                {out.content_assets.blog_outline.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SectionCard>

      {/* SEO/AEO */}
      <SectionCard icon={Search} title="SEO / AEO Analysis"
        accent="from-sky-50 to-cyan-100" iconColor="text-sky-600"
        empty={isEmpty(out.seo_aeo_analysis)}>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">{out.seo_aeo_analysis?.summary}</p>
        {out.seo_aeo_analysis?.recommendations?.length > 0 && (
          <ul className="space-y-1.5">
            {out.seo_aeo_analysis.recommendations.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-2 text-xs text-slate-500 group">
                <span className="flex items-start gap-2 min-w-0">
                  <span className="text-sky-400 mt-0.5 shrink-0">•</span>
                  <span>{r}</span>
                </span>
                {onGenerateIdea && (
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => generateIdea('Write a post idea based on this SEO/AEO recommendation:', r)}
                    title="Generate a post idea from this recommendation"
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-sky-500 hover:text-sky-700 transition-opacity disabled:opacity-40"
                  >
                    <Wand2 size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Keywords */}
      <SectionCard icon={Hash} title="Keyword Research"
        accent="from-violet-50 to-purple-100" iconColor="text-violet-600"
        empty={isEmpty(out.keyword_research)}>
        {out.keyword_research?.primary_keywords?.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Primary Keywords</p>
            <div>{out.keyword_research.primary_keywords.map((k, i) => (
              <Chip key={i} tone="blue"
                onClick={onGenerateIdea && !generating ? () => generateIdea('Write a post idea targeting the keyword', k) : undefined}
                title="Generate a post idea targeting this keyword">
                {k}
              </Chip>
            ))}</div>
          </div>
        )}
        {out.keyword_research?.long_tail_keywords?.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Long-tail Keywords</p>
            <div>{out.keyword_research.long_tail_keywords.map((k, i) => (
              <Chip key={i} tone="violet"
                onClick={onGenerateIdea && !generating ? () => generateIdea('Write a post idea targeting the keyword', k) : undefined}
                title="Generate a post idea targeting this keyword">
                {k}
              </Chip>
            ))}</div>
          </div>
        )}
        {out.keyword_research?.notes && (
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">{out.keyword_research.notes}</p>
        )}
      </SectionCard>

      {/* Sentiment */}
      <SectionCard icon={Smile} title="Sentiment Analysis"
        accent="from-pink-50 to-rose-100" iconColor="text-pink-600"
        empty={isEmpty(out.sentiment_analysis)}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-bold text-slate-700 capitalize">{out.sentiment_analysis?.overall}</span>
          <span className={`badge ${
            out.sentiment_analysis?.overall === 'positive' ? 'badge-emerald'
            : out.sentiment_analysis?.overall === 'negative' ? 'badge-red'
            : 'badge-amber'
          } capitalize`}>
            {out.sentiment_analysis?.overall}
          </span>
        </div>
        {out.sentiment_analysis?.notes && (
          <p className="text-sm text-slate-500 leading-relaxed">{out.sentiment_analysis.notes}</p>
        )}
      </SectionCard>

      {/* Review replies */}
      <SectionCard icon={MessageSquareReply} title="Review Reply Drafts"
        accent="from-teal-50 to-emerald-100" iconColor="text-teal-600"
        empty={isEmpty(out.review_replies)}>
        <div className="space-y-3">
          {(out.review_replies || []).map((r, i) => (
            <div key={i} className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{r.scenario}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-slate-600 leading-relaxed">{r.reply}</p>
                <PostReplyControl reply={r} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Performance Insights */}
      <SectionCard icon={TrendingUp} title="Performance Insights"
        accent="from-emerald-50 to-teal-100" iconColor="text-emerald-600"
        empty={isEmpty(out.performance_insights)}>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">{out.performance_insights?.summary}</p>
        {out.performance_insights?.watch_metrics?.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Watch Metrics</p>
            <div>{out.performance_insights.watch_metrics.map((m, i) => <Chip key={i} tone="emerald">{m}</Chip>)}</div>
          </div>
        )}
      </SectionCard>

      {/* Next Best Actions */}
      <SectionCard icon={ListChecks} title="Next Best Actions"
        accent="from-blue-50 to-indigo-100" iconColor="text-blue-600"
        empty={isEmpty(out.next_best_actions)}>
        <ul className="space-y-2">
          {(out.next_best_actions || []).map((a, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
              {a}
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* Follow-up questions */}
      <SectionCard icon={HelpCircle} title="Follow-up Questions"
        accent="from-amber-50 to-orange-100" iconColor="text-amber-600"
        empty={isEmpty(out.follow_up_questions)}>
        <ul className="space-y-2">
          {(out.follow_up_questions || []).map((q, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
              <span className="flex-shrink-0 text-amber-500 font-bold mt-0.5">?</span>
              {q}
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* Sources footer */}
      {out.knowledge_sources_used?.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
          <Database size={12} className="text-blue-400 shrink-0" />
          <p className="text-[11px] text-slate-400">
            Grounded in <span className="font-semibold text-slate-600">{out.knowledge_sources_used.length}</span>{' '}
            knowledge source{out.knowledge_sources_used.length === 1 ? '' : 's'}
          </p>
        </div>
      )}

      {showCreateCampaign && (
        <CreateCampaignFromDraftModal out={out} onClose={() => setShowCreateCampaign(false)} />
      )}
    </div>
  );
}
