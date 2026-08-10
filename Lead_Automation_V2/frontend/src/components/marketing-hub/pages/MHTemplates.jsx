'use client';
/**
 * MHTemplates — Marketing Hub wrapper for the shared Templates page.
 * Reuses existing useTemplates hooks (real DB, real backend routes).
 * Accessible both from the sidebar nav (/app/campaigns/templates)
 * AND from Marketing Agent -> Templates tab.
 */
import { useState } from 'react';
import {
  LayoutTemplate, Plus, Search, X, ChevronDown,
  CheckCircle2, Clock, XCircle, AlertTriangle,
  Image as ImageIcon, MessageCircle, Smartphone, Mail, Radio,
  Copy, Trash2, Eye,
} from 'lucide-react';
import { useTemplates, useDeleteTemplate, useCloneTemplate } from '@/lib/queries/templates';
import Link from 'next/link';

const STATUS_CFG = {
  APPROVED: { label: 'Approved', Icon: CheckCircle2, color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  PENDING:  { label: 'Pending',  Icon: Clock,        color: '#d97706', bg: 'rgba(217,119,6,0.08)'  },
  REJECTED: { label: 'Rejected', Icon: XCircle,      color: '#dc2626', bg: 'rgba(220,38,38,0.08)'  },
};

const CHANNEL_ICON  = { WHATSAPP: MessageCircle, RCS: Smartphone, SMS: Smartphone, EMAIL: Mail };
const CHANNEL_COLOR = { WHATSAPP: '#25D366', RCS: '#6366f1', SMS: '#3b82f6', EMAIL: '#f59e0b' };
const ALL_CHANNELS  = ['all', 'WHATSAPP', 'RCS', 'SMS', 'EMAIL'];
const ALL_STATUSES  = ['all', 'APPROVED', 'PENDING', 'REJECTED'];

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.PENDING;
  const { Icon } = cfg;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:99, background:cfg.bg, color:cfg.color }}>
      <Icon size={10} />{cfg.label}
    </span>
  );
}

function TemplateCard({ t, onDelete, onClone }) {
  const ch = t.channel || t.channels?.[0];
  const ChIcon = CHANNEL_ICON[ch] || Radio;
  const chColor = CHANNEL_COLOR[ch] || '#6b7280';
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background:'#fff', border:`1px solid ${hover?'#c4b5fd':'#e5e7eb'}`, borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column', transition:'all 0.15s', boxShadow:hover?'0 4px 16px rgba(99,102,241,0.12)':'0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ height:76, background:chColor+'12', display:'flex', alignItems:'center', justifyContent:'center', borderBottom:'1px solid #f3f4f6', position:'relative' }}>
        {t.header_media_url
          ? <img src={t.header_media_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <ChIcon size={26} color={chColor} style={{ opacity:0.45 }} />}
        {hover && (
          <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:5 }}>
            <Link href={`/app/campaigns/templates/${t.id}`} style={{ width:28, height:28, borderRadius:8, background:'#fff', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', color:'#6366f1', textDecoration:'none' }} title="View"><Eye size={13}/></Link>
            <button onClick={() => onClone(t.id)} style={{ width:28, height:28, borderRadius:8, background:'#fff', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#6b7280' }} title="Clone"><Copy size={13}/></button>
            <button onClick={() => onDelete(t.id)} style={{ width:28, height:28, borderRadius:8, background:'#fff', border:'1px solid #fee2e2', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#ef4444' }} title="Delete"><Trash2 size={13}/></button>
          </div>
        )}
      </div>
      <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:8, flex:1 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{t.name}</div>
          <StatusBadge status={t.status} />
        </div>
        <p style={{ fontSize:11, color:'#6b7280', lineHeight:1.5, margin:0, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
          {t.body || t.content || 'No body text'}
        </p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:2 }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600, color:chColor, background:chColor+'18', padding:'2px 7px', borderRadius:99 }}>
            <ChIcon size={10}/>{ch || '—'}
          </span>
          {t.category && <span style={{ fontSize:10, color:'#9ca3af' }}>{t.category}</span>}
        </div>
      </div>
    </div>
  );
}

const sel = { padding:'7px 28px 7px 10px', border:'1px solid #e5e7eb', borderRadius:8, background:'#f9fafb', fontSize:12, color:'#374151', appearance:'none', cursor:'pointer', outline:'none', fontFamily:'var(--mh-font-body)' };

export default function MHTemplates() {
  const [search,  setSearch]  = useState('');
  const [channel, setChannel] = useState('all');
  const [status,  setStatus]  = useState('all');

  const { data, isLoading, isError, refetch } = useTemplates({
    channel: channel === 'all' ? undefined : channel,
    status:  status  === 'all' ? undefined : status,
    search:  search  || undefined,
  });
  const templates = data || [];
  const hasFilters = channel !== 'all' || status !== 'all' || !!search;

  const { mutate: del }   = useDeleteTemplate();
  const { mutate: clone } = useCloneTemplate();

  const handleDelete = (id) => { if (!confirm('Delete this template?')) return; del(id, { onSuccess: () => refetch() }); };
  const handleClone  = (id) => { clone(id, { onSuccess: () => refetch() }); };

  return (
    <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'rgba(99,102,241,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <LayoutTemplate size={18} color="#6366f1"/>
          </div>
          <div>
            <div style={{ fontFamily:'var(--mh-font-display)', fontSize:18, fontWeight:800, color:'#111827' }}>Templates</div>
            <div style={{ fontSize:11, color:'#9ca3af' }}>Reusable message templates for all channels</div>
          </div>
        </div>
        <Link href="/app/campaigns/templates/new"
          style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', background:'#6366f1', color:'#fff', borderRadius:8, fontSize:13, fontWeight:600, textDecoration:'none' }}>
          <Plus size={14}/>New Template
        </Link>
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
            style={{ ...sel, paddingLeft:30, width:'100%', boxSizing:'border-box' }}/>
          {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', display:'flex' }}><X size={13}/></button>}
        </div>
        <div style={{ position:'relative' }}>
          <select value={channel} onChange={e => setChannel(e.target.value)} style={sel}>
            {ALL_CHANNELS.map(c => <option key={c} value={c}>{c === 'all' ? 'All Channels' : c}</option>)}
          </select>
          <ChevronDown size={11} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', pointerEvents:'none' }}/>
        </div>
        <div style={{ position:'relative' }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={sel}>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : (STATUS_CFG[s]?.label || s)}</option>)}
          </select>
          <ChevronDown size={11} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', pointerEvents:'none' }}/>
        </div>
        {hasFilters && (
          <button onClick={() => { setChannel('all'); setStatus('all'); setSearch(''); }}
            style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'#ef4444', background:'none', border:'none', cursor:'pointer', padding:'4px 8px' }}>
            <X size={12}/>Clear
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14 }}>
          {[0,1,2,3,4,5].map(i => <div key={i} style={{ height:200, borderRadius:16, background:'#f3f4f6' }}/>)}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12 }}>
          <AlertTriangle size={16} color="#ef4444"/>
          <p style={{ fontSize:13, color:'#dc2626', margin:0 }}>Failed to load templates. Please try again.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && templates.length === 0 && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:18, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 24px', textAlign:'center' }}>
          <div style={{ width:64, height:64, borderRadius:18, background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
            <LayoutTemplate size={28} color="#d1d5db"/>
          </div>
          <div style={{ fontFamily:'var(--mh-font-display)', fontSize:15, fontWeight:700, color:'#374151', marginBottom:6 }}>
            {hasFilters ? 'No templates match your filters' : 'No templates yet'}
          </div>
          <p style={{ fontSize:12, color:'#9ca3af', maxWidth:320, lineHeight:1.6, margin:'0 0 20px' }}>
            {hasFilters ? 'Adjust your filters or create a new template.' : 'Build reusable WhatsApp, RCS, SMS and Email templates here. Once approved, they appear in the Broadcast builder.'}
          </p>
          <Link href="/app/campaigns/templates/new"
            style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 16px', background:'#6366f1', color:'#fff', borderRadius:8, fontSize:13, fontWeight:600, textDecoration:'none' }}>
            <Plus size={14}/>New Template
          </Link>
        </div>
      )}

      {/* Grid */}
      {!isLoading && templates.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14 }}>
          {templates.map(t => <TemplateCard key={t.id} t={t} onDelete={handleDelete} onClone={handleClone}/>)}
        </div>
      )}
    </div>
  );
}
