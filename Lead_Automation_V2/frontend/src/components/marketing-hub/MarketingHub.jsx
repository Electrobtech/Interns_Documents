'use client';
import './marketing-hub.css';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Megaphone, Radio, Users, Pen, Search as SearchIcon, Zap,
  BarChart2, Calendar, PieChart, FileBarChart, Layers, FolderOpen, Share2,
  BookOpen, Settings as SettingsIcon, ChevronLeft, AlignLeft, Sparkles,
  Send, X, ArrowRight, Bot, TrendingUp, Bell, Command, ChevronRight
} from 'lucide-react';
import { MHToastProvider, useMHToast } from './ui/MHToast';
import MHDashboard from './pages/MHDashboard';
import MHChannels from './pages/MHChannels';
import MHCampaigns from './pages/MHCampaigns';
import MHBroadcasts from './pages/MHBroadcasts';
import MHAudience from './pages/MHAudience';
import MHContentStudio from './pages/MHContentStudio';
import MHSEO from './pages/MHSEO';
import MHAEO from './pages/MHAEO';
import MHCompetitorAnalysis from './pages/MHCompetitorAnalysis';
import MHMarketingCalendar from './pages/MHMarketingCalendar';
import MHAnalytics from './pages/MHAnalytics';
import MHReports from './pages/MHReports';
import MHAssetsLibrary from './pages/MHAssetsLibrary';
import MHKnowledgeBase from './pages/MHKnowledgeBase';
import MHSettings from './pages/MHSettings';
import MHTemplates from './pages/MHTemplates';

const NAV_GROUPS = [
  { label: 'Core', items: [
    { id:'dashboard',  label:'Dashboard',        icon: LayoutDashboard },
    { id:'channels',   label:'Channels',           icon: Share2 },
    { id:'campaigns',  label:'Campaigns',         icon: Megaphone },
    { id:'broadcasts', label:'Broadcasts',         icon: Radio },
    { id:'audience',   label:'Audience',           icon: Users },
  ]},
  { label: 'Create', items: [
    { id:'content',    label:'Content Studio',    icon: Pen },
    { id:'templates',  label:'Templates',          icon: Layers },
    { id:'assets',     label:'Assets Library',     icon: FolderOpen },
  ]},
  { label: 'Optimize', items: [
    { id:'seo',        label:'SEO',               icon: SearchIcon },
    { id:'aeo',        label:'AEO',               icon: Zap },
    { id:'competitor', label:'Competitor Analysis',icon: BarChart2 },
  ]},
  { label: 'Measure', items: [
    { id:'calendar',   label:'Marketing Calendar',icon: Calendar },
    { id:'analytics',  label:'Analytics',          icon: PieChart },
    { id:'reports',    label:'Reports',            icon: FileBarChart },
  ]},
  { label: 'Manage', items: [
    { id:'knowledge',  label:'Knowledge Base',    icon: BookOpen },
    { id:'settings',   label:'Settings',          icon: SettingsIcon },
  ]},
];

const PAGE_LABELS = {
  dashboard:'Dashboard', channels:'Channels', campaigns:'Campaigns', broadcasts:'Broadcasts',
  audience:'Audience', content:'Content Studio', templates:'Templates',
  assets:'Assets Library', seo:'SEO', aeo:'AEO', competitor:'Competitor Analysis',
  calendar:'Marketing Calendar', analytics:'Analytics', reports:'Reports',
  knowledge:'Knowledge Base', settings:'Settings',
};

const AI_PROMPTS = [
  'Which campaign should I scale today?',
  'Generate WhatsApp copy for Flash Sale',
  'What keywords should I target next?',
  'Summarize this month\'s performance',
  'Create a new audience segment for high-intent users',
];

const AI_RESPONSES = [
  "Based on your data, **WhatsApp Retargeting** has a 172x ROAS — I recommend increasing the daily budget by ₹800. Expected additional revenue: ₹42,000/week.",
  "Here's a high-converting WhatsApp message for your Flash Sale:\n\n*🔥 48-Hour Flash Sale!*\nGet 40% off on all AI courses. Offer ends midnight. Tap below to enroll now!\n[Enroll Now →]",
  "Top keyword opportunities: *AI marketing automation* (14.4K vol, KD 68), *lead generation software* (22K vol, KD 74). You could rank for both in 3–4 months with targeted content.",
  "This month: ₹52.6L revenue (+34% MoM), 284 new leads today, 4 campaigns outperforming targets. One area of concern: Brand Awareness CTR dropped 8% — creative refresh is recommended.",
];

function renderPage(page, setPage, setPageKey, pageKey) {
  const nav = (p) => { setPage(p); setPageKey(k => k + 1); };
  switch (page) {
    case 'dashboard':  return <MHDashboard key={pageKey} onNavigate={nav} />;
    case 'channels':   return <MHChannels key={pageKey} onNavigate={nav} />;
    case 'campaigns':  return <MHCampaigns key={pageKey} onNavigate={nav} />;
    case 'broadcasts': return <MHBroadcasts key={pageKey} onNavigate={nav} />;
    case 'audience':   return <MHAudience key={pageKey} />;
    case 'content':    return <MHContentStudio key={pageKey} />;
    case 'templates':  return <MHTemplates key={pageKey} />;
    case 'assets':     return <MHAssetsLibrary key={pageKey} />;
    case 'seo':        return <MHSEO key={pageKey} />;
    case 'aeo':        return <MHAEO key={pageKey} />;
    case 'competitor': return <MHCompetitorAnalysis key={pageKey} />;
    case 'calendar':   return <MHMarketingCalendar key={pageKey} />;
    case 'analytics':  return <MHAnalytics key={pageKey} />;
    case 'reports':    return <MHReports key={pageKey} />;
    case 'knowledge':  return <MHKnowledgeBase key={pageKey} />;
    case 'settings':   return <MHSettings key={pageKey} />;
    default:           return <MHDashboard key={pageKey} onNavigate={nav} />;
  }
}

function MarketingHubShell({ onBack }) {
  const { show } = useMHToast();
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMsg, setCopilotMsg] = useState('');
  const [copilotHistory, setCopilotHistory] = useState([
    { role:'ai', text:'Hi! I\'m your Marketing Copilot 👋 I can help you optimize campaigns, generate content, analyze performance, and much more. What would you like to do?' }
  ]);
  const [typing, setTyping] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [pageKey, setPageKey] = useState(0);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [copilotHistory, typing]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
      if (e.key === 'Escape') { setCmdOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const sendCopilot = () => {
    const msg = copilotMsg.trim();
    if (!msg) return;
    setCopilotHistory(h => [...h, { role:'user', text:msg }]);
    setCopilotMsg('');
    setTyping(true);
    setTimeout(() => {
      const resp = AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
      setCopilotHistory(h => [...h, { role:'ai', text:resp }]);
      setTyping(false);
    }, 1400);
  };

  const navigate = (p) => { setPage(p); setPageKey(k => k + 1); setCmdOpen(false); };

  return (
    <div className="mh-root" style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* TOP HEADER */}
      <div style={{ height:52, background:'#fff', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:8, padding:'0 16px', flexShrink:0 }}>
        {onBack && (
          <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center', padding:4, borderRadius:6, marginRight:4 }} title="Back to AI Agents">
            <ChevronLeft size={16} />
          </button>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
          <button onClick={onBack} style={{ background:'none', border:'none', padding:0, cursor: onBack ? 'pointer' : 'default', color:'#9ca3af', fontFamily:'inherit', fontSize:'inherit' }}>
            AI Agents
          </button>
          <ChevronRight size={12} color="#d1d5db" />
          <span style={{ color:'#6366f1', fontWeight:700 }}>Marketing Agent</span>
          <ChevronRight size={12} color="#d1d5db" />
          <span style={{ color:'#9ca3af' }}>{PAGE_LABELS[page]}</span>
        </div>
        <div style={{ flex:1 }} />
        <button onClick={() => setCmdOpen(true)} style={{ display:'flex', alignItems:'center', gap:8, minWidth:200, padding:'6px 12px', background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer', color:'#9ca3af', fontSize:12 }}>
          <SearchIcon size={13} />
          <span style={{ flex:1, textAlign:'left' }}>Search pages...</span>
          <kbd style={{ background:'#f3f4f6', border:'1px solid #e5e7eb', borderRadius:4, padding:'2px 5px', fontSize:10, fontFamily:'monospace', color:'#6b7280' }}>⌘K</kbd>
        </button>
        <button style={{ position:'relative', background:'none', border:'1px solid #e5e7eb', borderRadius:8, padding:'6px 8px', cursor:'pointer', display:'flex', alignItems:'center', color:'#6b7280' }}>
          <Bell size={15} />
          <span style={{ position:'absolute', top:6, right:6, width:6, height:6, borderRadius:'50%', background:'#ef4444' }} />
        </button>
        <button onClick={() => setCopilotOpen(o => !o)} className={`mh-btn ${copilotOpen ? 'mh-btn-primary' : 'mh-btn-ghost'}`} style={{ gap:6 }}>
          <Sparkles size={13} />{copilotOpen ? 'Copilot' : 'AI'}
        </button>
      </div>

      {/* BODY */}
      <div style={{ flex:1, overflow:'hidden', display:'flex' }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width: collapsed ? 52 : 220, background:'#fff', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', transition:'width 0.2s ease', flexShrink:0, overflow:'hidden' }}>
          {/* Collapse toggle */}
          <div style={{ padding:'12px 12px 4px', display:'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
            <button onClick={() => setCollapsed(c => !c)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:4, borderRadius:6, display:'flex' }}>
              <AlignLeft size={16} />
            </button>
          </div>

          {/* Marketing Agent badge */}
          {!collapsed && (
            <div style={{ padding:'8px 14px 12px', borderBottom:'1px solid #f3f4f6' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>📣</span>
                <div>
                  <div style={{ fontFamily:'var(--mh-font-display)', fontSize:13, fontWeight:700, color:'#111827' }}>Marketing Agent</div>
                  <div style={{ fontSize:10, color:'#9ca3af' }}>12 AI-powered tools</div>
                </div>
              </div>
            </div>
          )}

          {/* Jump to search */}
          {!collapsed && (
            <div style={{ padding:'8px 10px' }}>
              <button onClick={() => setCmdOpen(true)} style={{ width:'100%', display:'flex', alignItems:'center', gap:6, padding:'6px 10px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, cursor:'pointer', color:'#9ca3af', fontSize:12 }}>
                <SearchIcon size={12} /><span style={{ flex:1, textAlign:'left' }}>Jump to...</span>
                <kbd style={{ background:'#f3f4f6', border:'1px solid #e5e7eb', borderRadius:4, padding:'1px 4px', fontSize:10, fontFamily:'monospace' }}>⌘K</kbd>
              </button>
            </div>
          )}

          {/* Nav groups */}
          <nav style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>
            {NAV_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom:4 }}>
                {!collapsed && (
                  <div style={{ padding:'8px 14px 4px', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em' }}>{group.label}</div>
                )}
                {group.items.map(item => {
                  const active = page === item.id;
                  const Icon = item.icon;
                  return (
                    <button key={item.id} onClick={() => navigate(item.id)}
                      data-tooltip={collapsed ? item.label : undefined}
                      style={{
                        width:'100%', display:'flex', alignItems:'center', gap:10,
                        padding: collapsed ? '9px 0' : '8px 14px',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        background: active ? '#FFF1F2' : 'none',
                        border:'none', borderLeft: active ? '3px solid #ef4444' : '3px solid transparent',
                        cursor:'pointer', transition:'all 0.12s', borderRadius: collapsed ? 0 : '0 8px 8px 0',
                        color: active ? '#111827' : '#374151',
                        fontWeight: active ? 600 : 400, fontSize:13, fontFamily:'var(--mh-font-body)'
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background='#f9fafb'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background='none'; }}>
                      <Icon size={14} color={active ? '#ef4444' : '#6b7280'} />
                      {!collapsed && <span>{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Bottom user row */}
          {!collapsed && (
            <div style={{ padding:'12px 14px', borderTop:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0 }}>PS</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>Priya Sharma</div>
                <div style={{ fontSize:10, color:'#9ca3af' }}>Marketing Manager</div>
              </div>
              <button onClick={() => navigate('settings')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:4, borderRadius:4, display:'flex' }}>
                <SettingsIcon size={13} />
              </button>
            </div>
          )}
        </div>

        {/* MAIN */}
        <div className="mh-page-enter" key={pageKey} style={{ flex:1, overflowY:'auto' }}>
          {renderPage(page, setPage, setPageKey, pageKey)}
        </div>

        {/* RIGHT COPILOT PANEL */}
        {copilotOpen && (
          <div style={{ width:300, background:'#fff', borderLeft:'1px solid #e5e7eb', display:'flex', flexDirection:'column', flexShrink:0 }}>
            {/* Copilot header */}
            <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:'var(--mh-ai-gradient)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Sparkles size={14} color="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily:'var(--mh-font-display)', fontSize:13, fontWeight:700, color:'#111827' }}>Marketing Copilot</div>
                  <div style={{ fontSize:10, color:'#9ca3af' }}>Powered by AI</div>
                </div>
              </div>
              <button onClick={() => setCopilotOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:4, borderRadius:4, display:'flex' }}><X size={15} /></button>
            </div>

            {/* Quick action chips */}
            <div style={{ padding:'10px 12px', borderBottom:'1px solid #f3f4f6', display:'flex', flexWrap:'wrap', gap:5, flexShrink:0 }}>
              {['Create Campaign','Generate Content','Improve CTR','Optimize Budget','SEO Ideas','Analyze Data'].map(chip => (
                <button key={chip} onClick={() => { setCopilotMsg(chip); }} style={{ padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:500, background:'#f3f4f6', border:'1px solid #e5e7eb', cursor:'pointer', color:'#374151', transition:'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='#e0e7ff'; e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.color='#6366f1'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='#f3f4f6'; e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.color='#374151'; }}>
                  {chip}
                </button>
              ))}
            </div>

            {/* Context insight */}
            <div style={{ padding:'10px 12px', borderBottom:'1px solid #f3f4f6', flexShrink:0 }}>
              <div style={{ background:'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(168,85,247,0.04))', border:'1px solid rgba(99,102,241,0.15)', borderRadius:8, padding:'8px 10px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#6366f1', marginBottom:3 }}>CONTEXT · {PAGE_LABELS[page]}</div>
                <div style={{ fontSize:11, color:'#374151', lineHeight:1.5 }}>WhatsApp Retargeting is at 172x ROAS — scaling could add ₹42k/week</div>
              </div>
            </div>

            {/* Chat messages */}
            <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
              {copilotHistory.map((msg, i) => (
                <div key={i} style={{ marginBottom:10, display:'flex', justifyContent: msg.role==='user'?'flex-end':'flex-start' }}>
                  <div style={{ maxWidth:'85%', padding:'8px 12px', borderRadius: msg.role==='user'?'12px 12px 4px 12px':'12px 12px 12px 4px', fontSize:12, lineHeight:1.6,
                    background: msg.role==='user' ? 'rgba(99,102,241,0.08)' : '#f3f4f6',
                    color:'#374151', border: msg.role==='user' ? '1px solid rgba(99,102,241,0.2)' : '1px solid #e5e7eb'
                  }}>
                    <span style={{ whiteSpace:'pre-wrap' }} dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
                  </div>
                </div>
              ))}
              {typing && (
                <div style={{ display:'flex', gap:4, padding:'8px 12px', background:'#f3f4f6', borderRadius:'12px 12px 12px 4px', width:'fit-content', marginBottom:10 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#9ca3af', display:'block', animation:`mh-float 1.2s ease-in-out ${i*0.2}s infinite` }} />
                  ))}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggested prompts */}
            <div style={{ padding:'8px 12px', borderTop:'1px solid #f3f4f6', flexShrink:0 }}>
              {AI_PROMPTS.slice(0,3).map(p => (
                <button key={p} onClick={() => setCopilotMsg(p)} style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'6px 8px', background:'none', border:'none', cursor:'pointer', borderRadius:6, textAlign:'left', fontSize:11, color:'#6b7280', transition:'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  <ArrowRight size={11} color="#6366f1" />{p}
                </button>
              ))}
            </div>

            {/* Input area */}
            <div style={{ padding:'10px 12px', borderTop:'1px solid #e5e7eb', display:'flex', gap:6, flexShrink:0 }}>
              <textarea value={copilotMsg} onChange={e => setCopilotMsg(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendCopilot(); }}}
                placeholder="Ask anything about your marketing..." rows={2}
                style={{ flex:1, padding:'7px 10px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:12, resize:'none', fontFamily:'var(--mh-font-body)', color:'#374151', outline:'none', lineHeight:1.5 }} />
              <button onClick={sendCopilot} style={{ width:34, height:34, borderRadius:8, background: copilotMsg.trim() ? '#6366f1' : '#f3f4f6', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s', alignSelf:'flex-end' }}>
                <Send size={14} color={copilotMsg.trim() ? '#fff' : '#9ca3af'} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* COMMAND PALETTE */}
      {cmdOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(17,24,39,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setCmdOpen(false)}>
          <div style={{ background:'#fff', borderRadius:16, width:480, maxWidth:'95vw', boxShadow:'0 24px 64px rgba(0,0,0,0.2)', overflow:'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
              <SearchIcon size={16} color="#9ca3af" />
              <input autoFocus placeholder="Search pages..." style={{ flex:1, border:'none', outline:'none', fontSize:14, color:'#111827', fontFamily:'var(--mh-font-body)' }}
                onChange={e => {}} />
              <button onClick={() => setCmdOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:4, borderRadius:4, display:'flex' }}><X size={15} /></button>
            </div>
            <div style={{ maxHeight:360, overflowY:'auto', padding:'8px' }}>
              {NAV_GROUPS.map(group => (
                <div key={group.label}>
                  <div style={{ padding:'6px 10px', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em' }}>{group.label}</div>
                  {group.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <button key={item.id} onClick={() => navigate(item.id)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 10px', background:'none', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, color:'#374151', fontFamily:'var(--mh-font-body)', transition:'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background='none'}>
                        <Icon size={15} color="#6b7280" />{item.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketingHub({ onBack }) {
  return <MHToastProvider><MarketingHubShell onBack={onBack} /></MHToastProvider>;
}
