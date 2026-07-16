'use client';
import {
  Sparkles, Users2, Search, Hash, FileText, Smile,
  MessageSquareReply, TrendingUp, ListChecks, HelpCircle, UserCheck,
  Mail, Radio, BookOpen,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────── */
function isEmpty(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

function Chip({ children, tone = 'slate' }) {
  const tones = {
    slate:   'bg-slate-100 text-slate-600',
    blue:    'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    violet:  'bg-violet-50 text-violet-700',
  };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full mr-1.5 mb-1.5 ${tones[tone]}`}>
      {children}
    </span>
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
export default function MarketingRunResult({ out }) {
  if (!out) return null;

  return (
    <div className="space-y-4 animate-slide-up">

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
              <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                <span className="text-sky-400 mt-0.5">•</span>{r}
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
            <div>{out.keyword_research.primary_keywords.map((k, i) => <Chip key={i} tone="blue">{k}</Chip>)}</div>
          </div>
        )}
        {out.keyword_research?.long_tail_keywords?.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">Long-tail Keywords</p>
            <div>{out.keyword_research.long_tail_keywords.map((k, i) => <Chip key={i} tone="violet">{k}</Chip>)}</div>
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
    </div>
  );
}
