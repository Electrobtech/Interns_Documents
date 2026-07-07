'use client';
import { useState } from 'react';

// Lightweight tab switcher for multi-resource domain pages.
// tabs = [{ label, render: () => <node/> }]
export default function Tabs({ title, icon: Icon, tabs }) {
  const [active, setActive] = useState(0);
  return (
    <div className={`${title ? 'p-6' : ''} space-y-4`}>
      {title && (
        <div className="flex items-center gap-2">
          {Icon && <Icon size={20} className="text-brand" />}
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
      )}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t, i) => (
          <button key={t.label} onClick={() => setActive(i)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
              i === active
                ? 'border-brand text-brand-dark'
                : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div>{tabs[active].render()}</div>
    </div>
  );
}
