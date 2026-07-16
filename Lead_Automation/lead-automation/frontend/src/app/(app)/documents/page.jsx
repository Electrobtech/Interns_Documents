'use client';
import { FileText, Bot, Megaphone, TrendingUp, Headphones, Database, Sparkles } from 'lucide-react';
import KnowledgeUploadPanel from '@/components/ai-agents/KnowledgeUploadPanel';
import { useKnowledgeSources } from '@/lib/queries/aiAgents';

/* ── per-agent summary card ──────────────────────── */
function AgentKnowledgeCard({ agentType, label, icon: Icon, gradient, description }) {
  const { data } = useKnowledgeSources(agentType);
  const sources  = Array.isArray(data) ? data : [];
  const chunks   = sources.reduce((n, s) => n + (s.chunk_count || 0), 0);
  const ready    = sources.filter((s) => s.status === 'ready').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      <div className={`h-1 w-full bg-gradient-to-r ${gradient}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${gradient.replace('from-', 'from-').replace('to-', 'to-')} opacity-[0.12] absolute`} />
            <Icon size={16} className="text-slate-600" />
            <div>
              <p className="font-bold text-slate-800 text-sm">{label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-slate-800 tabular-nums">{chunks}</p>
            <p className="text-[10px] text-slate-400">chunks indexed</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-4 border-t border-slate-100 pt-3">
          <span>{sources.length} document{sources.length !== 1 ? 's' : ''}</span>
          <span>{ready} ready</span>
          {sources.filter((s) => s.status === 'processing').length > 0 && (
            <span className="text-amber-600 font-semibold">
              {sources.filter((s) => s.status === 'processing').length} processing…
            </span>
          )}
        </div>

        <KnowledgeUploadPanel agentType={agentType} />
      </div>
    </div>
  );
}

/* ── page ─────────────────────────────────────────── */
export default function DocumentsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600 shadow-sm">
          <FileText size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Documents & Knowledge Base</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Uploaded documents are the source of truth for all three AI agents via RAG
          </p>
        </div>
      </div>

      {/* RAG explanation banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-700 to-violet-700 p-6">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: Bot,     label: 'Shared Intelligence',  desc: 'All three agents retrieve from the same document store — one upload benefits marketing, sales, and support.' },
            { icon: Database,label: 'RAG Pipeline',          desc: 'Documents are chunked, embedded, and reranked at query time so agents always cite relevant passages.' },
            { icon: Sparkles,label: 'Source of Truth',       desc: 'Agents only state facts that appear in your documents. If knowledge is missing, they ask a follow-up question.' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white/20 border border-white/30 shrink-0">
                <Icon size={15} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">{label}</p>
                <p className="text-blue-200 text-xs mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* per-agent upload panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AgentKnowledgeCard
          agentType="marketing"
          label="Marketing Agent"
          icon={Megaphone}
          gradient="from-blue-500 to-indigo-500"
          description="Campaigns · Segments · SEO · Content"
        />
        <AgentKnowledgeCard
          agentType="sales"
          label="Sales Agent"
          icon={TrendingUp}
          gradient="from-emerald-500 to-teal-500"
          description="Pricing · Products · Objection handling"
        />
        <AgentKnowledgeCard
          agentType="support"
          label="Support Agent"
          icon={Headphones}
          gradient="from-violet-500 to-purple-500"
          description="FAQs · Policies · Troubleshooting guides"
        />
      </div>

      {/* tips */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <p className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
          <Sparkles size={14} className="text-blue-500" /> Upload Guidelines
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Accepted formats', value: 'PDF, DOCX, TXT, CSV' },
            { label: 'Max file size',    value: '50 MB per file'       },
            { label: 'Chunking',         value: 'Automatic (512 tokens)'},
            { label: 'Versioning',       value: 'Re-upload replaces v1' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm font-semibold text-slate-700">{value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
