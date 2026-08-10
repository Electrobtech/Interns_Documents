'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard, Inbox, Users, Bot, Megaphone, ShoppingCart,
  Star, BarChart3, Plug, Settings, MessageCircle, Instagram,
  MessageSquare, Smartphone, Globe, Phone, Mail, ChevronDown, Bell,
  Zap, FileText, Linkedin, PanelLeftClose, PanelLeftOpen, CreditCard,
  LayoutTemplate, Workflow, CalendarClock, Package,
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
  { label: 'Follow-ups',              icon: CalendarClock,   href: '/app/follow-ups'         },
  { 
    label: 'AI Agents & Automation',  
    icon: Bot,             
    href: '/app/ai-agents',
    expandable: true,
    sub: [
      ['AI Command Center', '/app/ai-agents'],
      ['Marketing Agent', '/app/ai-agents?agent=marketing'],
      ['Sales Agent', '/app/ai-agents?agent=sales'],
      ['Support Agent', '/app/ai-agents?agent=support']
    ]
  },
  { label: 'Products & Offers',       icon: Package,         href: '/app/products'           },
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

// Every channel here just opens the Unified Inbox pre-filtered to that
// channel (see isChannelActive below) — there's nothing to expand.
// These used to be ExpandableNavItem entries with a chevron toggle whose
// only sub-item was a single "Conversations" link pointing at the exact
// same href as the parent, i.e. a dropdown that expanded to reveal one
// link identical to the one you'd already clicked to open it. Plain
// direct links, same as Voice Call / Email already were.
const CHANNELS = [
  { label: 'WhatsApp',  icon: MessageCircle, href: '/app/channels/whatsapp'  },
  { label: 'Instagram', icon: Instagram,     href: '/app/channels/instagram' },
  { label: 'Messenger', icon: MessageSquare, href: '/app/channels/messenger' },
  { label: 'LinkedIn',  icon: Linkedin,      href: '/app/channels/linkedin'  },
  { label: 'SMS / RCS', icon: Smartphone,    href: '/app/channels/sms'       },
  { label: 'Web Chat',  icon: Globe,         href: '/app/channels/webchat'   },
  { label: 'Voice Call',icon: Phone,         href: '/app/channels/voice'     },
  { label: 'Email',     icon: Mail,          href: '/app/channels/email'     },
];

const AUTOMATION = [
  { label: 'WhatsApp Automation',  icon: MessageCircle,  href: '/app/channels/whatsapp/automation'  },
  { label: 'Instagram Automation', icon: Instagram,      href: '/app/channels/instagram/automation' },
  { label: 'SMS / RCS Automation', icon: Smartphone,     href: '/app/channels/sms/automation'       },
  { label: 'Templates',            icon: LayoutTemplate, href: '/app/campaigns/templates'            },
  { label: 'Playbooks',            icon: Workflow,       href: '/app/automation/playbooks'          },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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

  const isChannelActive = (href) =>
    isActive(href) && !pathname.startsWith(href + '/automation');

  const { byChannel, clearChannel } = useUnreadCounts();

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
          item.expandable
            ? <ExpandableNavItem key={item.href} item={item} pathname={pathname} isActive={isActive(item.href)} collapsed={collapsed} />
            : <NavItem key={item.href} item={item} isActive={isActive(item.href)} collapsed={collapsed} />
        ))}
        <p className="px-3 pt-5 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Channels</p>
        {CHANNELS.map((item) =>
          <NavItem key={item.href} item={item} isActive={isChannelActive(item.href)} collapsed={collapsed}
            unread={byChannel[channelKey(item.href)] || 0} />
        )}
        <p className="px-3 pt-5 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Automation</p>
        {AUTOMATION.map((item) => (
          <NavItem key={item.href} item={item} isActive={isActive(item.href)} collapsed={collapsed} />
        ))}
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

function NavItem({ item, isActive, collapsed, unread = 0 }) {
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
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && unread > 0 && <UnreadBadge count={unread} />}
    </Link>
  );
}

function UnreadBadge({ count }) {
  return (
    <span className="ml-auto shrink-0 bg-emerald-500 text-white text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 grid place-items-center font-semibold">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// Same visual language as NavItem, plus a Conversations/Automation sub-menu
// for channels that have a Playbook Studio flow builder.
function ExpandableNavItem({ item, pathname, isActive, unread = 0, collapsed = false }) {
  const { label, icon: Icon, href, sub } = item;
  const subItems = sub || [['Conversations', href]];
  const searchParams = useSearchParams();
  const agentParam = searchParams.get('agent');
  const open = (pathname.startsWith(href) && !pathname.startsWith(href + '/automation'))
    || subItems.some(([, h]) => {
      const baseH = h.split('?')[0];
      return pathname === baseH || pathname.startsWith(baseH + '/');
    });
  return (
    <div>
      <Link
        href={href}
        className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150
          ${collapsed ? 'justify-center px-0 py-2.5' : ''}
          ${isActive
            ? 'bg-gradient-to-r from-violet-50 to-rose-50/60 text-violet-700 font-semibold'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
      >
        {isActive && !collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-gradient-to-b from-violet-500 to-rose-500" />
        )}
        <Icon size={16} className={isActive ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600 transition-colors'} />
        {!collapsed && <span className="truncate">{label}</span>}
        {!collapsed && unread > 0 && <UnreadBadge count={unread} />}
        {!collapsed && <ChevronDown size={14} className={`${unread > 0 ? '' : 'ml-auto'} transition-transform ${open ? 'rotate-180' : ''} ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />}
      </Link>
      {open && !collapsed && (
        <div className="ml-6 mb-1 border-l border-slate-200 pl-3">
          {subItems.map(([subLabel, subHref]) => {
            let isSubActive = false;
            if (subHref.includes('?agent=')) {
              const paramValue = subHref.split('?agent=')[1];
              isSubActive = agentParam === paramValue;
            } else {
              isSubActive = pathname === subHref && !agentParam;
            }
            return (
              <Link
                key={subHref}
                href={subHref}
                className={`block px-2 py-1.5 rounded-lg text-[13px] mb-0.5 transition-colors
                  ${isSubActive ? 'text-violet-700 font-semibold bg-violet-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              >
                {subLabel}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
