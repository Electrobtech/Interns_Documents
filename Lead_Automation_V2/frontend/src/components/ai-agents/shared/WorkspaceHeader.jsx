'use client';
import { BRAND, AGENT_ACCENT } from './agentTheme';

// Shared workspace banner. Identical violet/fuchsia chrome for every agent; the
// only per-agent variation is the icon and the online-dot accent hue, so the
// three agents feel like one product with three modes rather than three products.
//
// Props:
//   agent: 'marketing' | 'sales' | 'support'
//   icon:  lucide icon component
//   title: heading
//   subtitle: one-line description
export default function WorkspaceHeader({ agent, icon: Icon, title, subtitle }) {
  const accent = AGENT_ACCENT[agent] || AGENT_ACCENT.marketing;
  return (
    <div className={`relative rounded-2xl overflow-hidden p-6 ${BRAND.banner} ${BRAND.bannerShadow}`}>
      {/* subtle dotted texture */}
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
      <div className="absolute right-0 top-0 bottom-0 w-48 opacity-10"
        style={{ background: 'radial-gradient(ellipse at right, white, transparent)' }} />
      <div className="relative flex items-center gap-4">
        <div className={`p-3 rounded-2xl backdrop-blur-sm border ${accent.iconTile}`}>
          <Icon size={22} />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg">{title}</h3>
          <p className="text-violet-200 text-sm mt-0.5">{subtitle}</p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5 border border-white/20">
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${accent.dot}`} />
          <span className="text-white text-xs font-medium">Agent Online</span>
        </div>
      </div>
    </div>
  );
}
