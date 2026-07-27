'use client';
import { useParams } from 'next/navigation';
import ConversationThread from '@/components/ConversationThread';

// Channels > WhatsApp > a conversation — keeps the thread nested under its
// channel (/app/channels/whatsapp/conversation/:id) instead of jumping into
// the unified inbox, so "Channels > WhatsApp > Conversation" is a real,
// bookmarkable route. Same underlying data/behavior as /app/inbox/[id];
// only where "back" goes and the URL differ.
export default function ChannelConversationView() {
  const { type } = useParams();
  return (
    <ConversationThread
      backHref={`/app/channels/${type}`}
      backLabel={`Back to ${type} conversations`}
    />
  );
}
