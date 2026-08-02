'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Inbox, Users, Bot, Megaphone, ShoppingCart,
  Star, BarChart3, Plug, Settings, MessageCircle, Instagram,
  MessageSquare, Smartphone, Globe, Phone, Mail, ChevronDown, Bell,
  Zap, FileText, Linkedin, PanelLeftClose, PanelLeftOpen, CreditCard,
} from 'lucide-react';
import { useUnreadCounts } from '@/lib/useUnreadCounts';

// Sidebar hrefs are '/app/channels/<key>' — this matches inbox-service's
// conversations.channel_type values (see GET /conversations/unread-summary)
// so a channel's badge count can be looked up directly by its href.
function channelKey(href) {
  return href.split('/').pop();
}

const PLATFORM = [
  { label: 'Dashboard',               icon: LayoutDashboard, href: '/app'                  },
  { label: 'Unified Inbox',           icon: Inbox,           href: '/app/inbox'              },
  { label: 'Contacts & Leads',        icon: Users,           href: '/app/contacts'           },
  { label: 'AI Agents & Automation',  icon: Bot,             href: '/app/ai-agents'          },
  { label: 'Campaigns & Broadcasts',  icon: Megaphone,       href: '/app/campaigns'          },
  { label: 'Ecommerce & Revenue',    icon: ShoppingCart,    href: '/app/ecommerce'          },
  { label: 'Reviews & Social',        icon: Star,            href: '/app/reviews'            },
  { label: 'Analytics & Insights',    icon: BarChart3,       href: '/app/analytics'          },
  { label: 'Documents & Knowledge',   icon: FileText,        href: '/app/documents'          },
  { label: 'Integrations & APIs',     icon: Plug,            href: '/app/integrations'       },
  { label: 'Billing & Payments',      icon: CreditCard,      href: '/app/billing'             },
  { label: 'Settings & Team',         icon: Settings,        href: '/app/settings'           },
  { label: 'Click Notification Demo', icon: Bell,            href: '/app/notification-demo' },
];

// Channels with a Playbook Studio ("Automation" tab) get `expandable: true`,
// which opens a Conversations/Automation sub-menu. Everything else is a flat link.
const CHANNELS = [
  { label: 'WhatsApp',  icon: MessageCircle, href: '/app/channels/whatsapp',  expandable: true  },
  { label: 'Instagram', icon: Instagram,     href: '/app/channels/instagram', expandable: true  },
  { label: 'Messenger', icon: MessageSquare, href: '/app/channels/messenger', expandable: false },
  { label: 'LinkedIn',  icon: Linkedin,      href: '/app/channels/linkedin',  expandable: false },
  { label: 'SMS / RCS', icon: Smartphone,    href: '/app/channels/sms',       expandable: true  },
  { label: 'Web Chat',  icon: Globe,         href: '/app/channels/webchat',   expandable: false },
  { label: 'Voice Call',icon: Phone,         href: '/app/channels/voice',     expandable: false },
  { label: 'Email',     icon: Mail,          href: '/app/channels/email',     expandable: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Persist the choice across navigation/reloads. Read in an effect rather
  // than in useState's initializer to avoid an SSR/client hydration mismatch.
  useEffect(() => {
    if (localStorage.getItem('sidebar:collapsed') === '1') setCollapsed(true);
  }, []);
  const toggle = () => setCollapsed((c) => {
    const next = !c;
    localStorage.setItem('sidebar:collapsed', next ? '1' : '0');
    return next;
  });

  const isActive = (href) =>
    href === '/app' ? pathname === '/app' : pathname === href || pathname.startsWith(href + '/');

  const { byChannel, clearChannel } = useUnreadCounts();

  // Opening a channel's section clears its badge in the sidebar right
  // away — same feel as opening a chat in WhatsApp. The authoritative
  // clear still happens server-side the moment an individual conversation
  // thread is opened (inbox-service bumps last_read_at there); this just
  // keeps the sidebar in sync without waiting on that per-thread fetch.
  const prevChannelRef = useRef(null);
  useEffect(() => {
    const current = CHANNELS.find((c) => pathname.startsWith(c.href));
    const key = current ? channelKey(current.href) : null;
    if (key && key !== prevChannelRef.current) {
      clearChannel(key);
    }
    prevChannelRef.current = key;
  }, [pathname, clearChannel]);

  return (
    <aside
      className={`${collapsed ? 'w-[76px]' : 'w-64'} shrink-0 h-screen sticky top-0 flex flex-col overflow-hidden
        border-r border-slate-200/80 bg-white transition-[width] duration-200 ease-in-out`}
    >
      {/* Brand */}
      <div className="px-4 py-4 border-b border-slate-100 shrink-0 flex items-center gap-3">
        <Link href="/app" className="flex items-center gap-2.5 min-w-0">
          {collapsed ? (
            <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 ring-1 ring-violet-100 shadow-sm bg-white">
              <Image src="/orbq-icon.png" alt="Orbq" width={36} height={36} className="w-full h-full object-contain" />
            </div>
          ) : (
            <Image src="/orbq-logo.png" alt="Orbq" width={128} height={36} className="h-9 w-auto object-contain" priority />
          )}
        </Link>
        {!collapsed && (
          <button onClick={toggle} title="Collapse sidebar"
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors shrink-0">
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={toggle} title="Expand sidebar"
          className="mx-auto mt-2 p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
          <PanelLeftOpen size={16} />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        <p className="px-3 pt-1 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Platform</p>
        {PLATFORM.map((item) => (
          <NavItem key={item.href} item={item} isActive={isActive(item.href)} collapsed={collapsed} />
        ))}
        <p className="px-3 pt-5 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Channels</p>
        {CHANNELS.map((item) =>
          item.expandable
            ? <ExpandableNavItem key={item.href} item={item} pathname={pathname} isActive={isActive(item.href)} collapsed={collapsed} />
            : <NavItem key={item.href} item={item} isActive={isActive(item.href)} collapsed={collapsed} />
        )}
      </nav>

      {/* Status footer */}
      <div className="px-4 py-3 border-t border-slate-100 shrink-0">
        <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
          <span className="relative flex h-2 w-2 shrink-0" title="All systems operational">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {!collapsed && <span className="text-[11px] text-slate-400">All systems operational</span>}
        </div>
      </div>
    </aside>
  );
}

function NavItem({ item, isActive, collapsed }) {
  const { label, icon: Icon, href } = item;
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150
        ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
        ${isActive
          ? 'bg-gradient-to-r from-violet-50 to-rose-50/60 text-violet-700 font-semibold'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-gradient-to-b from-violet-500 to-rose-500" />
      )}
      <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600 transition-colors'} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

// WhatsApp-style unread pill: the exact count up to 99, "99+" beyond that.
function UnreadBadge({ count }) {
  return (
    <span className="ml-auto shrink-0 bg-emerald-500 text-white text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 grid place-items-center font-semibold">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// Same visual language as NavItem, plus a Conversations/Automation sub-menu
// for channels that have a Playbook Studio flow builder.
function ExpandableNavItem({ item, pathname, isActive, collapsed }) {
  const { label, icon: Icon, href } = item;
  const open = pathname.startsWith(href);
  // Every expandable channel gets the same two sub-views: its live
  // conversations (the channel's own href) and its Playbook Studio
  // automation builder at `<href>/automation`.
  const subItems = [
    ['Conversations', href],
    ['Automation', `${href}/automation`],
  ];
  return (
    <div>
      <Link
        href={href}
        className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150
          ${isActive
            ? 'bg-gradient-to-r from-violet-50 to-rose-50/60 text-violet-700 font-semibold'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-gradient-to-b from-violet-500 to-rose-500" />
        )}
        <Icon size={16} className={isActive ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600 transition-colors'} />
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''} ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
      </Link>
      {open && (
        <div className="ml-6 mb-1 border-l border-slate-200 pl-3">
          {subItems.map(([subLabel, subHref]) => (
            <Link
              key={subHref}
              href={subHref}
              className={`block px-2 py-1.5 rounded-lg text-[13px] mb-0.5 transition-colors
                ${pathname === subHref ? 'text-violet-700 font-semibold bg-violet-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              {subLabel}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}