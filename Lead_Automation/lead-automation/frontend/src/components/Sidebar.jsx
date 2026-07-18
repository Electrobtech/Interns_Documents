'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Inbox, Users, Bot, Megaphone, ShoppingCart,
  Star, BarChart3, Plug, Settings, MessageCircle, Instagram,
  MessageSquare, Smartphone, Globe, Phone, Mail, ChevronDown, Bell,
  Zap, FileText, Linkedin,
} from 'lucide-react';

const PLATFORM = [
  { label: 'Dashboard',              icon: LayoutDashboard, href: '/'                  },
  { label: 'Unified Inbox',          icon: Inbox,           href: '/inbox'             },
  { label: 'Contacts & Leads',       icon: Users,           href: '/contacts'          },
  { label: 'AI Agents',              icon: Bot,             href: '/ai-agents'         },
  { label: 'Campaigns & Broadcasts', icon: Megaphone,       href: '/campaigns'         },
  { label: 'Ecommerce & Revenue',    icon: ShoppingCart,    href: '/ecommerce'         },
  { label: 'Reviews & Social',       icon: Star,            href: '/reviews'           },
  { label: 'Analytics & Insights',   icon: BarChart3,       href: '/analytics'         },
  { label: 'Documents & Knowledge',  icon: FileText,        href: '/documents'         },
  { label: 'Integrations & APIs',    icon: Plug,            href: '/integrations'      },
  { label: 'Settings & Team',        icon: Settings,        href: '/settings'          },
  { label: 'Click Notification Demo',icon: Bell,            href: '/notification-demo' },
];

// Channels that have a Playbook Studio ("Automation" tab) get `expandable:
// true`, which opens a Conversations/Automation sub-menu below the main
// link. Every other channel stays a flat link.
const CHANNELS = [
  { label: 'WhatsApp',  icon: MessageCircle, href: '/channels/whatsapp',  expandable: true  },
  { label: 'Instagram', icon: Instagram,     href: '/channels/instagram', expandable: true  },
  { label: 'Messenger', icon: MessageSquare, href: '/channels/messenger', expandable: false },
  { label: 'LinkedIn',  icon: Linkedin,      href: '/channels/linkedin',  expandable: false },
  { label: 'SMS / RCS', icon: Smartphone,    href: '/channels/sms',       expandable: false },
  { label: 'Web Chat',  icon: Globe,         href: '/channels/webchat',   expandable: false },
  { label: 'Voice Call',icon: Phone,         href: '/channels/voice',     expandable: false },
  { label: 'Email',     icon: Mail,          href: '/channels/email',     expandable: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200/80 h-screen sticky top-0 flex flex-col overflow-hidden">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <Zap size={15} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm leading-tight">Electrobtech</div>
            <div className="text-[10px] tracking-widest text-slate-400 uppercase">Innovations Pvt Ltd</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        <p className="px-3 pt-1 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Platform</p>
        {PLATFORM.map((item) => (
          <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
        ))}
        <p className="px-3 pt-5 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Channels</p>
        {CHANNELS.map((item) =>
          item.expandable
            ? <ExpandableNavItem key={item.href} item={item} pathname={pathname} isActive={isActive(item.href)} />
            : <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
        )}
      </nav>

      {/* Status footer */}
      <div className="px-5 py-3 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-slate-400">All systems operational</span>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ item, isActive }) {
  const { label, icon: Icon, href } = item;
  return (
    <Link
      href={href}
      className={`
        group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
        transition-all duration-150 relative
        ${isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
        }
      `}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-blue-600" />
      )}
      <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600 transition-colors'} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

// Same visual language as NavItem, plus a Conversations/Automation sub-menu
// for channels that have a Playbook Studio flow builder.
function ExpandableNavItem({ item, pathname, isActive }) {
  const { label, icon: Icon, href } = item;
  const open = pathname.startsWith(href);
  return (
    <div>
      <Link
        href={href}
        className={`
          group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
          transition-all duration-150 relative
          ${isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
          }
        `}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-blue-600" />
        )}
        <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600 transition-colors'} />
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''} ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
      </Link>
      {open && (
        <div className="ml-6 mb-1 border-l border-slate-200 pl-3">
          {[['Conversations', href], ['Automation', `${href}/automation`]].map(([subLabel, subHref]) => (
            <Link
              key={subHref}
              href={subHref}
              className={`block px-2 py-1.5 rounded-lg text-[13px] mb-0.5
                ${pathname === subHref ? 'text-blue-700 font-medium bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {subLabel}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
