import type { AppView } from '../App'
import {
  LayoutDashboard, Megaphone, TrendingUp, Headphones,
  Settings, Bell, Search, ChevronRight, Plug, BarChart3,
  Users, BookOpen, HelpCircle, LogOut
} from 'lucide-react'

const NAV_MAIN = [
  { id: 'dashboard' as AppView, label: 'AI Command Center', icon: LayoutDashboard },
  { id: 'marketing' as AppView, label: 'Marketing Agent', icon: Megaphone, dotColor: '#7C3AED' },
  { id: 'sales' as AppView, label: 'Sales Agent', icon: TrendingUp, dotColor: '#0284C7' },
  { id: 'support' as AppView, label: 'Support Agent', icon: Headphones, dotColor: '#059669' },
]

const NAV_PLATFORM = [
  { label: 'Integrations', icon: Plug },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Team', icon: Users },
  { label: 'Knowledge Base', icon: BookOpen },
]

interface SidebarProps {
  activeView: AppView
  onNavigate: (view: AppView) => void
}

export default function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col h-screen"
      style={{ background: '#0F1929', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B6EF0 0%, #7C3AED 100%)' }}
          >
            <span className="text-white font-bold text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>O</span>
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-none" style={{ fontFamily: "'Outfit', sans-serif" }}>Orbq</div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Lead Automation</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pt-4 pb-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <Search size={13} color="rgba(255,255,255,0.3)" />
          <input
            placeholder="Search..."
            className="bg-transparent text-xs outline-none w-full placeholder-white/30"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          />
          <span className="text-xs font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }}>⌘K</span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-0.5">
        <div className="px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
            AI Agents
          </span>
        </div>

        {NAV_MAIN.map(item => {
          const Icon = item.icon
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: isActive ? 'rgba(59, 110, 240, 0.18)' : 'transparent',
                color: isActive ? '#93B4FF' : 'rgba(255,255,255,0.5)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
                  ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.78)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'
                }
              }}
            >
              <Icon size={15} />
              <span className="flex-1 text-left">{item.label}</span>
              {'dotColor' in item && item.dotColor && (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: item.dotColor, boxShadow: `0 0 5px ${item.dotColor}` }}
                />
              )}
              {isActive && <ChevronRight size={12} style={{ color: '#93B4FF' }} />}
            </button>
          )
        })}

        <div className="px-3 py-2 mt-4">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Platform
          </span>
        </div>

        {NAV_PLATFORM.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.35)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'
              }}
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Bottom utilities */}
      <div className="px-3 py-3 space-y-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <button
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'
          }}
        >
          <Bell size={15} />
          <span>Notifications</span>
          <span className="ml-auto bg-amber-400 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-md">4</span>
        </button>
        <button
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'
          }}
        >
          <HelpCircle size={15} />
          <span>Help & Docs</span>
        </button>
      </div>

      {/* User profile */}
      <div className="px-3 pb-4">
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B6EF0, #7C3AED)' }}>
            <span className="text-white text-xs font-bold">JR</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">James Rivera</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Admin · Pro Plan</div>
          </div>
          <Settings size={13} style={{ color: 'rgba(255,255,255,0.25)' }} />
        </div>
      </div>
    </aside>
  )
}
