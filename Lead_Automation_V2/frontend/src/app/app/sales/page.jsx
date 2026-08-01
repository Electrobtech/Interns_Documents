'use client';
import SalesWorkspace from '@/components/ai-agents/SalesWorkspace';

// Dedicated Sales Agent route (spec: /app/sales). Shares the same workspace
// component as the AI Agents hub so both entry points stay in sync.
export default function SalesAgentPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <SalesWorkspace />
    </div>
  );
}
