'use client';
import { useState, createContext, useContext } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const Ctx = createContext({ show: () => {} });
export const useMHToast = () => useContext(Ctx);

export function MHToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, type, msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };
  const icons = { success: CheckCircle, error: XCircle, info: Info };
  const colors = { success: '#059669', error: '#dc2626', info: '#6366f1' };
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div style={{ position:'fixed', bottom:24, right:24, zIndex:99999, display:'flex', flexDirection:'column', gap:8 }}>
        {toasts.map(t => {
          const Icon = icons[t.type] || Info;
          return (
            <div key={t.id} className="mh-toast-enter" style={{ display:'flex', alignItems:'center', gap:10, background:'#fff', border:`1px solid ${colors[t.type]}30`, borderLeft:`3px solid ${colors[t.type]}`, borderRadius:10, padding:'12px 16px', minWidth:280, boxShadow:'0 8px 24px rgba(0,0,0,0.1)' }}>
              <Icon size={15} style={{ color: colors[t.type], flexShrink:0 }} />
              <span style={{ fontSize:13, color:'#111827', flex:1 }}>{t.msg}</span>
              <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:0, display:'flex' }}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
