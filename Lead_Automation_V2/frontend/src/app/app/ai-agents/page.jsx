'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AIDashboard from './components/AIDashboard';
import MarketingHub from './components/marketing/MarketingHub';
import SalesWorkspace from './components/SalesWorkspace';
import SupportWorkspace from './components/SupportWorkspace';

function AIAgentsPageContent() {
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

  // Marketing hub takes full control of its own layout/height
  if (view === 'marketing') {
    return <MarketingHub onBack={() => setView('dashboard')} />;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6FA] min-h-screen text-[#0F1929] selection:bg-blue-100" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="animate-fade-up">
        {view === 'dashboard' && <AIDashboard onNavigate={setView} />}
        {view === 'sales' && <SalesWorkspace />}
        {view === 'support' && <SupportWorkspace />}
      </div>
    </div>
  );
}

export default function AIAgentsPage() {
  return (
    <Suspense fallback={null}>
      <AIAgentsPageContent />
    </Suspense>
  );
}
