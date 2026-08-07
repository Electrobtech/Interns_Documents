'use client';
/**
 * Second, independent Socket.io connection for the Marketing Hub's live
 * campaign/recipient progress — same shape as ./socket.js, deliberately not
 * merged with it: that one talks to inbox-service at the bare /socket.io
 * path, this one talks to marketing-hub-service at /marketing-hub/socket.io
 * (see api-gateway/src/index.js's route table — the two paths are routed to
 * different services, so they need separate `io()` clients).
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

let socket = null;

export function getMarketingHubSocket() {
  if (socket) return socket;
  const token = getToken();
  if (!token) return null;
  socket = io(BASE, { path: '/marketing-hub/socket.io', auth: { token } });
  return socket;
}

export function useMarketingHubSocketEvent(event, handler, deps = []) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const s = getMarketingHubSocket();
    if (!s) return;
    const wrapped = (...args) => handlerRef.current(...args);
    s.on(event, wrapped);
    return () => s.off(event, wrapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}

// Joins `mh-campaign:<id>` for the lifetime of the calling component (an
// open campaign/broadcast detail drawer), so it starts receiving that
// campaign's 'recipient:updated' events — and leaves on unmount.
export function useCampaignRoom(campaignId) {
  useEffect(() => {
    if (!campaignId) return;
    const s = getMarketingHubSocket();
    if (!s) return;
    s.emit('join:campaign', campaignId);
    return () => s.emit('leave:campaign', campaignId);
  }, [campaignId]);
}
