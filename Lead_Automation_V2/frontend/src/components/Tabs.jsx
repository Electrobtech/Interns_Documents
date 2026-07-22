'use client';
import { useState } from 'react';

// Premium tab switcher — pill-style active indicator, smooth transitions.
// tabs = [{ label, icon?: LucideIcon, render: () => <node/> }]
export default function Tabs({ title, icon: TitleIcon, tabs }) {
  const [active, setActive] = useState(0);

  return (
    <div className="space-y-0">
      {/* Page header */}
      {title && (
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3 mb-5">
            {TitleIcon && (
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600 shadow-sm">
                <TitleIcon size={20} />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-800 leading-tight">{title}</h2>
              <div className="h-0.5 w-8 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full mt-1" />
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="px-6">
        <div className="inline-flex items-center gap-1 bg-slate-100/80 rounded-2xl p-1 border border-slate-200/60">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActive(i)}
              className={`
                relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                transition-all duration-200
                ${i === active
                  ? 'bg-white text-slate-800 shadow-card border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                }
              `}
            >
              {t.icon && (
                <t.icon
                  size={14}
                  className={i === active ? 'text-blue-500' : 'text-slate-400'}
                />
              )}
              {t.label}
              {i === active && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 mt-4 mb-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Tab content — animated entry */}
      <div key={active} className="p-6 animate-slide-up">
        {tabs[active].render()}
      </div>
    </div>
  );
}
