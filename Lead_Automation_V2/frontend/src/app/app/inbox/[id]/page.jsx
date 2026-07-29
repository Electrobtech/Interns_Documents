'use client';
import ConversationThread from '@/components/ConversationThread';
// Unified-inbox conversation view — thin wrapper around the shared
// ConversationThread component (also used at
// /app/channels/[type]/conversation/[id] for the per-channel view).
export default function ConversationView() {
  return <ConversationThread backHref="/app/inbox" backLabel="Back to inbox" />;
}
