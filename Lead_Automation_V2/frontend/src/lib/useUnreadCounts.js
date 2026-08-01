'use client';
import { useEffect, useState, useCallback } from 'react';
import { useApi } from './useApi';
import { useSocketEvent } from './socket';

// Per-channel unread message counts for the sidebar's WhatsApp-style
// badges — backed by inbox-service's GET /conversations/unread-summary
// (see services/inbox-service/src/index.js), which counts real inbound
// WhatsApp/Instagram/Messenger/LinkedIn/SMS/Email/Web Chat messages, not
// the old dummy notification-service "UI click" demo.
//
// Fetches the current snapshot on mount, then stays live via the same
// Socket.io connection the Unified Inbox uses: every real-time
// 'conversation:updated' inbound event (see inbox-service/src/realtime.js)
// bumps that channel's count by one immediately, so badges update the
// moment a message arrives — no polling needed. Counts are re-synced from
// the server on mount/reconnect so a missed socket event never leaves a
// badge permanently wrong.
export function useUnreadCounts() {
  const { call } = useApi();
  const [byChannel, setByChannel] = useState({});
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const data = await call('/conversations/unread-summary');
      setByChannel(data.byChannel || {});
      setTotal(data.total || 0);
    } catch {
      // Silent — badges just keep their last-known values if this fails.
    }
  }, [call]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useSocketEvent(
    'conversation:updated',
    (payload) => {
      if (!payload || payload.direction !== 'inbound' || !payload.channel_type) return;
      setByChannel((prev) => ({
        ...prev,
        [payload.channel_type]: (prev[payload.channel_type] || 0) + 1,
      }));
      setTotal((prev) => prev + 1);
    },
    []
  );

  // Called after the user opens a conversation on this channel (the
  // conversation thread GET already bumps last_read_at server-side — see
  // inbox-service — this just re-syncs the badge locally without waiting
  // for the next poll/socket event).
  const clearChannel = useCallback((channelType) => {
    setByChannel((prev) => {
      const count = prev[channelType] || 0;
      if (!count) return prev;
      setTotal((t) => Math.max(0, t - count));
      return { ...prev, [channelType]: 0 };
    });
  }, []);

  return { byChannel, total, refresh, clearChannel };
}
