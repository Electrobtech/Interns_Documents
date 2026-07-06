'use client';
import {
  LayoutDashboard, Inbox, Users, Bot, Megaphone, ShoppingCart,
  Star, BarChart3, Plug, Settings, MessageCircle, Instagram,
  MessageSquare, Smartphone, Globe, Phone, Mail,
} from 'lucide-react';

const platform = [
  ['Dashboard', LayoutDashboard, true],
  ['Unified Inbox', Inbox],
  ['Contacts & Leads', Users],
  ['AI Agents & Automation', Bot],
  ['Campaigns & Broadcasts', Megaphone],
  ['Ecommerce & Revenue', ShoppingCart],
  ['Reviews & Social', Star],
  ['Analytics & Insights', BarChart3],
  ['Integrations & APIs', Plug],
  ['Settings & Team', Settings],
];

const channels = [
  ['WhatsApp', MessageCircle],
  ['Instagram', Instagram],
  ['Messenger', MessageSquare],
  ['SMS / RCS', Smartphone],
  ['Web Chat', Globe],
  ['Voice Call', Phone],
  ['Email', Mail],
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0 overflow-y-auto">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="font-bold text-brand-dark leading-tight">Electrobtech</div>
        <div className="text-[10px] tracking-wide text-slate-400">INNOVATIONS PVT LTD</div>
      </div>
      <nav className="p-3">
        <p className="px-2 text-[11px] font-semibold text-slate-400 mb-1">PLATFORM</p>
        {platform.map(([label, Icon, active]) => (
          <a key={label} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 cursor-pointer
            ${active ? 'bg-brand-light text-brand-dark font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icon size={17} /> {label}
          </a>
        ))}
        <p className="px-2 text-[11px] font-semibold text-slate-400 mt-4 mb-1">CHANNELS</p>
        {channels.map(([label, Icon]) => (
          <a key={label} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 text-slate-600 hover:bg-slate-50 cursor-pointer">
            <Icon size={17} /> {label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
