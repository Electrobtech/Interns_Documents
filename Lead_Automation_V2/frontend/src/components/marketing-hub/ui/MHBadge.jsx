'use client';
const V = {
  active:    { bg:'#d1fae5', color:'#065f46', dot:'#059669' },
  sent:      { bg:'#d1fae5', color:'#065f46', dot:'#059669' },
  success:   { bg:'#d1fae5', color:'#065f46', dot:'#059669' },
  paused:    { bg:'#fef3c7', color:'#92400e', dot:'#d97706' },
  warning:   { bg:'#fef3c7', color:'#92400e', dot:'#d97706' },
  scheduled: { bg:'#e0e7ff', color:'#3730a3', dot:'#6366f1' },
  draft:     { bg:'#f3f4f6', color:'#4b5563', dot:'#9ca3af' },
  default:   { bg:'#f3f4f6', color:'#4b5563', dot:'#9ca3af' },
  danger:    { bg:'#fee2e2', color:'#991b1b', dot:'#dc2626' },
  info:      { bg:'#dbeafe', color:'#1e40af', dot:'#2563eb' },
};
export default function MHBadge({ label, variant = 'default', dot = false }) {
  const s = V[variant?.toLowerCase()] || V.default;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:s.bg, color:s.color, borderRadius:99, padding:'3px 9px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
      {dot && <span style={{ width:5, height:5, borderRadius:'50%', background:s.dot, flexShrink:0 }} />}
      {label}
    </span>
  );
}
