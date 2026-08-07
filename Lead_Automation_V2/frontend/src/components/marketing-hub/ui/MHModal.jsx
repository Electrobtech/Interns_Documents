'use client';
import { X } from 'lucide-react';
export default function MHModal({ title, onClose, children, width = 560 }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(17,24,39,0.4)', backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div className="mh-animate-scaleIn" style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, width, maxWidth:'calc(100vw - 32px)', maxHeight:'90vh', overflow:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', borderBottom:'1px solid #f3f4f6' }}>
          <span style={{ fontWeight:700, fontSize:15, color:'#111827' }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:4, borderRadius:6, display:'flex', alignItems:'center' }}><X size={18} /></button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  );
}
