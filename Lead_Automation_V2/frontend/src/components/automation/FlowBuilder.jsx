'use client';
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Search,
  MessageSquare,
  GitBranch,
  Headset,
  FileText,
  X,
  Copy,
  Loader2,
  AlertCircle,
  Download,
  CloudOff,
  Play,
  Pause,
  Clock,
} from "lucide-react";
import { apiUpload } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { DateTimePicker } from "@/components/calendar/DateTimePicker";


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
  delay: { bg: "#F3E8FD", fg: "#8B3FD1" },
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
/* Seed content — ElectroBtech Innovations' internship/training intake
   flow (Kickstart Your Career -> opportunity type menu -> Final Year
   Projects / Internships / Domain Specific Training, all funneling into
   a shared domain-preference menu -> AI & ML / Full Stack Development /
   Embedded Systems, all funneling into a shared thank-you close). This
   is what a brand-new laptop sees before its first Deploy — kept in
   sync with services/automation-service/src/seeds/whatsapp-default-flow.json
   (the same flow, in flow-schema shape, loaded into Postgres by
   `npm run seed` so the *engine* — not just this Builder screen — also
   treats it as the active WhatsApp default on a fresh database).       */
/* ------------------------------------------------------------------ */
export function seedGraph() {
  const nodes = [
    { id: "n_welcome", type: "message", position: { x: 620, y: 40 }, data: {
      messageType: "text",
      body: "🚀 🎓 Kickstart Your Career with ElectroBtech Innovations Pvt. Ltd.!\n\nAre you ready to begin your professional journey with a company that values innovation, learning, and real-world experience?\n\nElectroBtech Innovations Pvt. Ltd. is committed to nurturing young talent by providing opportunities to work on cutting-edge technologies, live industry projects, and innovative software solutions. Our team focuses on delivering high-quality technology products while creating an environment where interns and fresh graduates can enhance their technical skills, collaborate with experienced professionals, and gain practical exposure to modern development practices.",
      waitForReply: false,
    } },
    { id: "n_menu1", type: "message", position: { x: 620, y: 200 }, data: {
      messageType: "interactive",
      body: "📣 Exciting opportunities are now open!\n\nChoose the one you are looking for :",
      waitForReply: true,
    } },
    { id: "n_branch1", type: "answer_branch", position: { x: 620, y: 360 }, data: { branches: [
      { id: "b_final_year", label: "Final Year Projects" },
      { id: "b_internships", label: "Internships" },
      { id: "b_domain_training", label: "Domain Specific Training" },
    ] } },
    { id: "n_domain_menu", type: "message", position: { x: 620, y: 520 }, data: {
      messageType: "interactive",
      body: "Choose your preferred domain",
      waitForReply: true,
    } },
    { id: "n_branch2", type: "answer_branch", position: { x: 620, y: 680 }, data: { branches: [
      { id: "b_ai_ml", label: "AI & ML" },
      { id: "b_fullstack", label: "Full stack Development" },
      { id: "b_embedded", label: "Embedded Systems" },
    ] } },
    { id: "n_thankyou", type: "message", position: { x: 620, y: 840 }, data: {
      messageType: "text",
      body: "Thank you for your interest in *ElectroBtech Innovations Pvt. Ltd.*\n\nWe have received your inquiry. Our team will contact you shortly with more information. In the meantime, please feel free to go through the attached guidelines. If you have any questions, don't hesitate to reach out.\n\nWe look forward to connecting with you!\n\n*Team ElectroBtech Innovations Pvt. Ltd.*",
      waitForReply: false,
    } },
  ];
  const edges = [
    { id: "e1", sourceNodeId: "n_welcome", sourceBranchId: null, targetNodeId: "n_menu1" },
    { id: "e2", sourceNodeId: "n_menu1", sourceBranchId: null, targetNodeId: "n_branch1" },
    { id: "e3", sourceNodeId: "n_branch1", sourceBranchId: "b_final_year", targetNodeId: "n_domain_menu" },
    { id: "e4", sourceNodeId: "n_branch1", sourceBranchId: "b_internships", targetNodeId: "n_domain_menu" },
    { id: "e5", sourceNodeId: "n_branch1", sourceBranchId: "b_domain_training", targetNodeId: "n_domain_menu" },
    { id: "e6", sourceNodeId: "n_domain_menu", sourceBranchId: null, targetNodeId: "n_branch2" },
    { id: "e7", sourceNodeId: "n_branch2", sourceBranchId: "b_ai_ml", targetNodeId: "n_thankyou" },
    { id: "e8", sourceNodeId: "n_branch2", sourceBranchId: "b_fullstack", targetNodeId: "n_thankyou" },
    { id: "e9", sourceNodeId: "n_branch2", sourceBranchId: "b_embedded", targetNodeId: "n_thankyou" },
  ];
  return { nodes, edges, entryNodeId: "n_welcome" };
}

/* ------------------------------------------------------------------ */
/* Geometry helpers — every anchor is computed from node.position, never
   read from the DOM, so edges stay correct through pan/zoom/drag without
   layout thrashing. Card height is a fixed estimate (documented tradeoff:
   long body text can visually overflow the box; fine for a v1 tool).   */
/* ------------------------------------------------------------------ */
const CARD_HEIGHT = { message: 88, answer_branch: 56, handoff: 112, delay: 118 };

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
      className={`${className} cursor-text ${multiline ? "whitespace-pre-wrap" : ""}`}
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
/* Save-status pill — reflects PlaybookStudioApp's real autosave state
   against Postgres (see playbookController.js) instead of a hardcoded
   "Saved" label that was always true even when nothing was persisted.    */
/* ------------------------------------------------------------------ */
function SyncStatusPill({ status }) {
  const config = {
    loading: { icon: <Loader2 size={11} className="animate-spin" />, label: "Loading…", bg: "#F2F0EA", fg: tokens.muted },
    saving: { icon: <Loader2 size={11} className="animate-spin" />, label: "Saving…", bg: "#F2F0EA", fg: tokens.muted },
    saved: { icon: <Check size={11} />, label: "Saved", bg: "#EAF7EE", fg: "#1E8A4C" },
    offline: { icon: <CloudOff size={11} />, label: "Saved locally — will retry", bg: "#FDF1E9", fg: "#C2760B" },
    error: { icon: <AlertCircle size={11} />, label: "Save failed", bg: "#FBEAE7", fg: tokens.danger },
  }[status] || { icon: <Check size={11} />, label: "Saved", bg: "#EAF7EE", fg: "#1E8A4C" };

  return (
    <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full shrink-0" style={{ background: config.bg, color: config.fg }}>
      {config.icon} {config.label}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Node card renderer — dispatches by type                             */
/* ------------------------------------------------------------------ */
function NodeCard({ node, selected, isEntry, onSetEntry, onMouseDownDrag, onUpdate, onDelete, onStartConnect, onAddBranch, onRemoveBranch }) {
  const header =
    node.type === "message" ? { icon: <MessageSquare size={13} />, tone: tokens.message, label: "Message" }
    : node.type === "answer_branch" ? { icon: <GitBranch size={13} />, tone: tokens.branch, label: "Conditional Branching" }
    : node.type === "delay" ? { icon: <Clock size={13} />, tone: tokens.delay, label: "Delay" }
    : { icon: <Headset size={13} />, tone: tokens.handoff, label: "Handoff" };

  return (
    <div
      className="absolute rounded-xl shadow-sm border group"
      style={{
        left: node.position.x, top: node.position.y, width: NODE_WIDTH,
        background: tokens.card, borderColor: selected ? tokens.accent : (isEntry ? tokens.accent : tokens.cardBorder),
        borderWidth: selected || isEntry ? 2 : 1,
      }}
    >
      {/* Every playbook needs exactly one of these — it's the node
          evaluateWorkflowStep() starts a brand-new conversation at. Shown on
          every card so it's obvious at a glance which one is live, since
          canvas position/order has no bearing on where the engine actually
          begins (only entryNodeId does). */}
      {isEntry ? (
        <div
          className="absolute -top-2.5 left-2 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full flex items-center gap-1"
          style={{ background: tokens.accent, color: "#fff" }}
        >
          <Play size={9} fill="#fff" /> Start
        </div>
      ) : (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onSetEntry}
          title="Make this the node a brand-new conversation starts at"
          className="absolute -top-2.5 left-2 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition"
          style={{ background: "#fff", border: `1px solid ${tokens.cardBorder}`, color: tokens.muted }}
        >
          Set as start
        </button>
      )}

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
          <>
            <EditableText
              value={node.data.team}
              placeholder="Team name…"
              className="text-[11px]"
              onChange={(v) => onUpdate({ ...node.data, team: v })}
            />
            <HandoffFollowUpEditor
              followUp={node.data.followUp}
              onChange={(followUp) => onUpdate({ ...node.data, followUp })}
            />
          </>
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

        {node.type === "delay" && (
          <DelayNodeEditor data={node.data} onUpdate={onUpdate} />
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
/* Delay node editor — toggle between a relative wait ("3 days") and an
   absolute date/time (via the shared DateTimePicker, same component used
   by the campaigns "Schedule send" field and the contacts "Book a
   meeting" dialog). Only one of data.seconds / data.scheduledAt is kept —
   switching modes clears the other so exportFlowJson never has to guess
   which one currently applies. See workflowEngine.js's
   scheduleDelayedContinuation() for how the engine consumes this.        */
/* ------------------------------------------------------------------ */
const DELAY_UNITS = [
  { key: "minutes", label: "min", seconds: 60 },
  { key: "hours", label: "hrs", seconds: 3600 },
  { key: "days", label: "days", seconds: 86400 },
];

const FOLLOW_UP_DUE_PRESETS = [
  { key: "24", label: "24h" },
  { key: "48", label: "48h" },
  { key: "72", label: "72h" },
];
const FOLLOW_UP_PRIORITIES = ["low", "medium", "high"];

/**
 * Compact config block for the Handoff node's card: enable/disable
 * auto-creating a Follow-ups queue reminder (see the Follow-ups page,
 * services/automation-service/src/repositories/followUpRepository.js, and
 * flow-schema.md's `data.followUp`), plus its due timeframe, default
 * priority, and a free-text assignee suggestion — same "team" free-text
 * convention this node already uses, not a real user picker.
 */
function HandoffFollowUpEditor({ followUp, onChange }) {
  const enabled = !!followUp?.enabled;
  const dueInHours = String(followUp?.dueInHours ?? 24);
  const priority = followUp?.priority || "medium";
  const assignTo = followUp?.assignTo || "";

  function patch(partial) {
    onChange({ enabled, dueInHours: Number(dueInHours), priority, assignTo, ...followUp, ...partial });
  }

  return (
    <div onMouseDown={(e) => e.stopPropagation()} className="mt-1.5 pt-1.5 border-t" style={{ borderColor: tokens.cardBorder }}>
      <button
        onClick={() => patch({ enabled: !enabled })}
        className="w-full flex items-center justify-between text-[10px] font-semibold"
        style={{ color: enabled ? tokens.handoff.fg : tokens.muted }}
      >
        <span className="flex items-center gap-1"><Clock size={11} /> Auto-create follow-up</span>
        <span
          className="relative inline-flex h-3.5 w-6 rounded-full transition-colors"
          style={{ background: enabled ? tokens.handoff.fg : tokens.cardBorder }}
        >
          <span
            className="absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform"
            style={{ left: 2, transform: enabled ? "translateX(9px)" : "translateX(0)" }}
          />
        </span>
      </button>

      {enabled && (
        <div className="mt-1.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wide" style={{ color: tokens.muted }}>Due in</span>
            <div className="flex gap-1">
              {FOLLOW_UP_DUE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => patch({ dueInHours: Number(p.key) })}
                  className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold"
                  style={{
                    background: dueInHours === p.key ? tokens.handoff.bg : "transparent",
                    color: dueInHours === p.key ? tokens.handoff.fg : tokens.muted,
                    border: `1px solid ${dueInHours === p.key ? tokens.handoff.fg : tokens.cardBorder}`,
                  }}
                >
                  {p.label}
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={dueInHours}
                onChange={(e) => patch({ dueInHours: Number(e.target.value) || 24 })}
                title="Custom hours"
                className="w-9 text-[9px] px-1 rounded-md border"
                style={{ borderColor: tokens.cardBorder }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wide" style={{ color: tokens.muted }}>Priority</span>
            <div className="flex gap-1">
              {FOLLOW_UP_PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => patch({ priority: p })}
                  className="text-[9px] px-1.5 py-0.5 rounded-md capitalize font-semibold"
                  style={{
                    background: priority === p ? tokens.handoff.bg : "transparent",
                    color: priority === p ? tokens.handoff.fg : tokens.muted,
                    border: `1px solid ${priority === p ? tokens.handoff.fg : tokens.cardBorder}`,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <input
            value={assignTo}
            onChange={(e) => patch({ assignTo: e.target.value })}
            placeholder="Assign to (agent/team) — optional"
            className="w-full text-[10px] px-1.5 py-1 rounded-md border"
            style={{ borderColor: tokens.cardBorder }}
          />
        </div>
      )}
    </div>
  );
}

function DelayNodeEditor({ data, onUpdate }) {
  const mode = data.scheduledAt ? "date" : "duration";
  // Pick the coarsest unit that divides evenly, purely for a nicer default
  // display (e.g. 259200s shows as "3 days" rather than "4320 min").
  const initialUnit = (() => {
    const secs = data.seconds ?? 3600;
    for (const u of [...DELAY_UNITS].reverse()) {
      if (secs % u.seconds === 0) return u.key;
    }
    return "minutes";
  })();
  const [unit, setUnit] = useState(initialUnit);
  const unitInfo = DELAY_UNITS.find((u) => u.key === unit) || DELAY_UNITS[1];
  const amount = mode === "duration" ? Math.max(1, Math.round((data.seconds ?? 3600) / unitInfo.seconds)) : 1;

  function setDuration(nextAmount, nextUnitKey) {
    const u = DELAY_UNITS.find((x) => x.key === nextUnitKey) || unitInfo;
    onUpdate({ ...data, seconds: Math.max(1, Number(nextAmount) || 1) * u.seconds, scheduledAt: null });
  }

  return (
    <div onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex gap-1 mb-2">
        {[
          { key: "duration", label: "Wait duration" },
          { key: "date", label: "Specific date" },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => {
              if (m.key === "duration") onUpdate({ ...data, scheduledAt: null, seconds: data.seconds ?? 3600 });
              else onUpdate({ ...data, scheduledAt: data.scheduledAt || new Date(Date.now() + 86400000).toISOString(), seconds: null });
            }}
            className="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-semibold"
            style={{
              background: mode === m.key ? tokens.delay.bg : "transparent",
              color: mode === m.key ? tokens.delay.fg : tokens.muted,
              border: `1px solid ${mode === m.key ? tokens.delay.fg : tokens.cardBorder}`,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "duration" ? (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setDuration(e.target.value, unit)}
            className="w-14 text-[11px] px-1.5 py-1 rounded-md border"
            style={{ borderColor: tokens.cardBorder }}
          />
          <div className="flex gap-1">
            {DELAY_UNITS.map((u) => (
              <button
                key={u.key}
                onClick={() => { setUnit(u.key); setDuration(amount, u.key); }}
                className="text-[9px] px-1.5 py-0.5 rounded-md"
                style={{
                  background: unit === u.key ? tokens.delay.fg : "transparent",
                  color: unit === u.key ? "#fff" : tokens.muted,
                  border: `1px solid ${unit === u.key ? tokens.delay.fg : tokens.cardBorder}`,
                }}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <DateTimePicker
          value={data.scheduledAt || ""}
          onChange={(v) => onUpdate({ ...data, scheduledAt: v, seconds: null })}
          minDate={new Date()}
          placeholder="Pick resume date"
          showFreeBusy={false}
          className="w-full text-[11px] h-8"
        />
      )}
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
    { type: "delay", label: "Delay", icon: <Clock size={13} />, tone: tokens.delay },
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
      const isInteractive = n.data.messageType === "interactive";
      // A WhatsApp `list` message needs list.sections[].rows[] to even be
      // valid — this was never built anywhere before (only messageType got
      // renamed "interactive" -> "list"), which is what made buildSendTemplate
      // crash reading list.buttonLabel of undefined and silently drop every
      // reply with no error surfaced to the inbox.
      //
      // The canvas doesn't give this node its own per-option editor — the
      // "Options" pills the person actually fills in live one hop
      // downstream, on the Conditional Branching node this connects to (see
      // the n.type === "answer_branch" case below). So: if this interactive
      // message's one outgoing edge leads to a branch node, mirror that
      // node's branches as the WhatsApp list's rows, using each branch's OWN
      // id as the row id — evaluateAnswerBranchNode() (conditionEvaluator.js)
      // matches a tapped row back to a branch via `matchOptionId === b.id`,
      // so these ids have to line up exactly for a selection to route
      // anywhere. All rows share this node's single nextNodeId (the branch
      // node itself) as their fallback target, since it's the branch node —
      // not this message node — that actually decides where to go next.
      let list;
      if (isInteractive) {
        const targetNode = graph.nodes.find((gn) => gn.id === edge?.targetNodeId);
        const rows = targetNode?.type === "answer_branch"
          ? targetNode.data.branches.map((b) => ({ id: b.id, title: (b.label || "Option").slice(0, 24) }))
          : [];
        list = { buttonLabel: "Options", sections: [{ title: "Choose one", rows }] };
      }
      return {
        id: n.id, type: "message", position: n.position,
        data: {
          messageType: isInteractive ? "list" : n.data.messageType,
          body: n.data.body,
          document: n.data.document,
          list,
          waitForReply: isInteractive,
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
    if (n.type === "delay") {
      const edge = graph.edges.find((e) => e.sourceNodeId === n.id);
      return {
        id: n.id, type: "delay", position: n.position,
        data: {
          seconds: n.data.scheduledAt ? null : (n.data.seconds ?? 3600),
          scheduledAt: n.data.scheduledAt || null,
          nextNodeId: edge?.targetNodeId ?? null,
        },
      };
    }
    return { id: n.id, type: "handoff", position: n.position, data: { team: n.data.team, nextNodeId: null, followUp: n.data.followUp || null } };
  });

  // Guards against a stale/deleted entryNodeId ever reaching Postgres: if
  // it somehow doesn't match any node currently on the canvas (e.g. an
  // older saved playbook whose entry node was deleted before this
  // safeguard existed), fall back to the first node rather than deploying
  // a playbook the engine can never find a start for. deleteNode() and
  // setEntryNode() above keep this in sync going forward; this is just the
  // last line of defense at export time.
  const validEntryNodeId = graph.nodes.some((n) => n.id === graph.entryNodeId)
    ? graph.entryNodeId
    : graph.nodes[0]?.id ?? null;

  return { name: title, entryNodeId: validEntryNodeId, nodes };
}

/**
 * Inverse of exportFlowJson(): takes a playbook row as returned by
 * GET /automation/playbooks/:id (flow-schema.md shape — nextNodeId inline
 * on each node/branch) and rebuilds the builder's internal graph shape
 * (separate nodes[] + edges[] arrays, "list" back to "interactive", etc.).
 * This is what lets a flow saved from one machine reopen identically on
 * another — see PlaybookStudioApp.jsx's hydrate-on-mount.
 */
export function importFlowJson(playbook) {
  const nodes = [];
  const edges = [];

  for (const n of playbook.nodes || []) {
    // Older seed/demo rows may predate positioned layout — fall back to a
    // stacked default rather than crashing NodeCard's `left: node.position.x`.
    const position = n.position && typeof n.position.x === "number" ? n.position : { x: 620, y: 40 + nodes.length * 150 };

    if (n.type === "message") {
      nodes.push({
        id: n.id,
        type: "message",
        position,
        data: {
          messageType: n.data.messageType === "list" ? "interactive" : n.data.messageType,
          body: n.data.body,
          document: n.data.document,
          waitForReply: !!n.data.waitForReply,
        },
      });
      if (n.data.nextNodeId) {
        edges.push({ id: `e_${n.id}`, sourceNodeId: n.id, sourceBranchId: null, targetNodeId: n.data.nextNodeId });
      }
    } else if (n.type === "answer_branch") {
      nodes.push({
        id: n.id,
        type: "answer_branch",
        position,
        data: { branches: (n.data.branches || []).map((b) => ({ id: b.id, label: b.label })) },
      });
      for (const b of n.data.branches || []) {
        if (b.nextNodeId) {
          edges.push({ id: `e_${n.id}_${b.id}`, sourceNodeId: n.id, sourceBranchId: b.id, targetNodeId: b.nextNodeId });
        }
      }
    } else if (n.type === "delay") {
      nodes.push({
        id: n.id,
        type: "delay",
        position,
        data: { seconds: n.data.scheduledAt ? null : (n.data.seconds ?? 3600), scheduledAt: n.data.scheduledAt || null },
      });
      if (n.data.nextNodeId) {
        edges.push({ id: `e_${n.id}`, sourceNodeId: n.id, sourceBranchId: null, targetNodeId: n.data.nextNodeId });
      }
    } else {
      // handoff
      nodes.push({ id: n.id, type: "handoff", position, data: { team: n.data.team, followUp: n.data.followUp || null } });
    }
  }

  return { nodes, edges, entryNodeId: playbook.entryNodeId };
}

/* ------------------------------------------------------------------ */
/* Root component                                                      */
/* ------------------------------------------------------------------ */
export default function FlowBuilder({ initialGraph, initialTitle, syncStatus = "saved", onGraphChange, onTitleChange, onTestBot, onDeploy, deployState = "idle", playbookStatus = "draft", onTogglePause, pauseState = "idle" }) {
  const [graph, setGraph] = useState(initialGraph || seedGraph);
  const [title, setTitleState] = useState(initialTitle || "ElectroBtech — Internship & Training Enquiry Bot");
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

  // Marks which node the engine starts a brand-new conversation at
  // (see evaluateWorkflowStep in automation-service's workflowEngine.js —
  // it walks forward from `playbook.entryNodeId` for every first-ever
  // inbound message). There was previously NO way to set this from the UI
  // at all — entryNodeId was frozen at whatever seedGraph() hardcoded
  // ("n_greet") and never updated again, so a flow built from scratch (or
  // one that later deleted its original entry node) could silently end up
  // with a stale/missing entryNodeId — the engine would then find zero
  // nodes to walk through and send nothing, with no error surfaced anywhere.
  function setEntryNode(nodeId) {
    commit({ ...graph, entryNodeId: nodeId });
  }

  function deleteNode(nodeId) {
    const nextNodes = graph.nodes.filter((n) => n.id !== nodeId);
    const nextEdges = graph.edges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId);
    // Deleting the current entry node would otherwise leave entryNodeId
    // pointing at nothing — the engine has no way to signal that back to
    // the person deploying, it would just silently do nothing on every
    // inbound message. Fall back to another node automatically so the flow
    // always has *a* valid start, and let the person re-pick a better one
    // via "Set as start" if this guess isn't the right one.
    const entryNodeId = nodeId === graph.entryNodeId
      ? (nextNodes[0]?.id ?? null)
      : graph.entryNodeId;
    commit({ ...graph, nodes: nextNodes, edges: nextEdges, entryNodeId });
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
        : type === "delay" ? { seconds: 3600, scheduledAt: null }
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
      } else if (n.type === "message" || n.type === "delay") {
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
        <SyncStatusPill status={syncStatus} />
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
        {(playbookStatus === "active" || playbookStatus === "paused") && (
          <button
            onClick={() => onTogglePause?.()}
            disabled={pauseState === "working" || !onTogglePause}
            title={
              playbookStatus === "active"
                ? "Stop this bot from auto-replying to every number, without deleting the flow"
                : "Let this bot start auto-replying again"
            }
            className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3.5 py-1.5 border"
            style={{
              borderColor: playbookStatus === "active" ? "#D97706" : tokens.cardBorder,
              color: playbookStatus === "active" ? "#D97706" : "#15803D",
              opacity: pauseState === "working" ? 0.6 : 1,
            }}
          >
            {pauseState === "working" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : playbookStatus === "active" ? (
              <Pause size={13} />
            ) : (
              <Play size={13} />
            )}
            {playbookStatus === "active" ? "Pause" : "Resume"}
          </button>
        )}
        {pauseState === "error" && (
          <span className="text-[11px] text-red-600">Couldn't update — try again.</span>
        )}
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
              isEntry={node.id === graph.entryNodeId}
              onSetEntry={() => setEntryNode(node.id)}
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
              <span className="text-sm font-semibold">Deploy this flow</span>
              <button onClick={() => setShowExport(false)}><X size={16} /></button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[11px]" style={{ fontFamily: "ui-monospace, monospace", color: tokens.text }}>
              {JSON.stringify(exported, null, 2)}
            </pre>
            <div className="p-3 border-t flex gap-2" style={{ borderColor: tokens.cardBorder }}>
              <button
                onClick={() => navigator.clipboard?.writeText(JSON.stringify(exported, null, 2))}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg py-2 border"
                style={{ borderColor: tokens.cardBorder, color: tokens.text }}
              >
                <Copy size={13} /> Copy JSON
              </button>
              <button
                onClick={() => onDeploy?.(exported)}
                disabled={deployState === "deploying" || !onDeploy}
                title="Sets this playbook's status to active in Postgres — this is what actually makes it the live bot for this channel. Copy JSON above does not do this."
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg py-2 disabled:opacity-60"
                style={{ background: tokens.accent, color: "#fff" }}
              >
                {deployState === "deploying" ? "Deploying…" : deployState === "deployed" ? "Deployed ✓" : "Deploy — go live"}
              </button>
            </div>
            {deployState === "error" && (
              <p className="px-3 pb-3 text-[11px] text-red-600">Deploy failed — check your connection and try again.</p>
            )}
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
