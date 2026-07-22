const COLUMNS = [
  { title: 'Platform', links: ['Inbox', 'AI agents', 'Workflows', 'CRM', 'Campaigns'], href: '#platform' },
  { title: 'Build', links: ['API reference', 'Webhooks', 'Integrations', 'Status', 'Changelog'], href: '#' },
  { title: 'Company', links: ['About', 'Customers', 'Careers', 'Contact'], href: '#' },
  { title: 'Trust', links: ['Security', 'Privacy', 'Terms', 'DPA', 'Subprocessors'], href: '#' },
];

const BADGES = ['© 2026 ELECTROBTECH INNOVATIONS PVT. LTD.', 'SOC 2 TYPE II', 'ISO 27001', 'DATA RESIDENT IN AP-SOUTH-1', '99.98% UPTIME · 90D'];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white pt-12 pb-8 mt-16">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-violet-600 grid place-items-center">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
                </svg>
              </span>
              <b className="text-[15px] font-semibold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-space-grotesk)' }}>LeadForge</b>
            </div>
            <p className="text-[12.5px] text-slate-400 leading-relaxed max-w-[34ch] mt-3">
              AI-powered lead automation & CRM by Electrobtech Innovations. Built in Bengaluru.
            </p>
          </div>
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <h5 className="text-[9.5px] tracking-wide text-slate-400 uppercase mb-3" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{c.title}</h5>
              {c.links.map((l) => (
                <a key={l} href={c.href} className="block text-[13px] text-slate-500 hover:text-brand py-1">{l}</a>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 mt-9 pt-5 border-t border-slate-200">
          {BADGES.map((b) => (
            <span key={b} className="text-[9.5px] text-slate-400" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{b}</span>
          ))}
        </div>
      </div>
    </footer>
  );
}
