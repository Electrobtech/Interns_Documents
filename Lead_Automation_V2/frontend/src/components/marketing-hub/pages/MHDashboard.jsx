'use client';
import { useState } from 'react';
import { TrendingUp, TrendingDown, Megaphone, Users, Sparkles, BarChart3, RefreshCw,
  Download, AlertTriangle, CheckCircle, Info, Search, Bot } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { kpiData, performanceData, platformData, funnelData, channelPerformance,
  aiInsights, revenueData } from '../mockData';
import { useMHToast } from '../ui/MHToast';
import { useAudienceGrowth, useMarketingCampaigns } from '@/lib/queries/marketingHub';
import { printReport } from '../export';

const insightIcons   = { warning: AlertTriangle, success: CheckCircle, info: Info };
const insightColors  = { warning: '#d97706', success: '#059669', info: '#6366f1' };

const ACTIVITY = [
  { icon: Megaphone, color: '#6366f1', text: 'Q3 Promo Campaign launched', sub: '2 hours ago' },
  { icon: Users, color: '#10b981', text: '1,200 new leads acquired from LinkedIn', sub: '4 hours ago' },
  { icon: AlertTriangle, color: '#f59e0b', text: 'High bounce rate detected on Email blast', sub: 'Yesterday' }
];

// TODO: placeholder until Quick Actions has a real destination/config —
// wire these up (and the icons/pages) to whatever the actual quick-action
// set should be.
const QUICK_ACTIONS = [
  { label: 'New Campaign', sub: 'Launch a campaign', page: 'campaigns', icon: Megaphone, color: '#6366f1' },
  { label: 'View Audience', sub: 'Manage contacts', page: 'audience', icon: Users, color: '#10b981' },
  { label: 'View Analytics', sub: 'See performance', page: 'analytics', icon: BarChart3, color: '#f59e0b' },
];

function ChartHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 14, fontWeight: 700, color: '#111827' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

export default function MHDashboard({ onNavigate }) {
  const { data: audienceGrowth = [] } = useAudienceGrowth(8);

  const { show } = useMHToast();
  const { data: campaigns = [], refetch } = useMarketingCampaigns();
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // There's no live AI-summary endpoint wired up yet for this dashboard, so
  // this intentionally just falls back to the static `aiInsights` mock data
  // rendered below rather than crashing or spinning forever.
  useEffect(() => {
    setLoadingAI(false);
    setAiSummary(null);
  }, [campaigns.length]);

  // Real report from real mh_campaigns rows — everything else on this page
  // is still the mock hero/chart data (see the plan doc); this button at
  // least reports on genuine campaigns rather than the static KPI mock.
  // Field names follow campaigns.js's SELECT_COLS (platform, spend, leads,
  // conversions, revenue) — not the broadcast-shaped fields (total_recipients,
  // sent_count, etc.) those live on mh_broadcasts rows, a different table.
  const exportReport = () => {
    if (campaigns.length === 0) return show('No campaigns yet to report on', 'error');
    const totals = campaigns.reduce((acc, c) => {
      acc.spend += Number(c.spend) || 0; acc.leads += Number(c.leads) || 0;
      acc.conversions += Number(c.conversions) || 0; acc.revenue += Number(c.revenue) || 0;
      return acc;
    }, { spend: 0, leads: 0, conversions: 0, revenue: 0 });
    const html = `
      <h1>Marketing Hub Report</h1>
      <div class="meta">Generated ${new Date().toLocaleString()} · ${campaigns.length} campaign(s)</div>
      <div class="kpi-grid">
        ${[['Campaigns', campaigns.length], ['Spend', totals.spend], ['Leads', totals.leads], ['Conversions', totals.conversions], ['Revenue', totals.revenue]]
          .map(([l, v]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v.toLocaleString()}</div></div>`).join('')}
      </div>
      <table><thead><tr><th>Name</th><th>Platform</th><th>Status</th><th>Leads</th><th>Spend</th></tr></thead>
      <tbody>${campaigns.map((c) => `<tr><td>${c.name}</td><td>${c.platform}</td><td>${c.status}</td><td>${c.leads || 0}</td><td>${c.spend || 0}</td></tr>`).join('')}</tbody></table>`;
    if (!printReport('Marketing Hub Report', html)) show('Enable pop-ups to open the report', 'error');
  };

  return (
    <div style={{ padding:'24px 28px', background:'var(--mh-bg)', minHeight:'100vh', display:'flex', flexDirection:'column', gap:24, overflowY:'auto' }}>

      {/* Header row */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'var(--mh-font-display)', fontSize:26, fontWeight:800, color:'#111827', margin:0 }}>Good morning ✨</h1>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:4, marginBottom:0 }}>Your marketing is performing well today</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="mh-btn mh-btn-ghost" onClick={exportReport}><Download size={14} />Export Report</button>
          <button className="mh-btn mh-btn-ghost" onClick={() => { refetch(); show('Refreshed','success'); }}><RefreshCw size={14} />Refresh</button>
        </div>
      </div>

      {/* Hero row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16 }}>
        {/* AI Summary card */}
        <div style={{ background:'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(168,85,247,0.04))', border:'1px solid rgba(99,102,241,0.2)', borderRadius:18, padding:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'var(--mh-ai-gradient)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily:'var(--mh-font-display)', fontSize:15, fontWeight:700, color:'#111827' }}>Today's AI Summary</div>
              <div style={{ fontSize:11, color:'#6b7280' }}>Updated 2 minutes ago</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            {[
              { label:'Revenue MTD', value:'₹52.6L', trend:'+34%', up:true },
              { label:'Active Campaigns', value:campaigns.length ? campaigns.filter(c => c.status === 'Active' || c.status === 'Scheduled').length.toString() : '14', trend:'+3', up:true },
              { label:'Leads Today', value:aiSummary?.leads_today || '284', trend:'+18%', up:true },
              { label:'Avg ROAS', value:aiSummary?.avg_roas || '29.4x', trend:'+8%', up:true },
            ].map(m => (
              <div key={m.label} style={{ background:'rgba(255,255,255,0.7)', border:'1px solid #e5e7eb', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>{m.label}</div>
                <div style={{ fontFamily:'var(--mh-font-display)', fontSize:20, fontWeight:800, color:'#111827', marginTop:2 }}>{m.value}</div>
                <div style={{ fontSize:11, color: m.up ? '#059669' : '#dc2626', fontWeight:600, display:'flex', alignItems:'center', gap:3 }}>
                  {m.up ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}{m.trend}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'rgba(255,255,255,0.8)', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#374151', lineHeight:1.7, marginBottom:12 }}>
            {loadingAI ? (
              <span>Analyzing your marketing performance...</span>
            ) : aiSummary?.suggestions ? (
              <span>{aiSummary.suggestions}</span>
            ) : (
              <span><strong>3 campaigns need attention.</strong> CTR on Brand Awareness dropped 8% — creative refresh recommended. <strong>Increasing LinkedIn budget by 20%</strong> could generate +420 qualified leads.</span>
            )}
          </div>
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'flex-end', fontSize:11, color:'#6b7280', marginBottom:4 }}>92% confidence</div>
            <div className="progress-track"><div className="progress-fill" style={{ width:'92%', background:'var(--mh-primary)' }} /></div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="mh-btn mh-btn-ai" onClick={() => onNavigate?.('campaigns')}><Sparkles size={13} />Apply Suggestions</button>
            <button className="mh-btn mh-btn-ghost" onClick={() => onNavigate?.('campaigns')}>View Details →</button>
          </div>
        </div>

        {/* Quick Actions card */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <div style={{ fontFamily:'var(--mh-font-display)', fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>Quick Actions</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {QUICK_ACTIONS.map(a => (
              <button key={a.label} onClick={() => onNavigate?.(a.page)} style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, padding:'12px 8px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background='#f0f2f5'; e.currentTarget.style.borderColor='#d1d5db'; }}
                onMouseLeave={e => { e.currentTarget.style.background='#f9fafb'; e.currentTarget.style.borderColor='#e5e7eb'; }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:a.color+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <a.icon size={15} color={a.color} />
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:'#111827', textAlign:'center', lineHeight:1.3 }}>{a.label}</div>
                <div style={{ fontSize:10, color:'#6b7280', textAlign:'center' }}>{a.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
        {[
          { label:'Total Campaigns', value:'48',    trend:'+5',    up:true  },
          { label:'Leads Generated', value:'28,420',trend:'+18%',  up:true  },
          { label:'Conversion Rate', value:'18.4%', trend:'+2.1%', up:true  },
          { label:'CTR',             value:'4.8%',  trend:'+0.3%', up:true  },
          { label:'CPC',             value:'₹2.3',  trend:'-12%',  up:true  },
          { label:'Cost Per Lead',   value:'₹12.4', trend:'-8%',   up:true  },
          { label:'CPM',             value:'₹8.9',  trend:'-4%',   up:true  },
          { label:'ROAS',            value:'29.4x', trend:'+8%',   up:true  },
          { label:'AI Score',        value:'87/100',trend:'+3',    up:true  },
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>{k.label}</div>
            <div style={{ fontFamily:'var(--mh-font-display)', fontSize:22, fontWeight:700, color:'#111827', marginTop:4 }}>{k.value}</div>
            <div style={{ fontSize:11, color: k.up ? '#059669' : '#dc2626', fontWeight:600, display:'flex', alignItems:'center', gap:3, marginTop:2 }}>
              {k.up ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}{k.trend}
            </div>
          </div>
        ))}
      </div>


      {/* Charts row 1 */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        {/* Area chart */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <ChartHeader title="Performance Overview" subtitle="Revenue & Leads — Last 7 months" />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={performanceData} margin={{ top:4, right:4, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
              <Area type="monotone" dataKey="leads"   stroke="#10b981" strokeWidth={2} fill="url(#leadGrad)" name="Leads" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {/* Funnel */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <ChartHeader title="Conversion Funnel" subtitle="Current month" />
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {funnelData.map((f, i) => (
              <div key={f.stage}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#374151', marginBottom:4 }}>
                  <span>{f.stage}</span>
                  <span style={{ fontWeight:600 }}>{f.value.toLocaleString()} <span style={{ color:'#6b7280', fontWeight:400 }}>({f.pct}%)</span></span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width:`${f.pct}%`, background: i===0?'#6366f1':i===1?'#3b82f6':i===2?'#10b981':i===3?'#f59e0b':'#8b5cf6' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
        {/* Bar chart */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <ChartHeader title="Revenue vs Target" subtitle="Monthly comparison" />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revenueData} margin={{ top:4, right:4, bottom:0, left:0 }} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize:10, fill:'#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, fontSize:11 }} />
              <Bar dataKey="revenue" fill="#6366f1" radius={[3,3,0,0]} name="Revenue" />
              <Bar dataKey="target"  fill="#e5e7eb" radius={[3,3,0,0]} name="Target" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Pie chart */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <ChartHeader title="Platform Split" subtitle="Traffic distribution" />
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={platformData} cx="50%" cy="50%" innerRadius={30} outerRadius={52} dataKey="value" paddingAngle={2}>
                  {platformData.map(e => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, fontSize:11 }} formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
              {platformData.map(p => (
                <div key={p.name} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:p.color, flexShrink:0 }} />
                  <span style={{ color:'#374151', flex:1 }}>{p.name}</span>
                  <span style={{ fontWeight:600, color:'#111827' }}>{p.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Line chart */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <ChartHeader title="Audience Growth" subtitle="Total contacts over time" />
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={audienceGrowth} margin={{ top:4, right:4, bottom:0, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="week" tick={{ fontSize:10, fill:'#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, fontSize:11 }} formatter={v => v.toLocaleString()} />
              <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={false} name="Total" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 320px', gap:16 }}>
        {/* AI Insights panel */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <ChartHeader title="AI Insights" subtitle="Powered by your campaign data" />
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {aiInsights.map(ins => {
              const IcComp = insightIcons[ins.type] || Info;
              const col    = insightColors[ins.type] || '#6366f1';
              return (
                <div key={ins.id} style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                    <IcComp size={14} style={{ color:col, flexShrink:0, marginTop:1 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#111827' }}>{ins.title}</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>{ins.campaign}</div>
                      <div style={{ fontSize:12, color:'#374151', marginTop:4, lineHeight:1.5 }}>{ins.recommendation}</div>
                      <div style={{ marginTop:6 }}>
                        <div style={{ display:'flex', justifyContent:'flex-end', fontSize:10, color:'#9ca3af', marginBottom:3 }}>{ins.confidence}% confidence</div>
                        <div className="progress-track"><div className="progress-fill" style={{ width:`${ins.confidence}%`, background:col }} /></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Channel Performance table */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <ChartHeader title="Channel Performance" subtitle="Leads, CPL & ROAS by channel" />
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #f3f4f6' }}>
                  {['Channel','Leads','CPL','ROAS'].map(h => (
                    <th key={h} style={{ textAlign:h==='Channel'?'left':'right', padding:'6px 8px', color:'#9ca3af', fontWeight:600, fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {channelPerformance.map(ch => (
                  <tr key={ch.channel} style={{ borderBottom:'1px solid #f9fafb' }}>
                    <td style={{ padding:'8px 8px', color:'#111827', fontWeight:500 }}>{ch.channel}</td>
                    <td style={{ padding:'8px 8px', textAlign:'right', color:'#374151' }}>{ch.leads.toLocaleString()}</td>
                    <td style={{ padding:'8px 8px', textAlign:'right', color:'#374151' }}>₹{ch.cpl}</td>
                    <td style={{ padding:'8px 8px', textAlign:'right', fontWeight:700, color: ch.roas>=30?'#059669':ch.roas>=10?'#d97706':'#dc2626' }}>{ch.roas}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity feed */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <ChartHeader title="Activity Feed" subtitle="Recent events" />
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:15, top:0, bottom:0, width:1, background:'#f3f4f6' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {ACTIVITY.map((a, i) => {
                const Ic = a.icon;
                return (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, position:'relative' }}>
                    <div style={{ width:30, height:30, borderRadius:'50%', background:a.color+'18', border:`1px solid ${a.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 }}>
                      <Ic size={13} color={a.color} />
                    </div>
                    <div style={{ flex:1, paddingTop:3 }}>
                      <div style={{ fontSize:12, color:'#374151', lineHeight:1.4 }}>{a.text}</div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{a.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Expansion: AEO, SEO, Competitors */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginTop: 16 }}>

        {/* SEO Keywords */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <ChartHeader title="SEO Performance" subtitle="Top ranking keywords" />
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {seoKeywords.slice(0, 5).map(kw => (
              <div key={kw.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Search size={14} color="#6b7280" />
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{kw.term}</div>
                    <div style={{ fontSize:10, color:'#6b7280' }}>Vol: {kw.volume.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#111827' }}>Rank #{kw.rank}</div>
                  <div style={{ fontSize:10, color: kw.change > 0 ? '#059669' : kw.change < 0 ? '#dc2626' : '#6b7280', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:2 }}>
                    {kw.change > 0 ? <TrendingUp size={10}/> : kw.change < 0 ? <TrendingDown size={10}/> : null}
                    {Math.abs(kw.change) || '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AEO Scores */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <ChartHeader title="AEO Visibility" subtitle="Answer Engine Optimization" />
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {Object.entries(aeoScores).slice(0, 5).map(([key, value]) => {
              const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
              return (
                <div key={key}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#374151', marginBottom:4 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:6 }}><Bot size={12} color="#8b5cf6" /> {label}</span>
                    <span style={{ fontWeight:600 }}>{value}/100</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width:`${value}%`, background: value >= 80 ? '#10b981' : value >= 70 ? '#f59e0b' : '#dc2626' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Competitor Analytics */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, padding:20 }}>
          <ChartHeader title="Competitor Analytics" subtitle="Share of Voice & Mentions" />
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {competitors.slice(0, 5).map((comp, i) => (
              <div key={comp.id} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:['#fee2e2','#e0e7ff','#dcfce3'][i%3], color:['#dc2626','#4f46e5','#16a34a'][i%3], display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>
                  {comp.name.charAt(0)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{comp.name}</div>
                  <div style={{ fontSize:10, color:'#6b7280' }}>SOV: {comp.shareOfVoice}%</div>
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:'#374151' }}>
                  {comp.mentions}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}