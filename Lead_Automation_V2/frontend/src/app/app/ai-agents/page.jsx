'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AIDashboard from './components/AIDashboard';
import MarketingHub from './components/marketing/MarketingHub';
import SalesWorkspace from './components/SalesWorkspace';
import SupportWorkspace from './components/SupportWorkspace';

export default function AIAgentsPage() {
  const searchParams = useSearchParams();
  const [view, setView] = useState('dashboard');

  useEffect(() => {
    const agent = searchParams.get('agent');
    if (agent === 'marketing') {
      setView('marketing');
    } else if (agent === 'sales') {
      setView('sales');
    } else if (agent === 'support') {
      setView('support');
    } else {
      setView('dashboard');
    }
  }, [searchParams]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6FA] min-h-screen text-[#0F1929] selection:bg-blue-100" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="animate-fade-up">
        {view === 'dashboard' && <AIDashboard onNavigate={setView} />}
        {view === 'marketing' && <MarketingHub onBack={() => setView('dashboard')} />}
        {view === 'sales' && <SalesWorkspace />}
        {view === 'support' && <SupportWorkspace />}
      </div>
    </div>
  );
}
