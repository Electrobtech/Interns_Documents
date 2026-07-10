'use client';
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  ChevronLeft, Check, Plus, Trash2, ZoomIn, ZoomOut, Maximize2,
  Undo2, Redo2, Search, MessageSquare, GitBranch, Headset, FileText, X, Copy,
  Loader2, AlertCircle, Download,
} from "lucide-react";
import { apiUpload } from "@/lib/api";
import { getToken } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/* Document upload — client-side rules for the Message Node's
   "document" badge. Kept in sync with the server-side check in
   services/automation-service/src/controllers/mediaController.js.     */
/* ------------------------------------------------------------------ */
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_DOCUMENT_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/* Design tokens — light canvas (matches the reference builder's neutral
   workspace), colored node badges distinguish node "families" the same
   way the reference screenshot uses orange/green/blue icons.           */
/* ------------------------------------------------------------------ */
const tokens = {
  canvasBg: "#FAFAF9",
  dot: "#E4E1DA",
  card: "#FFFFFF",
  cardBorder: "#E7E4DD",
  text: "#26241F",
  muted: "#8A8578",
  line: "#C9C4B8",
  message: { bg: "#FEF3E2", fg: "#C2760B" },
  branch: { bg: "#E4F5EA", fg: "#1E8A4C" },
  handoff: { bg: "#E5F0FB", fg: "#1D6FC4" },
  accent: "#1D6FC4",
  danger: "#D9503F",
};

const NODE_WIDTH = 216;
const PILL_WIDTH = 132;
const PILL_HEIGHT = 30;
const PILL_GAP = 10;
const LEVEL_GAP = 64;
const MAX_BLOCKS = 75;

/* ------------------------------------------------------------------ */
/* Seed content — recreates the reference screenshot's shape (Greetings
   -> menu -> Track Order / Speak with a rep / Return Request -> nested
   Return/Replace branch) using our own copy and the 3 node types this
   version supports: message, answer_branch, handoff.                  */
/* ------------------------------------------------------------------ */
export function seedGraph() {
  const nodes = [
    { id: "n_greet", type: "message", position: { x: 620, y: 40 }, data: { messageType: "text", body: "Welcome! I'm here to help with your order.", waitForReply: false } },
    { id: "n_menu", type: "message", position: { x: 620, y: 190 }, data: { messageType: "interactive", body: "Choose from menu", waitForReply: true } },
    { id: "n_menu_branch", type: "answer_branch", position: { x: 620, y: 340 }, data: { branches: [
      { id: "b_track", label: "Track Order" },
      { id: "b_rep", label: "Speak with a rep" },
      { id: "b_return", label: "Return Request" },
    ] } },
    { id: "n_track", type: "message", position: { x: 300, y: 560 }, data: { messageType: "text", body: "Enter your order ID", waitForReply: true } },
    { id: "n_rep", type: "handoff", position: { x: 620, y: 560 }, data: { team: "Support Rep" } },
    { id: "n_return_branch", type: "answer_branch", position: { x: 900, y: 560 }, data: { branches: [
      { id: "b_return_item", label: "Return a product" },
      { id: "b_replace_item", label: "Replace a product" },
    ] } },
    { id: "n_return_collect", type: "message", position: { x: 760, y: 780 }, data: { messageType: "text", body: "Enter your order ID", waitForReply: true } },
    { id: "n_replace_collect", type: "message", position: { x: 1040, y: 780 }, data: { messageType: "text", body: "Enter your order ID", waitForReply: true } },
  ];
  const edges = [
    { id: "e1", sourceNodeId: "n_greet", sourceBranchId: null, targetNodeId: "n_menu" },
    { id: "e2", sourceNodeId: "n_menu", sourceBranchId: null, targetNodeId: "n_menu_branch" },
    { id: "e3", sourceNodeId: "n_menu_branch", sourceBranchId: "b_track", targetNodeId: "n_track" },
    { id: "e4", sourceNodeId: "n_menu_branch", sourceBranchId: "b_rep", targetNodeId: "n_rep" },
    { id: "e5", sourceNodeId: "n_menu_branch", sourceBranchId: "b_return", targetNodeId: "n_return_branch" },
    { id: "e6", sourceNodeId: "n_return_branch", sourceBranchId: "b_return_item", targetNodeId: "n_return_collect" },
    { id: "e7", sourceNodeId: "n_return_branch", sourceBranchId: "b_replace_item", targetNodeId: "n_replace_collect" },
  ];
  return { nodes, edges, entryNodeId: "n_greet" };
}

/* ------------------------------------------------------------------ */
/* Geometry helpers — every anchor is computed from node.position, never
   read from the DOM, so edges stay correct through pan/zoom/drag without
   layout thrashing. Card height is a fixed estimate (documented tradeoff:
   long body text can visually overflow the box; fine for a v1 tool).   */
/* ------------------------------------------------------------------ */
const CARD_HEIGHT = { message: 88, answer_branch: 56, handoff: 88 };

function topAnchor(node) {
  return { x: node.position.x + NODE_WIDTH / 2, y: node.position.y };
}
function bottomAnchor(node) {
  return { x: node.position.x + NODE_WIDTH / 2, y: node.position.y + CARD_HEIGHT[node.type] };
}
function branchPillRect(node, branchIndex) {
  const total = node.data.branches.length * PILL_WIDTH + (node.data.branches.length - 1) * PILL_GAP;
  const startX = node.position.x + NODE_WIDTH / 2 - total / 2;
  const x = startX + branchIndex * (PILL_WIDTH + PILL_GAP);
  const y = node.position.y + CARD_HEIGHT.answer_branch + 34;
  return { x, y, width: PILL_WIDTH, height: PILL_HEIGHT };
}
function branchBottomAnchor(node, branchIndex) {
  const r = branchPillRect(node, branchIndex);
  return { x: r.x + r.width / 2, y: r.y + r.height };
}
function branchTopAnchor(node, branchIndex) {
  const r = branchPillRect(node, branchIndex);
  return { x: r.x + r.width / 2, y: r.y };
}
function sourceAnchor(node, branchId) {
  if (node.type === "answer_branch" && branchId) {
    const idx = node.data.branches.findIndex((b) => b.id === branchId);
    return branchTopAnchor(node, idx); // pill's own top; bottom computed separately for the line start
  }
  return bottomAnchor(node);
}
function edgeStartAnchor(node, branchId) {
  if (node.type === "answer_branch" && branchId) {
    const idx = node.data.branches.findIndex((b) => b.id === branchId);
    return branchBottomAnchor(node, idx);
  }
  return bottomAnchor(node);
}
function bezierPath(a, b) {
  const midY = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */
function IconBadge({ tone, children }) {
  return (
    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: tone.bg, color: tone.fg }}>
      {children}
    </div>
  );
}

function EditableText({ value, onChange, className, placeholder, multiline }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  if (editing) {
    const Field = multiline ? "textarea" : "input";
    return (
      <Field
        autoFocus
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onChange(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !multiline) e.currentTarget.blur();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`${className} w-full outline-none border rounded px-1.5 py-1`}
        style={{ borderColor: tokens.accent, resize: multiline ? "vertical" : "none" }}
      />
    );
  }
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => setEditing(true)}
      className={`${className} cursor-text`}
      style={{ color: value ? tokens.text : tokens.muted }}
    >
      {value || placeholder}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Document upload field — replaces the old "type a filename" text box.
   Clicking anywhere on the pill opens the native file picker; the file is
   validated client-side (<=20MB) then uploaded via multipart/form-data to
   POST /automation/media/upload, which returns a public { url, filename }
   pair. That pair becomes node.data.document, matching the shape
   whatsappSender.js/buildSendTemplate() already expect (see
   src/schemas/flow-schema.md).                                        */
/* ------------------------------------------------------------------ */
function DocumentUploadField({ document, onChange }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | error
  const [error, setError] = useState("");

  const openPicker = (e) => {
    e.stopPropagation();
    inputRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (file.size > MAX_DOCUMENT_BYTES) {
      setStatus("error");
      setError(`"${file.name}" is ${formatBytes(file.size)} — max is 20 MB.`);
      return;
    }

    setStatus("uploading");
    setError("");
    try {
      const form = new FormData();
      form.append("document", file);
      const result = await apiUpload("/automation/media/upload", form, { token: getToken() });
      onChange({ url: result.url, filename: result.filename, sizeBytes: result.sizeBytes });
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err.message || "Upload failed. Try again.");
    }
  };

  const clearFile = (e) => {
    e.stopPropagation();
    onChange(null);
    setStatus("idle");
    setError("");
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_DOCUMENT_TYPES}
        onChange={handleFile}
        onMouseDown={(e) => e.stopPropagation()}
        className="hidden"
      />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={openPicker}
        role="button"
        tabIndex={0}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 cursor-pointer hover:opacity-80"
        style={{ background: "#F4F1EA" }}
      >
        {status === "uploading" ? (
          <Loader2 size={13} className="animate-spin" color={tokens.muted} />
        ) : status === "error" ? (
          <AlertCircle size={13} color={tokens.danger} />
        ) : (
          <FileText size={13} color={tokens.danger} />
        )}
        <span
          className="text-[11px] flex-1 truncate"
          style={{ color: document?.filename ? tokens.text : tokens.muted }}
        >
          {status === "uploading"
            ? "Uploading…"
            : document?.filename || "filename.pdf"}
        </span>
        {document?.sizeBytes ? (
          <span className="text-[9px] shrink-0" style={{ color: tokens.muted }}>
            {formatBytes(document.sizeBytes)}
          </span>
        ) : null}
        {document?.url && status !== "uploading" && (
          <a
            href={document.url}
            download={document.filename}
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            title="Download file"
            style={{ color: tokens.muted }}
          >
            <Download size={12} />
          </a>
        )}
        {document?.filename && status !== "uploading" && (
          <button onMouseDown={(e) => e.stopPropagation()} onClick={clearFile} style={{ color: tokens.muted }}>
            <X size={12} />
          </button>
        )}
      </div>
      {status === "error" && (
        <div className="text-[9px] mt-1" style={{ color: tokens.danger }}>
          {error}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Node card renderer — dispatches by type                             */
/* ------------------------------------------------------------------ */
function NodeCard({ node, selected, onMouseDownDrag, onUpdate, onDelete, onStartConnect, onAddBranch, onRemoveBranch }) {
  const header =
    node.type === "message" ? { icon: <MessageSquare size={13} />, tone: tokens.message, label: "Message" }
    : node.type === "answer_branch" ? { icon: <GitBranch size={13} />, tone: tokens.branch, label: "Conditional Branching" }
    : { icon: <Headset size={13} />, tone: tokens.handoff, label: "Handoff" };

  return (
    <div
      className="absolute rounded-xl shadow-sm border group"
      style={{
        left: node.position.x, top: node.position.y, width: NODE_WIDTH,
        background: tokens.card, borderColor: selected ? tokens.accent : tokens.cardBorder,
        borderWidth: selected ? 2 : 1,
      }}
    >
      {/* input handle (top) */}
      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 bg-white" style={{ borderColor: tokens.line }} />

      <div
        onMouseDown={onMouseDownDrag}
        className="flex items-center gap-2 px-2.5 py-2 border-b cursor-grab active:cursor-grabbing"
        style={{ borderColor: tokens.cardBorder }}
      >
        <IconBadge tone={header.tone}>{header.icon}</IconBadge>
        <span className="text-xs font-medium flex-1 truncate">{header.label}</span>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition"
          style={{ color: tokens.muted }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="px-2.5 py-2">
        {node.type === "message" && (
          <>
            <div className="flex gap-1 mb-1.5">
              {["text", "interactive", "document"].map((mt) => (
                <button
                  key={mt}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => onUpdate({ ...node.data, messageType: mt })}
                  className="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-semibold"
                  style={{
                    background: node.data.messageType === mt ? tokens.message.bg : "transparent",
                    color: node.data.messageType === mt ? tokens.message.fg : tokens.muted,
                    border: `1px solid ${node.data.messageType === mt ? tokens.message.fg : tokens.cardBorder}`,
                  }}
                >
                  {mt}
                </button>
              ))}
            </div>
            {node.data.messageType === "document" ? (
              <DocumentUploadField
                document={node.data.document}
                onChange={(doc) => onUpdate({ ...node.data, document: doc })}
              />
            ) : (
              <EditableText
                value={node.data.body}
                placeholder="Message text…"
                multiline
                className="text-[11px] leading-snug"
                onChange={(v) => onUpdate({ ...node.data, body: v })}
              />
            )}
            {node.data.messageType === "interactive" && (
              <div className="mt-1.5 text-[10px] font-semibold text-center rounded-full py-1" style={{ background: tokens.message.fg, color: "#fff" }}>
                Options ⌄
              </div>
            )}
          </>
        )}

        {node.type === "handoff" && (
          <EditableText
            value={node.data.team}
            placeholder="Team name…"
            className="text-[11px]"
            onChange={(v) => onUpdate({ ...node.data, team: v })}
          />
        )}

        {node.type === "answer_branch" && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onAddBranch}
            className="w-full flex items-center justify-center gap-1 text-[10px] font-semibold rounded-md py-1"
            style={{ color: tokens.branch.fg, border: `1px dashed ${tokens.branch.fg}` }}
          >
            <Plus size={11} /> Add branch
          </button>
        )}
      </div>

      {/* output handle for single-output types */}
      {node.type !== "answer_branch" && node.type !== "handoff" && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartConnect(node.id, null, bottomAnchor(node));
          }}
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 bg-white cursor-crosshair"
          style={{ borderColor: tokens.accent }}
        />
      )}

      {node.type === "answer_branch" &&
        node.data.branches.map((branch, i) => {
          const rect = branchPillRect(node, i);
          return (
            <div
              key={branch.id}
              className="absolute rounded-lg border shadow-sm flex items-center gap-1 px-2"
              style={{ left: rect.x - node.position.x, top: rect.y - node.position.y, width: rect.width, height: rect.height, background: "#fff", borderColor: tokens.cardBorder }}
            >
              <EditableText value={branch.label} className="text-[10px] flex-1 truncate" onChange={(v) => onUpdate({ ...node.data, branches: node.data.branches.map((b) => (b.id === branch.id ? { ...b, label: v } : b)) })} />
              <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onRemoveBranch(branch.id)} style={{ color: tokens.muted }}>
                <X size={10} />
              </button>
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onStartConnect(node.id, branch.id, branchBottomAnchor(node, i));
                }}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-white cursor-crosshair"
                style={{ borderColor: tokens.accent }}
              />
            </div>
          );
        })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add-node popover shown at an open output anchor                     */
/* ------------------------------------------------------------------ */
function AddNodePopover({ anchor, onPick, onClose }) {
  const options = [
    { type: "message", label: "Message", icon: <MessageSquare size={13} />, tone: tokens.message },
    { type: "answer_branch", label: "Conditional Branch", icon: <GitBranch size={13} />, tone: tokens.branch },
    { type: "handoff", label: "Handoff", icon: <Headset size={13} />, tone: tokens.handoff },
  ];
  return (
    <div
      className="absolute z-20 rounded-lg shadow-lg border p-1 flex flex-col gap-0.5"
      style={{ left: anchor.x - 90, top: anchor.y + 14, width: 180, background: "#fff", borderColor: tokens.cardBorder }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {options.map((opt) => (
        <button key={opt.type} onClick={() => onPick(opt.type)} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-black/5 text-left">
          <IconBadge tone={opt.tone}>{opt.icon}</IconBadge>
          {opt.label}
        </button>
      ))}
      <button onClick={onClose} className="text-[10px] mt-0.5 py-1 rounded-md" style={{ color: tokens.muted }}>
        Cancel
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Export — converts canvas state into flow-schema-compatible JSON     */
/* (see schemas/flow-schema.md: message / answer_branch / handoff).    */
/* ------------------------------------------------------------------ */
export function exportFlowJson(graph, title) {
  const nodes = graph.nodes.map((n) => {
    if (n.type === "message") {
      const edge = graph.edges.find((e) => e.sourceNodeId === n.id);
      return {
        id: n.id, type: "message", position: n.position,
        data: {
          messageType: n.data.messageType === "interactive" ? "list" : n.data.messageType,
          body: n.data.body,
          document: n.data.document,
          waitForReply: n.data.messageType === "interactive",
          nextNodeId: edge?.targetNodeId ?? null,
        },
      };
    }
    if (n.type === "answer_branch") {
      return {
        id: n.id, type: "answer_branch", position: n.position,
        data: {
          branches: n.data.branches.map((b) => ({
            id: b.id, label: b.label, matchOptionId: b.id,
            nextNodeId: graph.edges.find((e) => e.sourceNodeId === n.id && e.sourceBranchId === b.id)?.targetNodeId ?? null,
          })),
          defaultBranch: { label: "Default condition", nextNodeId: null },
        },
      };
    }
    return { id: n.id, type: "handoff", position: n.position, data: { team: n.data.team, nextNodeId: null } };
  });

  return { name: title, entryNodeId: graph.entryNodeId, nodes };
}

/* ------------------------------------------------------------------ */
/* Root component                                                      */
/* ------------------------------------------------------------------ */
export default function FlowBuilder({ initialGraph, initialTitle, onGraphChange, onTitleChange, onTestBot }) {
  const [graph, setGraph] = useState(initialGraph || seedGraph);
  const [title, setTitleState] = useState(initialTitle || "WEB — Ecommerce Customer Support");
  const [viewport, setViewport] = useState({ x: -200, y: -10, zoom: 0.85 });
  const [dragState, setDragState] = useState(null); // { nodeId, offsetX, offsetY }
  const [connectState, setConnectState] = useState(null); // { sourceNodeId, sourceBranchId, start, current }
  const [panState, setPanState] = useState(null); // { startX, startY, originX, originY }
  const [popover, setPopover] = useState(null); // { sourceNodeId, sourceBranchId, anchor }
  const [selectedId, setSelectedId] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [saveTick, setSaveTick] = useState(0);
  const [history, setHistory] = useState([initialGraph || seedGraph()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const containerRef = useRef(null);

  // Held-spacebar pan mode (Figma/Miro convention): while Space is down, a
  // left-click-drag anywhere — including on top of a node — pans the canvas
  // instead of dragging that node or starting a connection. Tracked as state
  // (not a ref) since it needs to affect the cursor style and the capture-
  // phase pointerdown handler below on every render.
  const [spacePressed, setSpacePressed] = useState(false);
  useEffect(() => {
    function isTypingTarget(el) {
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    }
    function onKeyDown(e) {
      if (e.code === "Space" && !isTypingTarget(e.target)) {
        e.preventDefault(); // stop the page itself from scrolling on Space
        setSpacePressed(true);
      }
    }
    function onKeyUp(e) {
      if (e.code === "Space") setSpacePressed(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  function setTitle(next) {
    setTitleState(next);
    onTitleChange?.(next);
  }

  const commit = useCallback((next) => {
    setGraph(next);
    onGraphChange?.(next);
    setHistory((h) => [...h.slice(0, historyIndex + 1), next]);
    setHistoryIndex((i) => i + 1);
    setSaveTick((t) => t + 1);
  }, [historyIndex, onGraphChange]);

  function undo() {
    if (historyIndex === 0) return;
    setHistoryIndex((i) => i - 1);
    setGraph(history[historyIndex - 1]);
  }
  function redo() {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex((i) => i + 1);
    setGraph(history[historyIndex + 1]);
  }

  const screenToWorld = useCallback(
    (screenX, screenY) => {
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left - viewport.x) / viewport.zoom,
        y: (screenY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  /* ---- node dragging ---- */
  function startDragNode(e, node) {
    if (spacePressed) return; // Space-drag pans through nodes instead of moving them
    setSelectedId(node.id);
    const world = screenToWorld(e.clientX, e.clientY);
    setDragState({ nodeId: node.id, offsetX: world.x - node.position.x, offsetY: world.y - node.position.y });
  }

  /* ---- canvas panning ----
     Three ways to pan, matching Figma/Miro/React-Flow conventions:
       1. Left-click-drag on empty canvas background (original behavior).
       2. Middle-click or right-click drag, from anywhere — including on top
          of nodes — handled by the capture-phase handler below so it wins
          before a node's own onMouseDown (drag / connect) can fire.
       3. Space + left-click-drag, also from anywhere — same capture-phase
          handler, gated on `spacePressed`.
     All three converge on the same origin-based panState, so there's one
     code path (in the mousemove/mouseup effect below) that determines feel —
     no drift, no jump on release. */
  function startPan(e) {
    if (e.target !== e.currentTarget) return;
    setSelectedId(null);
    setPanState({ startX: e.clientX, startY: e.clientY, originX: viewport.x, originY: viewport.y });
  }

  // Runs before any child node's onMouseDown (capture phase fires top-down),
  // which is what lets middle/right-click and Space-drag pan through nodes
  // instead of dragging or connecting them.
  function handlePointerDownCapture(e) {
    const isMiddleClick = e.button === 1;
    const isRightClick = e.button === 2;
    const isSpaceDrag = spacePressed && e.button === 0;
    if (isMiddleClick || isRightClick || isSpaceDrag) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedId(null);
      setPanState({ startX: e.clientX, startY: e.clientY, originX: viewport.x, originY: viewport.y });
    }
  }

  /* ---- connection dragging ---- */
  function startConnect(sourceNodeId, sourceBranchId, startAnchor) {
    setConnectState({ sourceNodeId, sourceBranchId, start: startAnchor, current: startAnchor });
  }

  useEffect(() => {
    function onMove(e) {
      if (dragState) {
        const world = screenToWorld(e.clientX, e.clientY);
        setGraph((g) => ({
          ...g,
          nodes: g.nodes.map((n) => (n.id === dragState.nodeId ? { ...n, position: { x: world.x - dragState.offsetX, y: world.y - dragState.offsetY } } : n)),
        }));
      }
      if (panState) {
        setViewport((v) => ({ ...v, x: panState.originX + (e.clientX - panState.startX), y: panState.originY + (e.clientY - panState.startY) }));
      }
      if (connectState) {
        const world = screenToWorld(e.clientX, e.clientY);
        setConnectState((c) => ({ ...c, current: world }));
      }
    }
    function onUp(e) {
      if (dragState) {
        commit(graph);
        setDragState(null);
      }
      if (panState) setPanState(null);
      if (connectState) {
        const world = screenToWorld(e.clientX, e.clientY);
        // Hit-test: is the drop point near the top-anchor region of any node?
        const target = graph.nodes.find((n) => {
          if (n.id === connectState.sourceNodeId) return false;
          const t = topAnchor(n);
          return Math.abs(world.x - t.x) < NODE_WIDTH / 2 && world.y > t.y - 20 && world.y < t.y + 40;
        });
        if (target) {
          const filtered = graph.edges.filter((ed) => !(ed.sourceNodeId === connectState.sourceNodeId && ed.sourceBranchId === connectState.sourceBranchId));
          commit({ ...graph, edges: [...filtered, { id: `e_${Date.now()}`, sourceNodeId: connectState.sourceNodeId, sourceBranchId: connectState.sourceBranchId, targetNodeId: target.id }] });
        }
        setConnectState(null);
      }
    }
    if (dragState || panState || connectState) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, panState, connectState, graph]);

  // Mouse-centered zoom: given a target zoom and the screen point that
  // should stay anchored under the cursor, solve for the viewport offset so
  // the world coordinate currently under that point doesn't visibly move.
  const applyZoom = useCallback((nextZoomRaw, anchorScreenX, anchorScreenY) => {
    const nextZoom = Math.min(1.6, Math.max(0.4, nextZoomRaw));
    setViewport((v) => {
      if (nextZoom === v.zoom) return v;
      const worldX = (anchorScreenX - v.x) / v.zoom;
      const worldY = (anchorScreenY - v.y) / v.zoom;
      return { zoom: nextZoom, x: anchorScreenX - worldX * nextZoom, y: anchorScreenY - worldY * nextZoom };
    });
  }, []);

  // Figma/Miro/React-Flow convention: plain wheel or two-finger trackpad
  // scroll pans the canvas; Ctrl/Cmd+scroll — which is also how Chrome,
  // Firefox, and Safari all report trackpad pinch gestures — zooms, centered
  // on the cursor instead of jumping to the top-left corner.
  function onWheel(e) {
    e.preventDefault();
    const isZoomGesture = e.ctrlKey || e.metaKey;
    if (isZoomGesture) {
      const rect = containerRef.current.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const anchorY = e.clientY - rect.top;
      // Exponential falloff keeps zoom speed feeling consistent whether the
      // device reports small smooth deltas (trackpad) or large notched ones
      // (mouse wheel), unlike a fixed +/- step.
      const nextZoom = viewport.zoom * Math.exp(-e.deltaY * 0.01);
      applyZoom(nextZoom, anchorX, anchorY);
    } else {
      setViewport((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    }
  }

  function updateNodeData(nodeId, data) {
    commit({ ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, data } : n)) });
  }

  function deleteNode(nodeId) {
    commit({
      ...graph,
      nodes: graph.nodes.filter((n) => n.id !== nodeId),
      edges: graph.edges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId),
    });
  }

  function addBranch(nodeId) {
    commit({
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, branches: [...n.data.branches, { id: `b_${Date.now()}`, label: "New branch" }] } } : n)),
    });
  }

  function removeBranch(nodeId, branchId) {
    commit({
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, branches: n.data.branches.filter((b) => b.id !== branchId) } } : n)),
      edges: graph.edges.filter((e) => !(e.sourceNodeId === nodeId && e.sourceBranchId === branchId)),
    });
  }

  function addNodeFromPopover(type) {
    const id = `n_${Date.now()}`;
    const anchor = popover.anchor;
    const newNode = {
      id, type,
      position: { x: anchor.x - NODE_WIDTH / 2, y: anchor.y + LEVEL_GAP },
      data:
        type === "message" ? { messageType: "text", body: "New message", waitForReply: false }
        : type === "answer_branch" ? { branches: [{ id: `b_${Date.now()}`, label: "Option A" }] }
        : { team: "New team" },
    };
    commit({
      ...graph,
      nodes: [...graph.nodes, newNode],
      edges: [...graph.edges, { id: `e_${Date.now()}`, sourceNodeId: popover.sourceNodeId, sourceBranchId: popover.sourceBranchId, targetNodeId: id }],
    });
    setPopover(null);
  }

  function fitView() {
    if (!graph.nodes.length) return;
    const xs = graph.nodes.map((n) => n.position.x);
    const ys = graph.nodes.map((n) => n.position.y);
    setViewport({ x: -Math.min(...xs) + 60, y: -Math.min(...ys) + 60, zoom: 0.8 });
  }

  const openOutputs = useMemo(() => {
    const list = [];
    graph.nodes.forEach((n) => {
      if (n.type === "answer_branch") {
        n.data.branches.forEach((b, i) => {
          const hasEdge = graph.edges.some((e) => e.sourceNodeId === n.id && e.sourceBranchId === b.id);
          if (!hasEdge) list.push({ sourceNodeId: n.id, sourceBranchId: b.id, anchor: branchBottomAnchor(n, i) });
        });
      } else if (n.type === "message") {
        const hasEdge = graph.edges.some((e) => e.sourceNodeId === n.id);
        if (!hasEdge) list.push({ sourceNodeId: n.id, sourceBranchId: null, anchor: bottomAnchor(n) });
      }
    });
    return list;
  }, [graph]);

  const exported = useMemo(() => exportFlowJson(graph, title), [graph, title]);

  return (
    <div className="w-full h-full min-h-[680px] flex flex-col" style={{ fontFamily: "Inter, system-ui, sans-serif", background: "#fff" }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: tokens.cardBorder }}>
        <button className="flex items-center gap-1 text-sm" style={{ color: tokens.muted }}>
          <ChevronLeft size={15} /> Back
        </button>
        <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: "#EAF7EE", color: "#1E8A4C" }}>
          <Check size={11} /> Saved
        </div>
        <div className="flex-1 flex justify-center">
          <EditableText value={title} onChange={setTitle} className="text-sm font-semibold text-center" placeholder="Untitled playbook" />
        </div>
        <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#F2F0EA", color: tokens.muted }}>
          Blocks: {graph.nodes.length}/{MAX_BLOCKS}
        </span>
        <button
          onClick={() => onTestBot?.()}
          className="text-xs font-semibold rounded-lg px-3.5 py-1.5 border"
          style={{ borderColor: tokens.cardBorder, color: tokens.text }}
        >
          Test bot
        </button>
        <button
          onClick={() => setShowExport(true)}
          className="text-xs font-semibold rounded-lg px-3.5 py-1.5"
          style={{ background: tokens.accent, color: "#fff" }}
        >
          Deploy
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        onMouseDownCapture={handlePointerDownCapture}
        onMouseDown={startPan}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="flex-1 relative overflow-hidden"
        style={{
          background: tokens.canvasBg,
          backgroundImage: `radial-gradient(${tokens.dot} 1.5px, transparent 1.5px)`,
          backgroundSize: "22px 22px",
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          cursor: panState ? "grabbing" : "grab",
          // Let onWheel own trackpad pinch/two-finger-scroll gestures instead
          // of the browser's native page-zoom/overscroll handling them.
          touchAction: "none",
          overscrollBehavior: "contain",
        }}
      >
        <div
          className="absolute"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          {/* edges */}
          <svg width="3000" height="2000" className="absolute pointer-events-none" style={{ overflow: "visible" }}>
            {graph.edges.map((e) => {
              const source = graph.nodes.find((n) => n.id === e.sourceNodeId);
              const target = graph.nodes.find((n) => n.id === e.targetNodeId);
              if (!source || !target) return null;
              const a = edgeStartAnchor(source, e.sourceBranchId);
              const b = topAnchor(target);
              return <path key={e.id} d={bezierPath(a, b)} stroke={tokens.line} strokeWidth={1.5} fill="none" />;
            })}
            {connectState && <path d={bezierPath(connectState.start, connectState.current)} stroke={tokens.accent} strokeWidth={1.5} fill="none" strokeDasharray="4 3" />}
          </svg>

          {/* nodes */}
          {graph.nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              selected={selectedId === node.id}
              onMouseDownDrag={(e) => startDragNode(e, node)}
              onUpdate={(data) => updateNodeData(node.id, data)}
              onDelete={() => deleteNode(node.id)}
              onStartConnect={(nodeId, branchId, anchor) => startConnect(nodeId, branchId, anchor)}
              onAddBranch={() => addBranch(node.id)}
              onRemoveBranch={(branchId) => removeBranch(node.id, branchId)}
            />
          ))}

          {/* open-output "+" buttons */}
          {openOutputs.map((o) => (
            <button
              key={`${o.sourceNodeId}_${o.sourceBranchId ?? "single"}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setPopover(o)}
              className="absolute w-5 h-5 rounded-full flex items-center justify-center shadow"
              style={{ left: o.anchor.x - 10, top: o.anchor.y + 8, background: "#fff", border: `1px solid ${tokens.line}`, color: tokens.muted }}
            >
              <Plus size={11} />
            </button>
          ))}

          {popover && <AddNodePopover anchor={popover.anchor} onPick={addNodeFromPopover} onClose={() => setPopover(null)} />}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-center gap-1 px-3 py-2 border-t" style={{ borderColor: tokens.cardBorder }}>
        <ToolbarBtn onClick={() => {}}><Search size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={undo} disabled={historyIndex === 0}><Undo2 size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={redo} disabled={historyIndex >= history.length - 1}><Redo2 size={14} /></ToolbarBtn>
        <ToolbarBtn
          onClick={() => {
            const rect = containerRef.current.getBoundingClientRect();
            applyZoom(viewport.zoom - 0.1, rect.width / 2, rect.height / 2);
          }}
        >
          <ZoomOut size={14} />
        </ToolbarBtn>
        <span className="text-[11px] w-9 text-center" style={{ color: tokens.muted }}>{Math.round(viewport.zoom * 100)}%</span>
        <ToolbarBtn
          onClick={() => {
            const rect = containerRef.current.getBoundingClientRect();
            applyZoom(viewport.zoom + 0.1, rect.width / 2, rect.height / 2);
          }}
        >
          <ZoomIn size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={fitView}><Maximize2 size={14} /></ToolbarBtn>
      </div>

      {/* Export / Deploy panel */}
      {showExport && (
        <div className="absolute inset-0 flex justify-end" style={{ background: "#00000040" }} onClick={() => setShowExport(false)}>
          <div className="w-[480px] h-full bg-white flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: tokens.cardBorder }}>
              <span className="text-sm font-semibold">Flow JSON — ready to POST to Playbook API</span>
              <button onClick={() => setShowExport(false)}><X size={16} /></button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[11px]" style={{ fontFamily: "ui-monospace, monospace", color: tokens.text }}>
              {JSON.stringify(exported, null, 2)}
            </pre>
            <div className="p-3 border-t" style={{ borderColor: tokens.cardBorder }}>
              <button
                onClick={() => navigator.clipboard?.writeText(JSON.stringify(exported, null, 2))}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg py-2"
                style={{ background: tokens.accent, color: "#fff" }}
              >
                <Copy size={13} /> Copy JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30"
      style={{ color: tokens.muted }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#F2F0EA")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}