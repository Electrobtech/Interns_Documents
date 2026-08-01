// ─────────────────────────────────────────────────────────────────────────────
// ONE design system for every agent workspace.
//
// Previously each agent invented its own palette (Marketing=blue, Sales=emerald,
// Support=violet), so the section read as three different products. We now share
// the Orbq violet/rose identity everywhere and give each agent only a
// small ACCENT (header icon tile + online dot) for recognisability — the chrome
// (nav, active states, primary buttons, banner gradient) is identical.
//
// Semantic colors that carry meaning — hot/warm/cold leads, won deals, escalation
// alerts — are deliberately NOT themed here; those stay red/amber/emerald because
// their hue is information, not decoration.
// ─────────────────────────────────────────────────────────────────────────────

// Shared brand chrome — used by WorkspaceNav / WorkspaceShell across all agents.
export const BRAND = {
  banner: 'bg-gradient-to-r from-violet-600 via-violet-700 to-fuchsia-700',
  bannerShadow: 'shadow-[0_8px_30px_-8px_rgba(124,58,237,0.5)]',
  navActive: 'bg-violet-600 border-violet-600 text-white',
  navActiveShadow: 'shadow-[0_4px_14px_-4px_rgba(124,58,237,0.5)]',
  navIdle: 'bg-white border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-300',
  subNavShell: 'rounded-xl bg-violet-50/60 border border-violet-100 p-1.5',
  subNavActive: 'bg-white border-violet-200 text-violet-700 shadow-sm',
  subNavIdle: 'bg-transparent border-transparent text-slate-500 hover:bg-white/70',
};

// Per-agent accent — the ONLY place an agent's own hue appears.
export const AGENT_ACCENT = {
  marketing: {
    label: 'Marketing Agent',
    iconTile: 'bg-white/20 border-white/30 text-white',
    dot: 'bg-fuchsia-300',
  },
  sales: {
    label: 'Sales Agent',
    iconTile: 'bg-white/20 border-white/30 text-white',
    dot: 'bg-emerald-300',
  },
  support: {
    label: 'Support Agent',
    iconTile: 'bg-white/20 border-white/30 text-white',
    dot: 'bg-sky-300',
  },
};
