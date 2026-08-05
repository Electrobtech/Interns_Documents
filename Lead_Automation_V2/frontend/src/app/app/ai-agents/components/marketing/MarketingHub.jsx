'use client';
/**
 * Marketing Hub — the 15-section marketing workspace.
 *
 * Layout: persistent left sub-nav (the sections) + content pane, so the section
 * list stays visible. A 15-item horizontal tab strip would wrap or scroll on
 * anything narrower than a desktop monitor.
 *
 * Sections backed by Orbq capabilities call the real API. Sections whose data
 * lives in the Node CRM show an explicit "not connected" state rather than a
 * fabricated number — see MarketingUI.NotConnected.
 */
import { useState } from 'react';
import {
  LayoutDashboard, Megaphone, Radio, Users, FileText, Search, Zap,
  BarChart2, Calendar, PieChart, FileBarChart, Layers, FolderOpen,
  BookOpen, Settings as SettingsIcon, Sparkles, ChevronLeft, ChevronRight,
} from 'lucide-react';

import { ACCENT } from './MarketingUI';
import AIPanel, { AIPanelToggle } from './AIPanel';
import { ToastProvider } from './sections/Shared';
import MarketingDashboard from './sections/MarketingDashboard';
import Campaigns from './sections/Campaigns';
import Broadcasts from './sections/Broadcasts';
import Audience from './sections/Audience';
import ContentStudio from './sections/ContentStudio';
import SEO from './sections/SEO';
import AEO from './sections/AEO';
import CompetitorAnalysis from './sections/CompetitorAnalysis';
import MarketingCalendar from './sections/MarketingCalendar';
import Analytics from './sections/Analytics';
import Reports from './sections/Reports';
import Templates from './sections/Templates';
import AssetsLibrary from './sections/AssetsLibrary';
import KnowledgeBase from './sections/KnowledgeBase';
import MarketingSettings from './sections/MarketingSettings';

// `capability` names the Orbq capability that backs the section, so the UI can
// tell the user which agent skill is doing the work — and so it's obvious in
// code which sections have a backend and which don't.
const SECTIONS = [
  { id: 'dashboard',  label: 'Dashboard',           icon: LayoutDashboard, Component: MarketingDashboard },
  { id: 'campaigns',  label: 'Campaigns',           icon: Megaphone,       Component: Campaigns,          capability: 'campaign_planner' },
  { id: 'broadcasts', label: 'Broadcasts',          icon: Radio,           Component: Broadcasts,         capability: 'anti_ban' },
  { id: 'audience',   label: 'Audience',            icon: Users,           Component: Audience,           capability: 'persona' },
  { id: 'content',    label: 'Content Studio',      icon: FileText,        Component: ContentStudio,      capability: 'content_generator' },
  { id: 'seo',        label: 'SEO',                 icon: Search,          Component: SEO,                capability: 'seo' },
  { id: 'aeo',        label: 'AEO',                 icon: Zap,             Component: AEO,                capability: 'aeo' },
  { id: 'competitor', label: 'Competitor Analysis', icon: BarChart2,       Component: CompetitorAnalysis, capability: 'competitor_intel' },
  { id: 'calendar',   label: 'Marketing Calendar',  icon: Calendar,        Component: MarketingCalendar,  capability: 'content_calendar' },
  { id: 'analytics',  label: 'Analytics',           icon: PieChart,        Component: Analytics },
  { id: 'reports',    label: 'Reports',             icon: FileBarChart,    Component: Reports },
  { id: 'templates',  label: 'Templates',           icon: Layers,          Component: Templates },
  { id: 'assets',     label: 'Assets Library',      icon: FolderOpen,      Component: AssetsLibrary },
  { id: 'knowledge',  label: 'Knowledge Base',      icon: BookOpen,        Component: KnowledgeBase },
  { id: 'settings',   label: 'Settings',            icon: SettingsIcon,    Component: MarketingSettings },
];

export default function MarketingHub({ onBack }) {
  const [active, setActive] = useState('dashboard');
  const [aiOpen, setAiOpen] = useState(false);
  const section = SECTIONS.find((s) => s.id === active) || SECTIONS[0];
  const Active = section.Component;

  return (
    <ToastProvider>
    <div className="flex min-h-screen bg-[#F4F6FA]">
      {/* ── Left sub-nav ─────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 border-r border-[#E4E8F0] bg-white/70 backdrop-blur-sm">
        <div className="sticky top-0 p-4">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors mb-4"
            >
              <ChevronLeft size={13} /> All agents
            </button>
          )}

          <div className="flex items-center gap-2.5 mb-5 px-1">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: '#F5F3FF' }}
            >
              📣
            </div>
            <div className="min-w-0">
              <h2
                className="text-sm font-bold text-[#0F1929] truncate"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Marketing Hub
              </h2>
              <p className="text-[11px] text-slate-400">12 AI capabilities</p>
            </div>
          </div>

          <nav className="space-y-0.5">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = s.id === active;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                    isActive
                      ? 'text-[#0F1929] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                  style={isActive ? { background: '#F5F3FF' } : undefined}
                >
                  <Icon size={15} style={{ color: isActive ? ACCENT : undefined }} />
                  <span className="truncate">{s.label}</span>
                  {/* A dot marks sections an AI capability actually powers. */}
                  {s.capability && (
                    <span
                      className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: isActive ? ACCENT : '#CBD5E1' }}
                      title={`Powered by ${s.capability}`}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 pt-4 border-t border-[#EEF1F6]">
            <button
              onClick={() => setActive('settings')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium
                         text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all"
            >
              <SettingsIcon size={15} />
              Agent settings
            </button>
          </div>
        </div>
      </aside>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 bg-[#F4F6FA]/90 backdrop-blur-sm border-b border-[#E4E8F0] px-8 py-4">
          <nav className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5">
            <button onClick={onBack} className="hover:text-slate-600 transition-colors">AI Agents</button>
            <ChevronRight size={11} />
            <span>Marketing Agent</span>
            <ChevronRight size={11} />
            <span className="text-slate-600 font-medium">{section.label}</span>
          </nav>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1
                className="text-xl font-bold text-[#0F1929] truncate"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                {section.label}
              </h1>
              {section.capability && (
                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <Sparkles size={10} style={{ color: ACCENT }} />
                  Powered by the{' '}
                  <code className="font-mono text-[10px] text-slate-500">{section.capability}</code>{' '}
                  capability
                </p>
              )}
            </div>
            {!aiOpen && <AIPanelToggle onClick={() => setAiOpen(true)} />}
          </div>
        </header>

        <main className="px-8 py-6">
          <Active />
        </main>
      </div>

      <AIPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        sectionId={section.id}
        sectionLabel={section.label}
      />
    </div>
    </ToastProvider>
  );
}

export { SECTIONS };
