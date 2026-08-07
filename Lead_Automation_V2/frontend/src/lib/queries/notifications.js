'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// Hooks for services/notification-service — the Support workspace's
// notification bell. GET /notifications -> { notifications, unreadCount }.
// Polls like the other live-ish hooks in this codebase (useConversations,
// useFollowUps) so the badge count updates without a manual refresh.

export function useNotifications() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => call('/notifications'),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

// POST /notifications/read-all — clears the badge; persists across refresh.
export function useMarkNotificationsRead() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'list'] }),
  });
}
