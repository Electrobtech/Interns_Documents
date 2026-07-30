"""Prompt-to-Workflow Agent — parses a natural-language automation description
("When a LinkedIn lead form is submitted and budget > $10k, send a WhatsApp
template") into an executable Trigger -> Condition -> Action node graph that the
visual canvas renders and the Node.js workflow engine can run.

This is a PARSER, not a planner: it must only emit nodes for automation the user
actually described. It never invents extra steps."""
from __future__ import annotations

_REQUIRED_KEYS = ("workflow_name", "nodes", "edges", "summary", "warnings")

# Kept in sync with what the canvas renders and the engine understands.
TRIGGER_TYPES = ["message_received", "lead_created", "form_submitted", "tag_added", "schedule", "campaign_opened"]
CONDITION_TYPES = ["field_compare", "contains_keyword", "score_threshold", "channel_is", "time_window"]
ACTION_TYPES = ["send_message", "send_template", "assign_agent", "add_tag", "update_stage", "create_task", "notify_team", "wait"]

SYSTEM_PROMPT = f"""You are the Prompt-to-Workflow compiler inside an enterprise Lead Automation CRM.
You convert a plain-English automation request into a directed workflow graph of nodes and edges.

NODE KINDS — every node has kind = "trigger" | "condition" | "action":
- trigger  (exactly ONE, always the entry point). type must be one of: {TRIGGER_TYPES}
- condition (zero or more, branching). type must be one of: {CONDITION_TYPES}
- action   (one or more, the things that happen). type must be one of: {ACTION_TYPES}

NODE SHAPE:
{{"id": "n1", "kind": "trigger", "type": "form_submitted", "label": "LinkedIn lead form submitted",
  "config": {{"channel": "linkedin"}}}}
- id: short unique string ("n1", "n2", ...).
- label: human-readable, max ~48 chars — this is what the canvas shows.
- config: only keys you can actually infer from the request. Never invent IDs, phone numbers,
  template names, or URLs the user did not give — leave those out and add a warning instead.

EDGE SHAPE:
{{"from": "n1", "to": "n2", "branch": "yes"}}
- branch is REQUIRED for edges leaving a condition node: "yes" or "no". Omit it otherwise.
- Every non-trigger node must be reachable from the trigger.

RULES:
- Emit ONLY what the user described. No extra "best practice" steps.
- If the request is ambiguous or missing a required value (e.g. which template to send),
  still produce the node, and add a clear string to "warnings" naming what must be filled in.
- If the request describes no automation at all, return an empty nodes/edges list and explain
  in "summary" what is missing.
- workflow_name: a short title derived from the request, max ~40 chars.
- summary: 1-2 sentences describing what the workflow does, in plain English.

Respond with ONLY a single JSON object with EXACTLY these keys (no markdown fences):
{{"workflow_name": str, "nodes": [...], "edges": [...], "summary": str, "warnings": [str]}}"""


def build_user_prompt(prompt: str, context: str | None = None) -> str:
    ctx = f"\n\nORGANIZATION CONTEXT (channels/among available):\n{context}" if context else ""
    return f"AUTOMATION REQUEST TO COMPILE:\n{prompt}{ctx}"


def validate_shape(data: dict) -> dict:
    """Normalizes the LLM output so the canvas can render it without crashing on a
    malformed graph: guarantees the required keys, coerces nodes/edges to lists of
    dicts, drops nodes with an unusable kind, and drops edges pointing at nodes
    that don't exist."""
    defaults = {"workflow_name": "Untitled workflow", "nodes": [], "edges": [], "summary": "", "warnings": []}
    for key in _REQUIRED_KEYS:
        if key not in data:
            data[key] = defaults[key]

    valid_kinds = {"trigger", "condition", "action"}
    nodes = []
    seen_ids = set()
    for i, n in enumerate(data.get("nodes") or []):
        if not isinstance(n, dict):
            continue
        kind = str(n.get("kind", "")).lower()
        if kind not in valid_kinds:
            continue
        nid = str(n.get("id") or f"n{i + 1}")
        if nid in seen_ids:
            nid = f"{nid}_{i}"
        seen_ids.add(nid)
        nodes.append({
            "id": nid,
            "kind": kind,
            "type": str(n.get("type") or ""),
            "label": str(n.get("label") or n.get("type") or kind)[:80],
            "config": n.get("config") if isinstance(n.get("config"), dict) else {},
        })

    edges = []
    for e in data.get("edges") or []:
        if not isinstance(e, dict):
            continue
        src, dst = str(e.get("from") or ""), str(e.get("to") or "")
        if src not in seen_ids or dst not in seen_ids:
            continue  # drop dangling edges rather than render a broken graph
        edge = {"from": src, "to": dst}
        branch = e.get("branch")
        if branch in ("yes", "no"):
            edge["branch"] = branch
        edges.append(edge)

    data["nodes"] = nodes
    data["edges"] = edges
    data["warnings"] = [str(w) for w in (data.get("warnings") or []) if w]
    data["workflow_name"] = str(data.get("workflow_name") or "Untitled workflow")[:60]
    data["summary"] = str(data.get("summary") or "")
    return data
