const playbookRepository = require('../repositories/playbookRepository');
const conversationSessionRepository = require('../repositories/conversationSessionRepository');
const { evaluateConditionNode, evaluateAnswerBranchNode } = require('./conditionEvaluator');
const { checkAndIncrement, buildScopeKey } = require('./throttleService');

/**
 * MAIN ENTRY POINT
 * Takes a normalized inbound webhook event, resolves/creates the conversation
 * session, walks the flow graph from the current node through any number of
 * "silent" nodes (answer_branch/condition/throttle/action/delay), and stops
 * at the next node that requires a user reply (an interactive `message`
 * node) or a terminal `handoff`.
 *
 * Along the way, any `message` nodes with `waitForReply: false` (plain
 * text/document/image) are auto-chained and ALL sent together in
 * `nodesToRender` — this reproduces the reference builder's "Text" ->
 * "Document" pair, which sends as one unit with no reply in between.
 *
 * @param {Object} inboundEvent - normalized webhook payload, see shape below
 * @param {string} inboundEvent.clientId
 * @param {string} inboundEvent.channel        - 'whatsapp' | 'instagram' | 'messenger' | 'google_reviews' | 'linkedin_comments'
 * @param {string} inboundEvent.contactExternalId
 * @param {string} inboundEvent.playbookId     - resolved upstream by channel/trigger matching
 * @param {Object} inboundEvent.interaction     - what the user actually did
 * @param {string} [inboundEvent.interaction.type]        - 'button_click' | 'list_select' | 'text' | 'session_start'
 * @param {string} [inboundEvent.interaction.selectedId]  - button id / list row id, if applicable
 * @param {string} [inboundEvent.interaction.text]        - raw text, if applicable
 *
 * @returns {Promise<{ session: Object, nodesToRender: Object[], nodeToRender: Object|null, terminal: boolean, denied?: Object }>}
 */
async function evaluateWorkflowStep(inboundEvent) {
  const { clientId, channel, contactExternalId, playbookId, interaction } = inboundEvent;

  const playbook = await playbookRepository.findActiveById(playbookId);
  if (!playbook) {
    throw new Error(`No active playbook found for id ${playbookId}`);
  }
  const nodeMap = playbookRepository.getNodeMap(playbook);

  // ---- 1. Resolve or create the session -----------------------------------
  let session = await conversationSessionRepository.findActiveByPlaybookAndContact({
    playbookId, contactExternalId
  });

  const isNewSession = !session;

  if (isNewSession) {
    // First-ever inbound event for this contact on this playbook -> start
    // at the entry node. Global flow/client-level throttle is enforced here,
    // before a session is even created, so denied users never occupy a slot.
    const flowGate = await enforceGlobalLimits({ playbook, clientId, contactExternalId });
    if (!flowGate.allowed) {
      return { session: null, nodesToRender: [], nodeToRender: null, terminal: true, denied: flowGate };
    }

    session = await conversationSessionRepository.create({
      playbookId,
      clientId,
      channel,
      contactExternalId,
      currentNodeId: playbook.entryNodeId
    });
  }

  // ---- 2. Determine the starting point for this turn's walk ----------------
  // A brand-new session starts AT the entry node itself (inclusive) — the
  // triggering interaction (e.g. the contact's first "hi") isn't an answer
  // to anything yet, so it must not be run through resolveNextNodeIdFromInteraction,
  // which would silently skip sending the entry node's own content.
  // A resumed session instead resolves the interaction against whatever
  // node the contact was actually being shown.
  let startNodeId;
  const walkContext = buildEvalContext({ session, interaction: isNewSession ? null : interaction });

  if (isNewSession) {
    startNodeId = playbook.entryNodeId;
  } else {
    const currentNode = nodeMap.get(session.currentNodeId);
    if (!currentNode) {
      throw new Error(`Session references missing node ${session.currentNodeId}`);
    }
    startNodeId = resolveNextNodeIdFromInteraction(currentNode, interaction);
  }

  // ---- 3. Walk forward through the flow graph ------------------------------
  const walkResult = await walkForward({
    nodeMap, startNodeId, context: walkContext, session, playbookId, clientId, contactExternalId
  });

  if (walkResult.scheduled) {
    return { session, nodesToRender: walkResult.nodesToRender, nodeToRender: walkResult.nodesToRender.at(-1) ?? null, terminal: false, scheduled: true };
  }

  const { nodesToRender, denied } = walkResult;

  // ---- 4. Persist new position + path history ------------------------------
  const resolvedNode = nodesToRender.at(-1) ?? null;
  const isDeadEndMessage = resolvedNode?.type === 'message'
    && resolvedNode.data.nextNodeId == null
    && resolvedNode.data.defaultNextNodeId == null;
  const terminal = !resolvedNode || resolvedNode.type === 'handoff' || isDeadEndMessage;

  session.currentNodeId = resolvedNode ? resolvedNode.id : session.currentNodeId;
  session.pathHistory.push(...nodesToRender.map(n => ({ nodeId: n.id, enteredAt: new Date(), userInput: interaction ?? null })));
  session.messageCount += nodesToRender.length || 1;
  session.lastInteractionAt = new Date();
  if (terminal) session.status = resolvedNode?.type === 'handoff' ? 'handed_off' : 'completed';
  session = await conversationSessionRepository.save(session);

  return {
    session,
    nodesToRender,
    nodeToRender: resolvedNode,
    terminal,
    denied
  };
}

/**
 * Walks the flow graph starting at `startNodeId` (inclusive), collecting every
 * `message`/`handoff` node it passes along the way into `nodesToRender`,
 * auto-chaining through `waitForReply: false` messages and silently resolving
 * `answer_branch` / `condition` / `throttle` / `action` nodes. Shared by both
 * the brand-new-session path (starts at the entry node) and the resumed-session
 * path (starts at whatever `resolveNextNodeIdFromInteraction` returned).
 */
async function walkForward({ nodeMap, startNodeId, context, session, playbookId, clientId, contactExternalId }) {
  let nextNodeId = startNodeId;
  const nodesToRender = [];
  let denied = null;

  while (nextNodeId) {
    const node = nodeMap.get(nextNodeId);
    if (!node) throw new Error(`Flow references missing node ${nextNodeId}`);

    if (node.type === 'message') {
      nodesToRender.push(node);
      if (node.data.waitForReply === false) {
        // Plain text/document/image — send it and immediately continue the
        // chain without waiting on the contact (matches Text -> Document).
        nextNodeId = node.data.nextNodeId ?? null;
        continue;
      }
      break; // interactive message (buttons/list) — pause here for a reply
    }

    if (node.type === 'handoff') {
      nodesToRender.push(node);
      break;
    }

    if (node.type === 'answer_branch') {
      nextNodeId = evaluateAnswerBranchNode(node.data, context);
      continue;
    }

    if (node.type === 'condition') {
      nextNodeId = evaluateConditionNode(node.data, context);
      continue;
    }

    if (node.type === 'throttle') {
      const scopeKey = buildScopeKey({
        scope: node.data.scope, playbookId, nodeId: node.id, clientId
      });
      const result = await checkAndIncrement({
        scopeKey,
        limitType: node.data.limitType,
        maxCount: node.data.maxCount,
        window: node.data.window,
        contactId: contactExternalId
      });
      if (!result.allowed) {
        denied = { nodeId: node.id, ...result };
        nextNodeId = node.data.onLimitReachedNextNodeId;
      } else {
        nextNodeId = node.data.onAllowedNextNodeId;
      }
      continue;
    }

    if (node.type === 'action') {
      await runAction(node.data, session); // fire-and-await side effect (tag, webhook, etc.)
      nextNodeId = node.data.nextNodeId;
      continue;
    }

    if (node.type === 'delay') {
      // In production this hands off to a job queue (BullMQ) that re-invokes
      // evaluateWorkflowStep after node.data.seconds. We return early here
      // and let the caller schedule it. Anything already queued in
      // nodesToRender still gets sent now (e.g. a text confirming "we'll
      // follow up soon" before the delay kicks in).
      await scheduleDelayedContinuation(session, node);
      return { nodesToRender, denied, scheduled: true };
    }

    throw new Error(`Unhandled node type: ${node.type}`);
  }

  return { nodesToRender, denied, scheduled: false };
}

/**
 * Given the CURRENT node and the user's interaction, finds which nextNodeId
 * to move to. Two routing styles are both supported:
 *   1. Inline: the clicked button/row carries its own `nextNodeId` directly.
 *   2. Explicit branch node: the button/row has no `nextNodeId`, so we fall
 *      through to the message's own linear `data.nextNodeId`, which points
 *      at an `answer_branch` node (the reference builder's "Conditional
 *      Branching" block) that does the actual routing based on `selectedId`.
 * Falls back to `defaultNextNodeId` for an unrecognized reply or timeout.
 */
function resolveNextNodeIdFromInteraction(currentNode, interaction = {}) {
  const { type, selectedId } = interaction;

  if (currentNode.type === 'message') {
    const { messageType, buttons, list, defaultNextNodeId, nextNodeId: linearNextNodeId } = currentNode.data;

    if (type === 'button_click' && messageType === 'buttons') {
      const btn = (buttons || []).find(b => b.id === selectedId);
      if (!btn) return defaultNextNodeId ?? null;
      return btn.nextNodeId ?? linearNextNodeId ?? null;
    }

    if (type === 'list_select' && messageType === 'list') {
      for (const section of list.sections || []) {
        const row = section.rows.find(r => r.id === selectedId);
        if (row) return row.nextNodeId ?? linearNextNodeId ?? null;
      }
      return defaultNextNodeId ?? null;
    }

    // Free text reply, or a plain text/document node continuing its chain
    return linearNextNodeId ?? defaultNextNodeId ?? null;
  }

  // If somehow re-entering on a non-message node (e.g. resumed after delay)
  return currentNode.data?.nextNodeId ?? null;
}

/** Builds the flat lookup context condition nodes evaluate `field` paths against. */
function buildEvalContext({ session, interaction }) {
  return {
    contact: { id: session.contactExternalId, ...session.variables?.contact },
    lastMessage: { text: interaction?.text ?? null, selectedId: interaction?.selectedId ?? null },
    session: { messageCount: session.messageCount, variables: session.variables }
  };
}

/** Enforces flow-level and client-level limits BEFORE a session is created. */
async function enforceGlobalLimits({ playbook, clientId, contactExternalId }) {
  const { globalLimits } = playbook;
  if (!globalLimits) return { allowed: true };

  if (globalLimits.maxConversationsPerDay) {
    const scopeKey = buildScopeKey({ scope: 'flow', playbookId: playbook.id });
    const dailyResult = await checkAndIncrement({
      scopeKey,
      limitType: 'conversation_count',
      maxCount: globalLimits.maxConversationsPerDay,
      window: 'daily',
      contactId: contactExternalId
    });
    if (!dailyResult.allowed) return dailyResult;
  }

  if (globalLimits.maxConversationsTotal) {
    const scopeKey = buildScopeKey({ scope: 'flow', playbookId: playbook.id });
    const totalResult = await checkAndIncrement({
      scopeKey,
      limitType: 'conversation_count',
      maxCount: globalLimits.maxConversationsTotal,
      window: 'all_time',
      contactId: contactExternalId
    });
    if (!totalResult.allowed) return totalResult;
  }

  return { allowed: true };
}

/** Placeholder for action-node side effects — swap in real integrations. */
async function runAction(actionData, session) {
  switch (actionData.actionType) {
    case 'add_tag':
      session.variables.contact = session.variables.contact || {};
      session.variables.contact.tags = [...(session.variables.contact.tags || []), actionData.payload.tag];
      return;
    case 'update_field':
      Object.assign(session.variables, actionData.payload);
      return;
    case 'webhook':
      // fire-and-forget external call; wrap in try/catch in production so a
      // failing customer webhook never blocks the conversation flow
      return;
    case 'increment_counter':
      return; // delegate to throttleService if this needs shared/global state
    default:
      return;
  }
}

/** Placeholder — enqueue a delayed job (e.g. BullMQ) to resume this session later. */
async function scheduleDelayedContinuation(session, node) {
  // queue.add('resume-session', { sessionId: session.id, nodeId: node.data.nextNodeId }, { delay: node.data.seconds * 1000 });
  return;
}

module.exports = { evaluateWorkflowStep };
