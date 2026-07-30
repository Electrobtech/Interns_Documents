'use client';
import SupportWorkspace from '@/components/ai-agents/SupportWorkspace';

// Dedicated Support Agent route (spec: /app/support). Shares the same workspace
// component as the AI Agents hub so both entry points stay in sync.
export default function SupportAgentPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <SupportWorkspace />
    </div>
  );
}
