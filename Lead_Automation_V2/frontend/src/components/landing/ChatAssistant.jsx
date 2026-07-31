'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, ArrowLeft, ExternalLink, Send } from 'lucide-react';
import FLOW from '../../data/chatbotFlow.json';

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  // Each entry: { role: 'bot' | 'user', text, nodeId? }
  const [thread, setThread] = useState([
    { role: 'bot', text: FLOW.nodes[FLOW.rootNode].message, nodeId: FLOW.rootNode },
  ]);
  // Actual visited path, so Back always returns to where the visitor really
  // came from (a node's static backNode isn't enough once cross-links let
  // several parents reach the same node, e.g. Pricing and root both reach
  // Contact Sales).
  const [pathStack, setPathStack] = useState([FLOW.rootNode]);
  const scrollRef = useRef(null);

  const currentId = pathStack[pathStack.length - 1];
  const node = FLOW.nodes[currentId];
  const canGoBack = pathStack.length > 1;

  // Draw attention once, only if the visitor has scrolled past the hero and never opened it.
  useEffect(() => {
    if (open) return;
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.9) {
        setNudge(true);
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [open]);

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToEnd(); }, [thread, scrollToEnd]);

  const goToNode = useCallback((nextId, userLabel) => {
    const next = FLOW.nodes[nextId];
    if (!next) return;

    setPathStack((prev) => [...prev, nextId]);
    setThread((prev) => [
      ...prev,
      { role: 'user', text: userLabel },
      { role: 'bot', text: next.message, nodeId: nextId },
    ]);
  }, []);

  // Undo the last forward step in place — no new bubbles. Each forward step
  // appended exactly one user+bot pair, so popping one path entry and slicing
  // the matching pair off the transcript replays the visit exactly in reverse.
  const goBack = useCallback(() => {
    setPathStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    setThread((prev) => (prev.length > 1 ? prev.slice(0, -2) : prev));
  }, []);

  const handleReply = useCallback((reply) => {
    if (reply.label === 'Back') {
      goBack();
      return;
    }
    if (reply.url && !reply.next) {
      if (reply.external) window.open(reply.url, '_blank', 'noopener');
      else {
        setOpen(false);
        document.querySelector(reply.url)?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    goToNode(reply.next, reply.label);
  }, [goToNode, goBack]);

  return (
    <>
      {/* Launcher */}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2.5">
        <AnimatePresence>
          {nudge && !open && (
            <motion.button
              type="button"
              onClick={() => { setOpen(true); setNudge(false); }}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[220px] rounded-2xl rounded-br-md border border-violet-100 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-lg shadow-violet-500/10"
            >
              Questions about Orbq? Tap to explore. 👋
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => { setOpen((v) => !v); setNudge(false); }}
          whileTap={{ scale: 0.94 }}
          aria-label={open ? 'Close assistant' : 'Open assistant'}
          className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-rose-600 via-fuchsia-500 to-violet-500 text-white shadow-xl shadow-violet-500/30 transition-shadow hover:shadow-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={open ? 'x' : 'chat'}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-24 right-5 z-[60] flex h-[min(560px,calc(100vh-8rem))] w-[calc(100vw-2.5rem)] max-w-[380px] flex-col overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-[0_24px_70px_-20px_rgba(139,92,246,0.35)]"
          >
            {/* Header — brand identity is fixed; only the back arrow is contextual */}
            <div className="relative shrink-0 bg-gradient-to-br from-rose-600 via-fuchsia-500 to-violet-500 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2.5">
                {canGoBack && (
                  <button
                    type="button" onClick={goBack} aria-label="Go back"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold leading-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
                    Orbq Guide
                  </p>
                </div>
              </div>
            </div>

            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#FAF7FF] px-4 py-4">
              {thread.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-rose-600 via-fuchsia-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-sm'
                        : 'max-w-[88%] rounded-2xl rounded-bl-md border border-violet-100 bg-white px-3.5 py-2.5 text-[13px] font-medium leading-relaxed text-slate-700 shadow-sm'
                    }
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}

            </div>

            {/* Quick replies for the node the bot is currently sitting on */}
            <div className="shrink-0 border-t border-violet-100 bg-white px-4 py-3">
              {node?.cta && (
                <a
                  href={node.cta.url}
                  target={node.cta.external ? '_blank' : undefined}
                  rel={node.cta.external ? 'noopener noreferrer' : undefined}
                  onClick={(e) => {
                    if (!node.cta.external) {
                      e.preventDefault();
                      setOpen(false);
                      document.querySelector(node.cta.url)?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-fuchsia-500 to-violet-500 px-4 py-2.5 text-[13px] font-bold text-white shadow-md shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:shadow-violet-500/40"
                >
                  {node.cta.label}
                  {node.cta.external ? <ExternalLink className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                </a>
              )}

              <div className="flex flex-wrap gap-2">
                {(node?.quickReplies ?? []).map((reply) => {
                  const isBack = reply.label === 'Back';
                  return (
                    <button
                      key={reply.label}
                      type="button"
                      onClick={() => handleReply(reply)}
                      className={
                        isBack
                          ? 'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700'
                          : 'inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-100 hover:shadow-sm'
                      }
                    >
                      {isBack && <ArrowLeft className="h-3 w-3" />}
                      {reply.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
