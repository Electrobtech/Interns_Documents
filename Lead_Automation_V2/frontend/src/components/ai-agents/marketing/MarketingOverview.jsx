'use client';
import { useMemo } from 'react';
import {
  Users, Users2, Megaphone, Database, Sparkles, Search,
  UserRound, CalendarClock, Target, Clock,
} from 'lucide-react';
import {
  useSEOBriefs, usePersonas, useCampaignPlans, useCompetitorReports,
} from '@/lib/queries/marketingAgent';
import KpiCard from '../KpiCard';

const ACTIVITY_META = {
  content: { icon: Sparkles, cls: 'text-blue-600', bg: 'bg-blue-50' },
  seo: { icon: Search, cls: 'text-emerald-600', bg: 'bg-emerald-50' },
  persona: { icon: UserRound, cls: 'text-violet-600', bg: 'bg-violet-50' },
  plan: { icon: CalendarClock, cls: 'text-amber-600', bg: 'bg-amber-50' },
  competitor: { icon: Target, cls: 'text-rose-600', bg: 'bg-rose-50' },
};

function timeAgo(iso) {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function MarketingOverview({
  leadCount, contactCount, campaignCount, chunkCount, runCount, runs,
}) {
  const { data: seoBriefs } = useSEOBriefs();
  const { data: personas } = usePersonas();
  const { data: campaignPlans } = useCampaignPlans();
  const { data: competitorReports } = useCompetitorReports();

  const activity = useMemo(() => {
    const items = [];
    for (const r of Array.isArray(runs) ? runs : []) {
      items.push({ type: 'content', label: r.brief || 'Content generated', created_at: r.created_at, key: `content-${r.id}` });
    }
    for (const r of Array.isArray(seoBriefs) ? seoBriefs : []) {
      items.push({ type: 'seo', label: `SEO brief: ${r.topic}`, created_at: r.created_at, key: `seo-${r.id}` });
    }
    for (const r of Array.isArray(personas) ? personas : []) {
      items.push({ type: 'persona', label: `Persona set: ${r.name}`, created_at: r.created_at, key: `persona-${r.id}` });
    }
    for (const r of Array.isArray(campaignPlans) ? campaignPlans : []) {
      items.push({ type: 'plan', label: `Campaign plan: ${r.name}`, created_at: r.created_at, key: `plan-${r.id}` });
    }
    for (const r of Array.isArray(competitorReports) ? competitorReports : []) {
      items.push({ type: 'competitor', label: `Competitor intel: ${r.subject}`, created_at: r.created_at, key: `competitor-${r.id}` });
    }
    return items
      .filter((i) => i.created_at)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);
  }, [runs, seoBriefs, personas, campaignPlans, competitorReports]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { icon: Users, label: 'Total Leads', tone: 'brand', value: leadCount },
          { icon: Users2, label: 'Contacts', tone: 'emerald', value: contactCount },
          { icon: Megaphone, label: 'Campaigns', tone: 'amber', value: campaignCount },
          { icon: Database, label: 'Knowledge Chunks', tone: 'brand', value: chunkCount },
          { icon: Sparkles, label: 'AI Generations', tone: 'emerald', value: runCount },
        ].map(({ icon, label, tone, value }, i) => (
          <div key={label} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
            <KpiCard icon={icon} label={label} tone={tone} value={value} loading={value === undefined} />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-500">
            <Clock size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Recent Activity</h4>
            <p className="text-[11px] text-slate-400">Latest across every capability</p>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

        {activity.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs font-medium text-slate-400">No activity yet</p>
            <p className="text-[11px] text-slate-300 mt-0.5">Generate content, a brief, or a plan to get started</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {activity.map((a, i) => {
              const meta = ACTIVITY_META[a.type];
              const Icon = meta.icon;
              return (
                <div
                  key={a.key}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors animate-fade-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className={`p-1.5 rounded-lg ${meta.bg} shrink-0`}>
                    <Icon size={12} className={meta.cls} />
                  </div>
                  <p className="text-xs font-medium text-slate-600 truncate flex-1">{a.label}</p>
                  <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(a.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
