Playbook Flow JSON Structure

Design Principles


A flow is a directed graph: nodes[] + edges expressed as nextNodeId references (no separate edge array needed — keeps traversal O(1) via a Map).
Every node has a universal envelope (id, type, channel, position) plus a type-specific data payload.
Branching lives inside the node that creates the branch (buttons/list options carry their own nextNodeId), not in a global edge table. This mirrors how Voiceflow/Typeform store choice-based routing and avoids a second source of truth.
Throttling is a node type, not a global flag — so a client can gate any point in the tree (e.g., "only let 500 people reach the discount-code node per day").


Top-Level Playbook Document

Your reference screenshot's sidebar groups playbooks per-channel with special role tags (Default, Fallback, GEN AI Default, Transfer, Unsubscribe). That's the playbookType field below — it changes how a playbook gets resolved for an inbound message, not just what's inside it:


standard — matched by an explicit trigger/keyword (most playbooks).
default — the one playbook a channel opens with when there's no session and no other trigger matches (their "# 1. Welcome Bot").
fallback — invoked when the active session's current node has no matching route for what the user just sent (their "Fallback").
gen_ai_default — hands the turn to an LLM-driven agent instead of a fixed node chain, used as a catch-all.
transfer — a short playbook whose sole job is handing off to a human/team (their "Transfer to …").
unsubscribe — triggered by opt-out keywords (STOP, unsubscribe), independent of whatever flow the contact was in.


json{
  "_id": "pb_64f0a1",
  "clientId": "client_882",
  "name": "WhatsApp Support Triage",
  "channels": ["whatsapp", "instagram", "messenger", "google_reviews", "linkedin_comments"],
  "playbookType": "standard",
  "triggerKeywords": ["project", "projects", "ieee"],
  "status": "active",
  "version": 3,
  "entryNodeId": "node_start",
  "globalLimits": {
    "maxConversationsTotal": 5000,
    "maxConversationsPerDay": 500,
    "resetWindow": "daily"
  },
  "nodes": [ /* Node objects, see below */ ],
  "createdAt": "2026-06-01T10:00:00Z",
  "updatedAt": "2026-07-01T14:17:58Z"
}

Universal Node Envelope

json{
  "id": "node_start",
  "type": "message | condition | throttle | action | delay | handoff",
  "channel": "whatsapp | instagram | messenger | google_reviews | linkedin_comments | all",
  "position": { "x": 240, "y": 120 },
  "data": { /* type-specific, see below */ },
  "meta": { "label": "Welcome Message", "notes": "" }
}

1. Message Node (type: "message")

Supports text, interactive buttons, list messages, and documents in a single unified schema (superset of WhatsApp Cloud API's interactive object, made channel-agnostic).

json{
  "id": "node_welcome",
  "type": "message",
  "channel": "whatsapp",
  "data": {
    "messageType": "text | buttons | list | document | image",
    "body": "Hi {{contact.first_name}}, how can we help today?",
    "header": { "type": "text", "text": "Support Bot" },
    "footer": "Reply within 24h for fastest service",

    "document": {
      "url": "https://cdn.example.com/catalog.pdf",
      "filename": "Catalog.pdf"
    },

    "buttons": [
      { "id": "btn_billing", "label": "Billing Issue", "nextNodeId": "node_billing" },
      { "id": "btn_tech",    "label": "Technical Issue", "nextNodeId": "node_tech" },
      { "id": "btn_other",   "label": "Something Else", "nextNodeId": "node_fallback" }
    ],

    "list": {
      "buttonLabel": "View Options",
      "sections": [
        {
          "title": "Support",
          "rows": [
            { "id": "row_refund", "title": "Refund Status", "description": "Track a refund", "nextNodeId": "node_refund_flow" },
            { "id": "row_order",  "title": "Order Status",  "description": "Track an order",  "nextNodeId": "node_order_flow" }
          ]
        }
      ]
    },

    "defaultNextNodeId": "node_fallback_timeout",
    "inputTimeoutSeconds": 86400,

    "waitForReply": true,
    "nextNodeId": null
  }
}


buttons[].nextNodeId / list.sections[].rows[].nextNodeId are an OPTIONAL shortcut for simple flat flows where you want inline per-option routing without a separate branch node. When present, the engine uses them.
If you instead use the Answer-Branch node pattern (§2a, matching your reference builder), leave option-level nextNodeIds empty and instead point the message's own data.nextNodeId at the answer_branch node — the branch node does the routing.
waitForReply: true for interactive messages (buttons/list) — engine pauses and persists session until the contact replies. false for plain text/document/image nodes that should auto-advance to nextNodeId immediately after sending, with no user input required. This is exactly the "Text" → "Document" pair in your screenshot: both are waitForReply: false, so the engine sends both in the same turn and only pauses once it reaches the next interactive node (or the chain ends).
defaultNextNodeId handles timeout/no-reply fallback for interactive nodes (kept separate from nextNodeId so "user never answered" and "sent, now continue" are distinct code paths).


2a. Answer-Branch Node (type: "answer_branch") — matches the visual builder pattern

This is the node your reference screenshot (QuickReply.ai) calls "Conditional Branching". It is visually and structurally a separate node placed directly after a List/Button message — it does not live inline on the message's options. Each branch pill (CSE Project, EEE Project, MECH Project, ECE Project, Default condition) in the screenshot corresponds to one entry below:

json{
  "id": "node_branch_project",
  "type": "answer_branch",
  "channel": "all",
  "data": {
    "sourceNodeId": "node_list_project",
    "branches": [
      { "id": "b_cse",  "label": "CSE Project",  "matchOptionId": "row_cse",  "nextNodeId": "node_cse_text" },
      { "id": "b_eee",  "label": "EEE Project",  "matchOptionId": "row_eee",  "nextNodeId": "node_eee_text" },
      { "id": "b_mech", "label": "MECH Project", "matchOptionId": "row_mech", "nextNodeId": "node_mech_text" },
      { "id": "b_ece",  "label": "ECE Project",  "matchOptionId": "row_ece",  "nextNodeId": "node_ece_text" }
    ],
    "defaultBranch": { "label": "Default condition", "nextNodeId": "node_fallback" }
  }
}


sourceNodeId is purely for the builder UI to know which upstream message's answer this branches on (used to render "which options can I branch on" in the editor).
At runtime the engine matches the contact's last selection (selectedId from a button/list reply) against branches[].matchOptionId. First match wins; no match → defaultBranch.nextNodeId (the "Default condition" pill).
Why a separate node instead of inline nextNodeId on each button/row? It lets the same message (e.g. a reusable "Which project type?" list) be piped into different branch nodes in different playbooks, and it's what your builder already renders as one visual block — so the JSON should mirror the canvas 1:1 for a WYSIWYG editor.


2b. Advanced Condition Node (type: "condition") — logic beyond a direct answer

Used for branching that isn't a direct button/list reply — e.g. evaluating variables, free-text keyword matching, CRM tags, business hours, or an external API result.

json{
  "id": "node_check_vip",
  "type": "condition",
  "channel": "all",
  "data": {
    "conditionType": "variable | keyword_match | business_hours | api_lookup",
    "rules": [
      {
        "if": { "field": "contact.tags", "operator": "contains", "value": "vip" },
        "nextNodeId": "node_vip_priority_queue"
      },
      {
        "if": { "field": "lastMessage.text", "operator": "matches_regex", "value": "(?i)refund|cancel" },
        "nextNodeId": "node_refund_flow"
      }
    ],
    "elseNextNodeId": "node_general_queue"
  }
}

Supported operators: equals, not_equals, contains, matches_regex, gt, lt, in. Rules are evaluated in array order, first match wins (short-circuit) — matches how business users expect "if/else if/else" to work visually.

3. Throttling / Frequency Node (type: "throttle")

Gates flow progression based on counts. This is the node type your requirement #3 (state limits) hooks into directly.

json{
  "id": "node_discount_gate",
  "type": "throttle",
  "channel": "all",
  "data": {
    "scope": "node | flow | client",
    "limitType": "conversation_count | message_count | unique_contact_count",
    "maxCount": 500,
    "window": "all_time | daily | weekly | monthly",
    "onLimitReachedNextNodeId": "node_limit_reached_message",
    "onAllowedNextNodeId": "node_send_discount_code"
  }
}


scope: "node" → counter is per-node (e.g. only 500 people ever reach this discount node).
scope: "flow" → counter is per-playbook (e.g. only 5000 total conversations processed by this playbook).
scope: "client" → global cross-flow cap for the client's plan tier.


4. Action Node (type: "action") — optional but recommended

For side effects: tagging a contact, calling a webhook, updating CRM, incrementing a custom counter.

json{
  "id": "node_tag_lead",
  "type": "action",
  "data": {
    "actionType": "add_tag | webhook | update_field | increment_counter",
    "payload": { "tag": "warm_lead" },
    "nextNodeId": "node_next_step"
  }
}

5. Delay Node (type: "delay") — waits before resuming at nextNodeId. Carries
   EITHER a relative `seconds` wait OR an absolute `scheduledAt` ISO 8601
   timestamp, never both (the flow builder's UI is a mode toggle, "Wait
   duration" vs "Specific date"; workflowEngine.js's
   scheduleDelayedContinuation() resolves whichever is present down to a
   single delayMs). `scheduledAt` in the past resolves to a 0ms delay
   (fires immediately on next evaluation) rather than erroring.

json{ "id": "node_wait", "type": "delay", "data": { "seconds": 3600, "scheduledAt": null, "nextNodeId": "node_followup" } }
json{ "id": "node_wait2", "type": "delay", "data": { "seconds": null, "scheduledAt": "2026-08-15T09:00:00.000Z", "nextNodeId": "node_followup" } }

6. Handoff Node (type: "handoff") — end of automation, route to human

json{ "id": "node_human", "type": "handoff", "data": { "team": "support_l2", "nextNodeId": null } }

Optionally carries a `followUp` object so reaching this node also drops a
reminder into the CRM's Follow-ups queue (see the Follow-ups page,
frontend/src/app/app/follow-ups/page.jsx, and
services/automation-service/src/repositories/followUpRepository.js) instead
of the handoff only ever surfacing in the Unified Inbox:

json{
  "id": "node_human",
  "type": "handoff",
  "data": {
    "team": "support_l2",
    "nextNodeId": null,
    "followUp": {
      "enabled": true,
      "dueInHours": 24,        // common presets: 24, 48, 72 — any positive number is accepted
      "priority": "medium",    // low | medium | high
      "assignTo": "Priya (Sales)"  // free text, same convention as `team`; only written to
                                    // follow_ups.assigned_to when it happens to be a real user id
    }
  }
}

`followUp` is entirely optional — omitting it (or `enabled: false`) leaves
the handoff behaving exactly as before, with no Follow-up row created.