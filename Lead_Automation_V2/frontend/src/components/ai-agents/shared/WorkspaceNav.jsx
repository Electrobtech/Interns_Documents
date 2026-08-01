'use client';
import { BRAND } from './agentTheme';

// Two-tier grouped navigation shared by every agent workspace, so Marketing,
// Sales and Support all behave identically: a row of category buttons, and —
// only when the active category holds more than one tool — a second row of the
// tools inside it.
//
// Props:
//   groups: [{ key, label, icon, hint?, items: [{ key, label, icon }] }]
//   active: currently-open tool key
//   onSelect: (toolKey) => void
export default function WorkspaceNav({ groups, active, onSelect }) {
  const groupForTab = Object.fromEntries(
    groups.flatMap((g) => g.items.map((it) => [it.key, g.key])),
  );
  const activeGroupKey = groupForTab[active] || groups[0]?.key;
  const activeGroup = groups.find((g) => g.key === activeGroupKey);

  return (
    <div className="space-y-3">
      {/* Tier 1 — categories */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1">
        {groups.map((g) => {
          const Icon = g.icon;
          const isActive = g.key === activeGroupKey;
          return (
            <button
              key={g.key}
              onClick={() => onSelect(g.items[0].key)}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border whitespace-nowrap transition-colors shrink-0
                ${isActive ? `${BRAND.navActive} ${BRAND.navActiveShadow}` : BRAND.navIdle}`}
            >
              <Icon size={15} /> {g.label}
            </button>
          );
        })}
      </div>

      {/* Tier 2 — tools inside the active category (only when >1) */}
      {activeGroup && activeGroup.items.length > 1 && (
        <div className={`flex flex-wrap items-center gap-1.5 ${BRAND.subNavShell}`}>
          {activeGroup.hint && (
            <span className="text-[11px] font-medium text-violet-400 px-2 hidden sm:inline">
              {activeGroup.hint}
            </span>
          )}
          {activeGroup.items.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap
                ${active === key ? BRAND.subNavActive : BRAND.subNavIdle}`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
