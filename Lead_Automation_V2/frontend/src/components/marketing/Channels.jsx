const CHANNELS = [
  { label: 'WhatsApp', meta: 'OFFICIAL BSP · TEMPLATES', dot: '#25D366' },
  { label: 'Instagram', meta: 'DMS · STORY REPLIES', dot: '#E1306C' },
  { label: 'Messenger', meta: 'PAGES · COMMENTS', dot: '#0084FF' },
  { label: 'Telegram', meta: 'BOTS · GROUPS', dot: '#2AABEE' },
  { label: 'Web chat', meta: 'EMBED · ONE SCRIPT TAG', dot: '#8B5CF6' },
  { label: 'Email', meta: 'SHARED INBOXES', dot: '#22D3EE' },
  { label: 'SMS', meta: 'DLT REGISTERED', dot: '#F59E0B' },
  { label: 'Voice', meta: 'REAL-TIME · 11 LANGUAGES', dot: '#0E9C88' },
  { label: 'Video', meta: 'SCHEDULED · RECORDED', dot: '#E23E5C' },
  { label: 'Yours', meta: 'API · BRING A CHANNEL', dot: '#94A3B8' },
];

const INTEGRATIONS = [
  'WhatsApp Business API', 'Meta', 'Shopify', 'Razorpay', 'Stripe', 'Zoho CRM', 'Salesforce',
  'HubSpot', 'LeadSquared', 'Google Workspace', 'Microsoft 365', 'Slack', 'Zapier', 'OpenAI',
  'Claude', 'Gemini', 'AWS', 'Webhooks',
];

export default function Channels() {
  return (
    <section id="integrations" className="max-w-5xl mx-auto px-6 py-24">
      <p className="text-[10px] tracking-[0.1em] text-slate-400 uppercase" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>Channels</p>
      <h2 className="text-[26px] sm:text-[31px] font-semibold tracking-tight text-slate-900 mt-3 max-w-2xl" style={{ fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em' }}>
        Wherever they message you, it's the same conversation
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-9">
        {CHANNELS.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200/80 bg-white px-4 py-4 hover:border-slate-300 hover:shadow-[0_10px_24px_-14px_rgba(16,19,34,0.18)] hover:-translate-y-0.5 transition-all duration-200">
            <span className="block w-1.5 h-1.5 rounded-full mb-3" style={{ background: c.dot }} />
            <b className="block text-[13px] font-semibold text-slate-900" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{c.label}</b>
            <span className="text-[9px] tracking-wide text-slate-400" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{c.meta}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] tracking-[0.1em] text-slate-400 uppercase mt-12" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
        Link what you already run — nothing gets ripped out
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        {INTEGRATIONS.map((i) => (
          <span key={i} className="text-[11px] px-3.5 py-1.5 rounded-full border border-slate-200/80 bg-white text-slate-500 hover:border-brand/40 hover:text-brand hover:bg-blue-50/40 transition-colors duration-150" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
            {i}
          </span>
        ))}
      </div>
    </section>
  );
}
