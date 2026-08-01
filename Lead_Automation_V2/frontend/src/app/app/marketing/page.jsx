'use client';
import MarketingWorkspace from '@/components/ai-agents/MarketingWorkspace';

// Dedicated Marketing Agent route (spec: /app/marketing). The workspace itself
// is shared with the AI Agents hub, so both entry points stay in sync.
export default function MarketingAgentPage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <MarketingWorkspace />
    </div>
  );
}
