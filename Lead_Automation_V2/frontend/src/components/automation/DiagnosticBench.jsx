'use client';
import React, { useState, useEffect, useRef, useCallback } from "react";
import { FileText, Send, RotateCcw, ChevronDown, Radio, WifiOff, Download } from "lucide-react";
import { useApi } from "@/lib/useApi";

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* Chat column mimics a real device thread (light, warm neutral).      */
/* Diagnostics column reads as an engine console (near-black, mono).   */
/* One shared accent — signal cyan — ties both sides together and only */
/* appears where something is actually "live" (in flight / connected). */
/* ------------------------------------------------------------------ */
const tokens = {
  chatBg: "#E9E3D8",
  chatBubbleBot: "#FFFFFF",
  chatBubbleUser: "#DCF3E4",
  chatText: "#2B2620",
  chatMeta: "#8B8375",
  consoleBg: "#0B0E11",
  consolePanel: "#12161B",
  consoleBorder: "#1F252C",
  consoleText: "#C8D1D9",
  consoleMuted: "#5B6570",
  signal: "#4FD8C4",
  warn: "#F2A65A",
  danger: "#E2685A",
};

/* ------------------------------------------------------------------ */
/* Fallback flow — used only when this component is opened standalone  */
/* (no `flow` prop passed in). When embedded in the Playbook Studio    */
/* app shell, the actual `flow` prop is whatever FlowBuilder just       */
/* exported, so builder edits show up here immediately.                */
/* ------------------------------------------------------------------ */
const DEFAULT_FLOW = {
  _id: "pb_project_details",
  name: "1.3 Project Details",
  entryNodeId: "node_list_project",
  nodes: [
    {
      id: "node_list_project",
      type: "message",
      data: {
        messageType: "list",
        body: "Please help us with the preferred project",
        list: {
          buttonLabel: "Options",
          sections: [
            {
              title: "Project Type",
              rows: [
                { id: "row_cse", title: "CSE Project" },
                { id: "row_eee", title: "EEE Project" },
                { id: "row_mech", title: "MECH Project" },
                { id: "row_ece", title: "ECE Project" },
              ],
            },
          ],
        },
        waitForReply: true,
        nextNodeId: "node_branch_project",
        defaultNextNodeId: "node_branch_project",
      },
    },
    {
      id: "node_branch_project",
      type: "answer_branch",
      data: {
        branches: [
          { matchOptionId: "row_cse", nextNodeId: "node_text_cse" },
          { matchOptionId: "row_eee", nextNodeId: "node_text_eee" },
          { matchOptionId: "row_mech", nextNodeId: "node_text_mech" },
          { matchOptionId: "row_ece", nextNodeId: "node_text_ece" },
        ],
        defaultBranch: { nextNodeId: "node_fallback_text" },
      },
    },
    {
      id: "node_text_cse",
      type: "message",
      data: { messageType: "text", body: "Please find the attachment!", waitForReply: false, nextNodeId: "node_document_cse" },
    },
    {
      id: "node_document_cse",
      type: "message",
      data: {
        messageType: "document",
        document: { filename: "IEEE CSE Projects lists.pdf" },
        waitForReply: false,
        nextNodeId: null,
      },
    },
    {
      id: "node_text_eee",
      type: "message",
      data: { messageType: "text", body: "Here's the EEE project catalog.", waitForReply: false, nextNodeId: "node_document_eee" },
    },
    {
      id: "node_document_eee",
      type: "message",
      data: { messageType: "document", document: { filename: "IEEE EEE Projects lists.pdf" }, waitForReply: false, nextNodeId: null },
    },
    {
      id: "node_text_mech",
      type: "message",
      data: { messageType: "text", body: "Here's the MECH project catalog.", waitForReply: false, nextNodeId: "node_document_mech" },
    },
    {
      id: "node_document_mech",
      type: "message",
      data: { messageType: "document", document: { filename: "IEEE MECH Projects lists.pdf" }, waitForReply: false, nextNodeId: null },
    },
    {
      id: "node_text_ece",
      type: "message",
      data: { messageType: "text", body: "Here's the ECE project catalog.", waitForReply: false, nextNodeId: "node_document_ece" },
    },
    {
      id: "node_document_ece",
      type: "message",
      data: { messageType: "document", document: { filename: "IEEE ECE Projects lists.pdf" }, waitForReply: false, nextNodeId: null },
    },
    {
      id: "node_fallback_text",
      type: "message",
      data: { messageType: "text", body: "Sorry, I didn't catch that — connecting you with our team.", waitForReply: false, nextNodeId: "node_handoff" },
    },
    { id: "node_handoff", type: "handoff", data: { team: "admissions", nextNodeId: null } },
  ],
};

// Routed through the CRM's API gateway (see src/lib/api.js) rather than a
// hardcoded standalone-app URL — the automation engine is now mounted at
// /automation on the same gateway as every other CRM service, and calls go
// through useApi() so the CRM's auth token rides along automatically.
const WEBHOOK_PATH = "/automation/session/simulate";
const RESET_PATH = "/automation/session/reset";

/* ------------------------------------------------------------------ */
/* Client-side walk — identical shape to the backend's evaluateWorkflowStep,
   used only when the real backend isn't reachable, so the bench stays
   testable offline. Every mock message says so explicitly (see MOCK badge).*/
/* ------------------------------------------------------------------ */
function localWalk(flow, fromNodeId, interaction) {
  const map = new Map(flow.nodes.map((n) => [n.id, n]));
  const fromNode = map.get(fromNodeId);
  let nextId = fromNode?.data?.nextNodeId ?? null;
  const rendered = [];

  while (nextId) {
    const node = map.get(nextId);
    if (!node) break;

    if (node.type === "answer_branch") {
      const match = node.data.branches.find((b) => b.matchOptionId === interaction?.selectedId);
      nextId = match ? match.nextNodeId : node.data.defaultBranch?.nextNodeId ?? null;
      continue;
    }
    if (node.type === "message") {
      rendered.push(node);
      if (node.data.waitForReply === false) {
        nextId = node.data.nextNodeId;
        continue;
      }
      break;
    }
    if (node.type === "handoff") {
      rendered.push(node);
      break;
    }
    break;
  }
  return rendered;
}

/* ------------------------------------------------------------------ */
/* Chat bubble renderers                                               */
/* ------------------------------------------------------------------ */
function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function BotBubble({ children, density = "detailed", timestamp }) {
  const compact = density === "compact";
  return (
    <div className={compact ? "flex justify-start mb-1" : "flex justify-start mb-2"}>
      <div>
        <div
          className={compact ? "max-w-[78%] rounded-xl rounded-tl-sm px-2.5 py-1.5 text-xs shadow-sm" : "max-w-[78%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm shadow-sm"}
          style={{ background: tokens.chatBubbleBot, color: tokens.chatText }}
        >
          {children}
        </div>
        {!compact && timestamp && (
          <div className="text-[10px] mt-0.5 ml-1" style={{ color: tokens.chatMeta }}>
            {formatTime(timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ children, density = "detailed", timestamp }) {
  const compact = density === "compact";
  return (
    <div className={compact ? "flex justify-end mb-1" : "flex justify-end mb-2"}>
      <div>
        <div
          className={compact ? "max-w-[78%] rounded-xl rounded-tr-sm px-2.5 py-1.5 text-xs shadow-sm" : "max-w-[78%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm shadow-sm"}
          style={{ background: tokens.chatBubbleUser, color: tokens.chatText }}
        >
          {children}
        </div>
        {!compact && timestamp && (
          <div className="text-[10px] mt-0.5 mr-1 text-right" style={{ color: tokens.chatMeta }}>
            {formatTime(timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

function TextMessage({ node, onDone, density, timestamp }) {
  useEffect(() => {
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <BotBubble density={density} timestamp={timestamp}><div className="whitespace-pre-wrap">{node.data.body}</div></BotBubble>;
}

function ButtonsMessage({ node, answered, onSelect, density, timestamp }) {
  const compact = density === "compact";
  return (
    <BotBubble density={density} timestamp={timestamp}>
      <div className="whitespace-pre-wrap">{node.data.body}</div>
      <div className={compact ? "mt-1 flex flex-col gap-1" : "mt-2 flex flex-col gap-1.5"}>
        {node.data.buttons.map((btn) => (
          <button
            key={btn.id}
            disabled={answered}
            onClick={() => onSelect(btn.id, btn.label)}
            className={compact ? "text-[11px] font-medium rounded-md border px-2 py-1 text-left transition disabled:opacity-40" : "text-xs font-medium rounded-lg border px-3 py-2 text-left transition disabled:opacity-40"}
            style={{
              borderColor: "#128C7E",
              color: "#128C7E",
              background: answered ? "transparent" : "#F3FBF9",
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </BotBubble>
  );
}

function ListMessage({ node, rows, buttonLabel, answered, onSelect, density, timestamp }) {
  const [open, setOpen] = useState(false);
  const compact = density === "compact";

  return (
    <BotBubble density={density} timestamp={timestamp}>
      <div className="whitespace-pre-wrap">{node.data.body}</div>
      <button
        disabled={answered}
        onClick={() => setOpen((o) => !o)}
        className={compact ? "mt-1 w-full flex items-center justify-center gap-1 text-[11px] font-semibold rounded-md px-2 py-1 disabled:opacity-40" : "mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 disabled:opacity-40"}
        style={{ background: "#128C7E", color: "#fff" }}
      >
        {buttonLabel || "Options"}
        <ChevronDown size={compact ? 11 : 13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && !answered && (
        <div className="mt-1.5 rounded-lg overflow-hidden border" style={{ borderColor: "#E3DED2" }}>
          {rows.map((row) => (
            <button
              key={row.id}
              onClick={() => {
                setOpen(false);
                onSelect(row.id, row.title);
              }}
              className={compact ? "w-full text-left text-[11px] px-2 py-1 hover:bg-black/5 border-b last:border-b-0" : "w-full text-left text-xs px-3 py-2 hover:bg-black/5 border-b last:border-b-0"}
              style={{ borderColor: "#EFEBE1" }}
            >
              {row.title}
            </button>
          ))}
        </div>
      )}
    </BotBubble>
  );
}

function DocumentMessage({ node, onDone, density, timestamp }) {
  useEffect(() => {
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const compact = density === "compact";
  const { filename, url } = node.data.document || {};
  const Wrapper = url ? "a" : "div";
  const wrapperProps = url
    ? { href: url, download: filename, target: "_blank", rel: "noopener noreferrer" }
    : {};
  return (
    <BotBubble density={density} timestamp={timestamp}>
      <Wrapper
        {...wrapperProps}
        className={
          (compact ? "flex items-center gap-1.5 rounded-md px-1.5 py-1" : "flex items-center gap-2.5 rounded-lg px-2.5 py-2") +
          (url ? " hover:opacity-80 cursor-pointer" : "")
        }
        style={{ background: "#F4F1EA" }}
      >
        <div className={compact ? "shrink-0 rounded p-1" : "shrink-0 rounded-md p-1.5"} style={{ background: "#E2685A22" }}>
          <FileText size={compact ? 13 : 18} color={tokens.danger} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={compact ? "text-[11px] font-medium truncate" : "text-xs font-medium truncate"}>{filename}</div>
          {/* File-type preview line — the "preview" text, hidden in compact so the row condenses to just the filename */}
          {!compact && (
            <div className="text-[10px]" style={{ color: tokens.chatMeta }}>
              PDF document
            </div>
          )}
        </div>
        {url && <Download size={compact ? 12 : 14} className="shrink-0" color={tokens.chatMeta} />}
      </Wrapper>
    </BotBubble>
  );
}

function HandoffBubble({ node, density }) {
  const compact = density === "compact";
  return (
    <div className={compact ? "flex justify-center my-1" : "flex justify-center my-2"}>
      <div className={compact ? "text-[10px] px-2 py-0.5 rounded-full" : "text-[11px] px-3 py-1 rounded-full"} style={{ background: "#00000010", color: tokens.chatMeta }}>
        Handed off to {node.data.team} team
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Diagnostics: lightweight JSON syntax highlighter (no deps)          */
/* ------------------------------------------------------------------ */
function highlightJSON(obj) {
  const json = JSON.stringify(obj, null, 2);
  const escaped = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const colored = escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g,
    (match) => {
      let color = "#7DD3FC"; // numbers
      if (/^"/.test(match)) {
        color = /:$/.test(match) ? "#4FD8C4" : "#E6C07B"; // keys vs string values
      } else if (/true|false/.test(match)) {
        color = "#F2A65A";
      } else if (/null/.test(match)) {
        color = "#E2685A";
      }
      return `<span style="color:${color}">${match}</span>`;
    }
  );
  return colored;
}

function Pill({ children, tone = "muted" }) {
  const toneMap = {
    muted: { bg: "#1F252C", fg: tokens.consoleMuted },
    live: { bg: "#4FD8C422", fg: tokens.signal },
    warn: { bg: "#F2A65A22", fg: tokens.warn },
  };
  const t = toneMap[tone];
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Per-channel chat chrome                                             */
/* WhatsApp is the historical default (and stays pixel-identical to     */
/* before); Instagram swaps in the brand gradient + a handle instead of */
/* a phone number. Add a new entry here for any future channel — the    */
/* render code below never branches on `channel` directly.              */
/* ------------------------------------------------------------------ */
const CHANNEL_CHROME = {
  whatsapp: {
    botName: "Admissions Bot",
    identity: "+91 90000 00000",
    headerClassName: "",
    headerStyle: { background: "#128C7E" },
    avatarStyle: { background: "#0D6E62" },
    identityColor: "#CFEDE7",
  },
  instagram: {
    botName: "Electrobtech Support",
    identity: "@electrobtech_support",
    headerClassName: "bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500",
    headerStyle: {}, // colors come from the Tailwind gradient class instead
    avatarStyle: { background: "rgba(255,255,255,0.28)" },
    identityColor: "#FDE7F3",
  },
};

/* ------------------------------------------------------------------ */
/* Root component                                                      */
/* ------------------------------------------------------------------ */
export default function DiagnosticBench({ flow = DEFAULT_FLOW, channel = "whatsapp", density = "detailed", onBack }) {
  const chrome = CHANNEL_CHROME[channel] || CHANNEL_CHROME.whatsapp;
  const { call } = useApi();
  const [messages, setMessages] = useState([]); // { id, role: 'bot'|'user'|'system', node?, label? }
  const [answeredIds, setAnsweredIds] = useState(() => new Set());
  const [session, setSession] = useState({
    currentSessionNode: flow.entryNodeId,
    recipientPhone: chrome.identity,
    lastNodesToRender: [],
  });
  const [connection, setConnection] = useState("unknown"); // 'live' | 'mock' | 'unknown'
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef(null);
  // Bumped every time bootstrap() starts a fresh session. advanceFrom()
  // captures the value at call time and checks it again after its await —
  // if bootstrap has run again in the meantime (e.g. React 18 Strict Mode's
  // dev-only double-invocation of mount effects), the stale call's result is
  // dropped instead of appending a second, duplicate "menu" message onto the
  // newer session.
  const sessionSeq = useRef(0);

  const pushBotNode = useCallback((node) => {
    setMessages((prev) => [...prev, { id: `${node.id}_${prev.length}`, role: "bot", node, ts: Date.now() }]);
  }, []);

  // Core "ask the engine (or the offline fallback) what comes next, then
  // render it" routine — shared by real user interactions (button taps,
  // typed replies) AND by bootstrap's auto-advance below. Doesn't touch the
  // user-bubble/answeredIds bookkeeping itself; callers that represent an
  // actual user action do that before calling this.
  const advanceFrom = useCallback(async (sourceNodeId, interaction, recipientPhone) => {
    const mySeq = sessionSeq.current;
    setBusy(true);
    const payload = {
      recipientPhone,
      playbookId: flow._id || flow.name,
      channel,
      interaction,
    };

    let nodesToRender = [];
    let mode = "live";

    try {
      const data = await call(WEBHOOK_PATH, { method: "POST", body: payload });
      nodesToRender = data.nodesToRender || [];
    } catch (err) {
      // Backend not reachable — fall back to the identical client-side walk
      // so the bench stays usable while the API is offline. Clearly flagged.
      mode = "mock";
      if (sourceNodeId) {
        // Continuing from a node that was awaiting a reply, OR auto-chaining
        // forward from a waitForReply:false node (bootstrap's case) — either
        // way, localWalk starts from the node's own nextNodeId.
        nodesToRender = localWalk(flow, sourceNodeId, interaction);
      } else {
        // No node was awaiting a reply — simulate a fresh session starting
        // at the flow's entry node, same as the engine would for a brand
        // new inbound message with no active session.
        const entry = flow.nodes.find((n) => n.id === flow.entryNodeId);
        nodesToRender = [entry];
      }
    }

    // A newer bootstrap() (or another advanceFrom) has already superseded
    // this one — discard the result rather than mutating a session that's
    // no longer current.
    if (sessionSeq.current !== mySeq) return [];

    setConnection(mode);
    nodesToRender.forEach((n) => pushBotNode(n));
    setSession((prev) => ({
      ...prev,
      currentSessionNode: nodesToRender.at(-1)?.id ?? prev.currentSessionNode,
      lastNodesToRender: nodesToRender.map((n) => n.id),
    }));
    setBusy(false);
    return nodesToRender;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, channel, call, pushBotNode]);

  const bootstrap = useCallback(() => {
    sessionSeq.current += 1; // supersede any in-flight advanceFrom from a previous session
    setMessages([]);
    setAnsweredIds(new Set());
    setInputValue("");
    const entry = flow.nodes.find((n) => n.id === flow.entryNodeId);
    if (!entry) return;
    setMessages([{ id: `${entry.id}_0`, role: "bot", node: entry, ts: Date.now() }]);
    setSession({
      currentSessionNode: entry.id,
      recipientPhone: chrome.identity,
      lastNodesToRender: [entry.id],
    });

    // A flow can legitimately *start* on a passthrough node — e.g. a
    // "Welcome!" text with waitForReply:false that's meant to fall straight
    // through to a menu. Previously bootstrap rendered only that first node
    // and stopped, since only sendInteraction() (a real user tap/reply) ever
    // called forward into the engine. That left the simulator looking
    // "stuck" on flows whose entry node isn't itself interactive. Mirror the
    // same auto-chaining the backend engine does for waitForReply:false
    // messages, right from the start.
    if (entry.type === "message" && entry.data.waitForReply === false && entry.data.nextNodeId) {
      advanceFrom(entry.id, null, chrome.identity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, chrome.identity, advanceFrom]);

  // Re-bootstrap whenever a *different* flow is handed in (e.g. you clicked
  // "Test bot" again after editing the graph in the builder) so the
  // simulator always reflects the latest saved edits, not a stale copy.
  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Given a message node whose messageType is 'list' (built either from a
  // real list.sections definition, OR — as with Flow Builder exports — a
  // simplified "interactive" message with no rows of its own) resolves the
  // selectable options to show. Builder-exported flows keep the real
  // options one hop downstream on the answer_branch node, so we look ahead.
  function getDisplayRows(node) {
    if (node.data.list?.sections) {
      return { rows: node.data.list.sections.flatMap((s) => s.rows), buttonLabel: node.data.list.buttonLabel };
    }
    const next = flow.nodes.find((n) => n.id === node.data.nextNodeId);
    if (next?.type === "answer_branch") {
      return {
        rows: next.data.branches.map((b) => ({ id: b.matchOptionId ?? b.id, title: b.label })),
        buttonLabel: "Options",
      };
    }
    return { rows: [], buttonLabel: "Options" };
  }

  // Shared send routine: both a tapped button/row AND a typed free-text
  // reply funnel through here, hitting the same backend contract.
  async function sendInteraction({ sourceNodeId, interaction, userLabel }) {
    if (sourceNodeId) setAnsweredIds((prev) => new Set(prev).add(sourceNodeId));
    setMessages((prev) => [...prev, { id: `user_${prev.length}`, role: "user", label: userLabel, ts: Date.now() }]);
    await advanceFrom(sourceNodeId, interaction, session.recipientPhone);
  }

  function handleSelect(sourceNodeId, selectedId, label) {
    return sendInteraction({ sourceNodeId, interaction: { type: "list_select", selectedId }, userLabel: label });
  }

  // Finds the most recent bot message that is still waiting on a reply
  // (an unanswered list/buttons node). Free text sent while one of those
  // is open routes through it, exactly like an unrecognized button click
  // would (-> defaultBranch / defaultNextNodeId). If nothing is waiting,
  // typed text is treated as a fresh trigger message.
  function getAwaitingNodeId() {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "bot") return null;
    const { node } = last;
    if (node.type !== "message") return null;
    if (!["list", "buttons"].includes(node.data.messageType)) return null;
    if (answeredIds.has(node.id)) return null;
    return node.id;
  }

  function handleSendText() {
    const text = inputValue.trim();
    if (!text || busy) return;
    setInputValue("");
    const sourceNodeId = getAwaitingNodeId();
    sendInteraction({ sourceNodeId, interaction: { type: "text", text }, userLabel: text });
  }

  async function handleReset() {
    setBusy(true);
    try {
      await call(RESET_PATH, {
        method: "POST",
        body: { recipientPhone: session.recipientPhone, playbookId: flow._id || flow.name, channel },
      });
      setToast("Session cleared on server");
    } catch {
      setToast("Server unreachable — cleared locally only");
    }
    bootstrap();
    setBusy(false);
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div
      className={density === "compact" ? "w-full h-full flex flex-col md:flex-row gap-2 p-2" : "w-full h-full flex flex-col md:flex-row gap-4 p-4"}
      style={{
        background: "#F5F2EB",
        fontFamily: "Inter, system-ui, sans-serif",
        // Fill whatever bounded height the page shell gives us (it does —
        // see channels/*/automation/page.jsx's flex-1 min-h-0 chain all the
        // way up). A fixed vh percentage here was the wrong tool: it either
        // overflows or (as reported) leaves the panel visibly short of the
        // real available space depending on how much chrome sits above it
        // on a given page. 100vh is just a last-resort ceiling in case this
        // component ever gets embedded somewhere that doesn't bound height
        // properly — it should never actually be the binding constraint.
        maxHeight: "100vh",
      }}
    >
      {/* LEFT: chat simulator */}
      <div
        className="w-full flex-1 min-h-0 md:flex-none md:h-full md:w-[400px] md:shrink-0 md:grow-0 flex flex-col rounded-2xl overflow-hidden shadow-lg border"
        style={{ borderColor: "#DED8C9" }}
      >
        <div className={`flex items-center gap-2.5 ${chrome.headerClassName} ${density === "compact" ? "px-3 py-2" : "px-4 py-3"}`} style={chrome.headerStyle}>
          {onBack && (
            <button onClick={onBack} className="text-white text-xs px-2 py-1 rounded-md" style={{ background: "rgba(0,0,0,0.18)" }}>
              ← Builder
            </button>
          )}
          <div
            className={density === "compact" ? "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" : "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"}
            style={chrome.avatarStyle}
          >
            AI
          </div>
          <div>
            <div className={density === "compact" ? "text-white text-xs font-semibold leading-tight" : "text-white text-sm font-semibold leading-tight"}>{chrome.botName}</div>
            {density === "compact" ? (
              <div className="text-[10px] leading-tight" style={{ color: chrome.identityColor }}>
                {session.recipientPhone}
              </div>
            ) : (
              <div className="text-[11px] leading-tight flex items-center gap-1" style={{ color: chrome.identityColor }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#3DDC84" }} />
                Active now · {session.recipientPhone}
              </div>
            )}
          </div>
        </div>

        <div
          ref={scrollRef}
          className={density === "compact" ? "flex-1 overflow-y-auto px-2 py-2" : "flex-1 overflow-y-auto px-3 py-4"}
          style={{ background: tokens.chatBg, backgroundImage: "radial-gradient(#00000008 1px, transparent 1px)", backgroundSize: "16px 16px" }}
        >
          {messages.map((m) => {
            if (m.role === "user") return <UserBubble key={m.id} density={density} timestamp={m.ts}>{m.label}</UserBubble>;
            const { node } = m;
            if (node.type === "handoff") return <HandoffBubble key={m.id} node={node} density={density} />;
            if (node.data.messageType === "text") return <TextMessage key={m.id} node={node} density={density} timestamp={m.ts} />;
            if (node.data.messageType === "document") return <DocumentMessage key={m.id} node={node} density={density} timestamp={m.ts} />;
            if (node.data.messageType === "buttons")
              return (
                <ButtonsMessage
                  key={m.id}
                  node={node}
                  answered={answeredIds.has(node.id)}
                  onSelect={(id, label) => handleSelect(node.id, id, label)}
                  density={density}
                  timestamp={m.ts}
                />
              );
            if (node.data.messageType === "list") {
              const { rows, buttonLabel } = getDisplayRows(node);
              return (
                <ListMessage
                  key={m.id}
                  node={node}
                  rows={rows}
                  buttonLabel={buttonLabel}
                  answered={answeredIds.has(node.id)}
                  onSelect={(id, label) => handleSelect(node.id, id, label)}
                  density={density}
                  timestamp={m.ts}
                />
              );
            }
            return null;
          })}
          {busy && (
            <div className={density === "compact" ? "flex justify-start mb-1" : "flex justify-start mb-2"}>
              <div
                className={density === "compact" ? "rounded-xl rounded-tl-sm px-2.5 py-1.5 text-[10px]" : "rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs"}
                style={{ background: tokens.chatBubbleBot, color: tokens.chatMeta }}
              >
                typing…
              </div>
            </div>
          )}
        </div>

        <div className={density === "compact" ? "px-2 py-1.5 flex items-center gap-1.5 border-t" : "px-3 py-2 flex items-center gap-2 border-t"} style={{ background: "#F0EDE3", borderColor: "#DED8C9" }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendText();
            }}
            disabled={busy}
            placeholder="Type a message… (free-text reply)"
            className={density === "compact" ? "flex-1 text-[11px] rounded-full px-2.5 py-1.5 outline-none disabled:opacity-60" : "flex-1 text-xs rounded-full px-3 py-2 outline-none disabled:opacity-60"}
            style={{ background: "#fff", color: tokens.chatText }}
          />
          <button
            onClick={handleSendText}
            disabled={busy || !inputValue.trim()}
            className={density === "compact" ? "w-6 h-6 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40" : "w-8 h-8 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"}
            style={{ background: "#128C7E" }}
          >
            <Send size={density === "compact" ? 12 : 14} color="#fff" />
          </button>
        </div>
      </div>

      {/* RIGHT: diagnostics console */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col rounded-2xl overflow-hidden shadow-lg" style={{ background: tokens.consoleBg }}>
        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: tokens.consoleBorder }}>
          <div className="flex items-center gap-2">
            {connection === "live" ? <Radio size={14} color={tokens.signal} /> : <WifiOff size={14} color={tokens.consoleMuted} />}
            <span className="text-sm font-semibold" style={{ color: tokens.consoleText }}>
              Engine Diagnostics
            </span>
          </div>
          <Pill tone={connection === "live" ? "live" : connection === "mock" ? "warn" : "muted"}>
            {connection === "live" ? "Live backend" : connection === "mock" ? "Mock fallback" : "Idle"}
          </Pill>
        </div>

        <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: tokens.consoleBorder }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tokens.consoleMuted }}>
            Session State
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
            <span style={{ color: tokens.consoleMuted }}>currentSessionNode</span>
            <span style={{ color: tokens.signal }}>{session.currentSessionNode}</span>
            <span style={{ color: tokens.consoleMuted }}>recipientPhone</span>
            <span style={{ color: tokens.consoleText }}>{session.recipientPhone}</span>
            <span style={{ color: tokens.consoleMuted }}>nodesToRender[]</span>
            <span style={{ color: tokens.consoleText }}>[{session.lastNodesToRender.join(", ") || "—"}]</span>
          </div>
        </div>

        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tokens.consoleMuted }}>
            Active Flow — {flow.name || "Untitled"}
          </div>
        </div>
        <div
          className="flex-1 overflow-auto mx-4 mb-3 rounded-lg p-3 text-[11px] leading-relaxed"
          style={{ background: tokens.consolePanel, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        >
          <pre dangerouslySetInnerHTML={{ __html: highlightJSON(flow) }} />
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-between gap-3" style={{ borderColor: tokens.consoleBorder }}>
          {toast ? (
            <span className="text-xs" style={{ color: tokens.consoleMuted }}>
              {toast}
            </span>
          ) : (
            <span />
          )}
          <button
            onClick={handleReset}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 disabled:opacity-40"
            style={{ background: tokens.danger, color: "#1A0E0C" }}
          >
            <RotateCcw size={13} />
            Reset Demo Session
          </button>
        </div>
      </div>
    </div>
  );
}
