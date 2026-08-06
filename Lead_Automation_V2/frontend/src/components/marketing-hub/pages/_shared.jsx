'use client';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4, marginBottom: 0 }}>{subtitle}</p>}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function StatCard({ label, value, sub, color = 'var(--mh-primary)', icon: Icon, trend }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--mh-shadow-sm)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mh-text-3)' }}>{label}</span>
        {Icon && (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} style={{ color }} />
          </div>
        )}
      </div>
      <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 26, fontWeight: 700, color: 'var(--mh-text)', lineHeight: 1 }}>{value}</div>
      {(sub || trend !== undefined) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {trend !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 600, color: trend >= 0 ? 'var(--mh-green)' : 'var(--mh-red)' }}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
            </span>
          )}
          {sub && <span style={{ fontSize: 12, color: 'var(--mh-text-3)' }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

export function SectionCard({ title, subtitle, children, actions }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--mh-border)' }}>
          <div>
            <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: 'var(--mh-text)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--mh-text-3)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {Icon && (
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--mh-primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <Icon size={26} style={{ color: 'var(--mh-primary)' }} />
        </div>
      )}
      <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 16, fontWeight: 700, color: 'var(--mh-text)' }}>{title}</div>
      {desc && <div style={{ fontSize: 13, color: 'var(--mh-text-3)', maxWidth: 320 }}>{desc}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
