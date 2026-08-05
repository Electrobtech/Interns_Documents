'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Overview from '@/components/super-admin/analytics/Overview';
import SalesAI from '@/components/super-admin/analytics/SalesAI';
import MarketingAI from '@/components/super-admin/analytics/MarketingAI';
import SupportAI from '@/components/super-admin/analytics/SupportAI';
import FinanceBilling from '@/components/super-admin/analytics/FinanceBilling';

const RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'this_month', label: 'This Month' },
  { key: 'custom', label: 'Custom Range' },
];

const TABS = [
  { key: 'overview', label: 'Overview', Component: Overview },
  { key: 'sales', label: 'Sales AI', Component: SalesAI },
  { key: 'marketing', label: 'Marketing AI', Component: MarketingAI },
  { key: 'support', label: 'Support AI', Component: SupportAI },
  { key: 'finance', label: 'Finance & Billing', Component: FinanceBilling },
];

// Super Admin Analytics — five tabs (Overview + one per AI agent domain +
// Finance/Billing), all driven off the same global date-range switcher.
// Each tab owns its own query (see lib/queries/superAdmin.js), same
// isolation pattern the original Overview widgets already used, so a
// slow tab doesn't block the others from rendering once selected.
export default function AnalyticsPage() {
  const [range, setRange] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [tab, setTab] = useState('overview');

  const rangeParams =
    range === 'custom'
      ? customFrom && customTo
        ? { range, from: customFrom, to: customTo }
        : null // don't fire queries until both custom bounds are picked
      : { range };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <RangeSwitcher
            range={range}
            setRange={setRange}
            customFrom={customFrom}
            customTo={customTo}
            setCustomFrom={setCustomFrom}
            setCustomTo={setCustomTo}
          />
          <ExportButtons />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ key, Component }) => (
          <TabsContent key={key} value={key}>
            <Component rangeParams={rangeParams} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function RangeSwitcher({ range, setRange, customFrom, customTo, setCustomFrom, setCustomTo }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-sm">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            className={`px-3 py-1.5 rounded ${
              range === opt.key ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {range === 'custom' && (
        <div className="flex items-center gap-1.5 text-sm">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}

// NOTE: no export backend exists yet (no PDF/CSV generation route on any
// service). These buttons are wired to a no-op with a visible "coming
// soon" affordance rather than silently doing nothing, so the UI is
// honest about the gap instead of implying a working export.
function ExportButtons() {
  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        disabled
        title="Export coming soon — no backend export route exists yet"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-400 cursor-not-allowed"
      >
        <Download className="size-3.5" /> PDF
      </button>
      <button
        disabled
        title="Export coming soon — no backend export route exists yet"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-400 cursor-not-allowed"
      >
        <Download className="size-3.5" /> CSV
      </button>
    </div>
  );
}
