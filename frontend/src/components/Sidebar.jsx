'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Inbox, Users, Bot, Megaphone, ShoppingCart,
  Star, BarChart3, Plug, Settings, MessageCircle, Instagram,
  MessageSquare, Smartphone, Globe, Phone, Mail,
} from 'lucide-react';

const platform = [
  ['Dashboard', LayoutDashboard, '/'],
  ['Unified Inbox', Inbox, '/inbox'],
  ['Contacts & Leads', Users, '/contacts'],
  ['AI Agents & Automation', Bot, '/ai-agents'],
  ['Campaigns & Broadcasts', Megaphone, '/campaigns'],
  ['Ecommerce & Revenue', ShoppingCart, '/ecommerce'],
  ['Reviews & Social', Star, '/reviews'],
  ['Analytics & Insights', BarChart3, '/analytics'],
  ['Integrations & APIs', Plug, '/integrations'],
  ['Settings & Team', Settings, '/settings'],
];

const channels = [
  ['WhatsApp', MessageCircle, '/channels/whatsapp'],
  ['Instagram', Instagram, '/channels/instagram'],
  ['Messenger', MessageSquare, '/channels/messenger'],
  ['SMS / RCS', Smartphone, '/channels/sms'],
  ['Web Chat', Globe, '/channels/webchat'],
  ['Voice Call', Phone, '/channels/voice'],
  ['Email', Mail, '/channels/email'],
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const item = ([label, Icon, href]) => (
    <Link
      key={href}
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 cursor-pointer
        ${isActive(href)
          ? 'bg-brand-light text-brand-dark font-medium'
          : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <Icon size={17} /> {label}
    </Link>
  );

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0 overflow-y-auto">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="font-bold text-brand-dark leading-tight">Electrobtech</div>
        <div className="text-[10px] tracking-wide text-slate-400">INNOVATIONS PVT LTD</div>
      </div>
      <nav className="p-3">
        <p className="px-2 text-[11px] font-semibold text-slate-400 mb-1">PLATFORM</p>
        {platform.map(item)}
        <p className="px-2 text-[11px] font-semibold text-slate-400 mt-4 mb-1">CHANNELS</p>
        {channels.map(item)}
      </nav>
    </aside>
  );
}
