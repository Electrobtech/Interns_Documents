'use client';
import { X } from 'lucide-react';
export default function MHDrawer({ title, subtitle, onClose, children, width = 680 }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:8000, display:'flex', justifyContent:'flex-end', background:'rgba(17,24,39,0.35)', backdropFilter:'blur(3px)' }} onClick={onClose}>
      <div className="mh-animate-slideRight" style={{ width, maxWidth:'95vw', height:'100%', background:'#fff', borderLeft:'1px solid #e5e7eb', display:'flex', flexDirection:'column', boxShadow:'-8px 0 40px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid #f3f4f6', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:16, color:'#111827' }}>{title}</div>
            {subtitle && <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:4, borderRadius:6, marginTop:2, display:'flex', alignItems:'center' }}><X size={18} /></button>
        </div>
        <div style={{ flex:1, overflow:'auto' }}>{children}</div>
      </div>
    </div>
  );
}
