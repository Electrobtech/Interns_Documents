import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import MarketingWorkspace from './components/marketing/MarketingWorkspace'
import SalesWorkspace from './components/sales/SalesWorkspace'
import SupportWorkspace from './components/support/SupportWorkspace'

export type AppView = 'dashboard' | 'marketing' | 'sales' | 'support'

export default function App() {
  const [view, setView] = useState<AppView>('dashboard')

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: '#F4F6FA', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <Sidebar activeView={view} onNavigate={setView} />
      <main className="flex-1 overflow-y-auto min-w-0">
        <div key={view} className="animate-fade-up">
          {view === 'dashboard' && <Dashboard onNavigate={setView} />}
          {view === 'marketing' && <MarketingWorkspace onNavigate={setView} />}
          {view === 'sales' && <SalesWorkspace onNavigate={setView} />}
          {view === 'support' && <SupportWorkspace onNavigate={setView} />}
        </div>
      </main>
    </div>
  )
}
