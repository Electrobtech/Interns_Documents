'use client';
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

let socket = null;

// One shared connection for the whole app — inbox-service (proxied through
// the gateway at /socket.io, see api-gateway/src/index.js) authenticates
// the handshake with the same JWT useApi() already sends as a Bearer
// header, then auto-joins the caller to `org:<organizationId>` for
// conversation-list updates (see services/inbox-service/src/realtime.js).
export function getSocket() {
  if (socket) return socket;
  const token = getToken();
  if (!token) return null;
  socket = io(BASE, { path: '/socket.io', auth: { token } });
  return socket;
}

// Subscribes to a named event for the lifetime of the calling component.
// Pass a stable `deps` array (like useEffect) if the handler closes over
// values that change — otherwise the listener is attached once on mount.
export function useSocketEvent(event, handler, deps = []) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const wrapped = (...args) => handlerRef.current(...args);
    s.on(event, wrapped);
    return () => s.off(event, wrapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}

// Joins `conversation:<id>` for the lifetime of the calling component, so
// the caller starts receiving that conversation's 'message:new' events —
// and leaves the room again on unmount (see leave:conversation in
// realtime.js) so a closed thread doesn't keep streaming updates.
export function useConversationRoom(conversationId) {
  useEffect(() => {
    if (!conversationId) return;
    const s = getSocket();
    if (!s) return;
    s.emit('join:conversation', conversationId);
    return () => s.emit('leave:conversation', conversationId);
  }, [conversationId]);
}
