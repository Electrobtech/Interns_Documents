'use client';
import { Bot, LayoutDashboard, Megaphone, TrendingUp, Headphones, UserCheck } from 'lucide-react';
import Tabs from '@/components/Tabs';
import AgentsOverview   from '@/components/ai-agents/AgentsOverview';
import MarketingWorkspace from '@/components/ai-agents/MarketingWorkspace';
import SalesWorkspace   from '@/components/ai-agents/SalesWorkspace';
import SupportWorkspace from '@/components/ai-agents/SupportWorkspace';
import HandoffQueue     from '@/components/ai-agents/HandoffQueue';

export default function AIAgentsPage() {
  return (
    <Tabs
      title="AI Agents & Automation"
      icon={Bot}
      tabs={[
        { label: 'Overview',          icon: LayoutDashboard, render: () => <AgentsOverview />   },
        { label: 'Marketing Agent',   icon: Megaphone,       render: () => <MarketingWorkspace /> },
        { label: 'Sales Agent',       icon: TrendingUp,      render: () => <SalesWorkspace />   },
        { label: 'Support Agent',     icon: Headphones,      render: () => <SupportWorkspace /> },
        { label: 'Handoff Queue',     icon: UserCheck,       render: () => <HandoffQueue />     },
      ]}
    />
  );
}
