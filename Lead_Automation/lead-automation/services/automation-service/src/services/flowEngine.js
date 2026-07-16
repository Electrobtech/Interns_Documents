const crypto = require('crypto');

const AI_SERVICE_URL = process.env.AI_AGENT_SERVICE_URL || 'http://ai-agent-service:4012';

async function log(db, executionId, nodeId, level, message) {
  await db.query(
    `INSERT INTO flow_execution_logs (id, execution_id, node_id, level, message, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [crypto.randomUUID(), executionId, nodeId, level, message]
  );
}

function evalCondition(expr, state) {
  try {
    // Quick sandboxed eval (use with trusted flow authors).
    // In production, replace with a safer expression parser.
    return new Function('state', `return (${expr})`)(state);
  } catch (e) {
    console.warn('Condition eval error:', e.message);
    return false;
  }
}

async function executeNode(db, node, state) {
  const cfg = node.config || {};

  switch (node.type) {
    case 'start':
      return cfg.next || null;

    case 'message': {
      const content =
        cfg.content
          ?.replace(/\{\{name\}\}/g, state.contact?.name || '')
          ?.replace(/\{\{channel\}\}/g, state.channel || '') || '';

      if (state.conversation_id) {
        await db.query(
          `INSERT INTO ai_messages (id, conversation_id, direction, channel, content, metadata, created_at)
           VALUES ($1, $2, 'outbound', $3, $4, $5, NOW())`,
          [
            crypto.randomUUID(),
            state.conversation_id,
            cfg.channel || state.channel || 'webchat',
            content,
            JSON.stringify({ flow: true, node: node.id }),
          ]
        );
      }
      return cfg.next || null;
    }

    case 'delay': {
      const ms = Number(cfg.duration_ms) || 1000;
      await new Promise((r) => setTimeout(r, ms));
      return cfg.next || null;
    }

    case 'condition': {
      const pass = evalCondition(cfg.expression || 'true', state);
      return pass ? cfg.true_next || null : cfg.false_next || null;
    }

    case 'ai_agent': {
      try {
        const res = await fetch(`${AI_SERVICE_URL}/supervisor/inbound`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: {
              workspace_id: state.workspace_id,
              channel: state.channel || 'webchat',
              text: cfg.prompt || state.last_message || '',
              contact: state.contact || {},
            },
          }),
        });
        const data = await res.json();
        state.last_ai_response = data.response;
      } catch (e) {
        state.last_error = e.message;
      }
      return cfg.next || null;
    }

    case 'tag': {
      if (cfg.tag && state.contact_id) {
        await db.query(
          `UPDATE ai_contacts
           SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), $1),
               updated_at = NOW()
           WHERE id = $2`,
          [cfg.tag, state.contact_id]
        );
      }
      return cfg.next || null;
    }

    case 'webhook': {
      if (cfg.url) {
        try {
          await fetch(cfg.url, {
            method: cfg.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state),
          });
        } catch (e) {
          console.warn('Webhook node fetch failed:', e.message);
        }
      }
      return cfg.next || null;
    }

    case 'end':
      return null;

    default:
      return cfg.next || null;
  }
}

async function runFlow(flowId, trigger, db) {
  const { rows } = await db.query(
    `SELECT * FROM automation_flows WHERE id = $1 AND active = true`,
    [flowId]
  );
  if (!rows.length) throw new Error('Flow not found or inactive');

  const flow = rows[0];
  const startNode = flow.definition.nodes.find((n) => n.type === 'start');
  if (!startNode) throw new Error('Flow missing start node');

  const executionRes = await db.query(
    `INSERT INTO flow_executions (id, flow_id, workspace_id, status, context, started_at)
     VALUES ($1, $2, $3, 'running', $4, NOW()) RETURNING id`,
    [crypto.randomUUID(), flowId, trigger.workspace_id, JSON.stringify(trigger)]
  );
  const executionId = executionRes.rows[0].id;

  const state = {
    ...trigger,
    last_message: trigger.text || trigger.last_message || '',
  };

  try {
    let node = startNode;
    const visited = new Set();

    while (node) {
      if (visited.has(node.id)) {
        await log(db, executionId, node.id, 'error', 'Cycle detected in flow');
        break;
      }
      visited.add(node.id);

      await log(db, executionId, node.id, 'info', `Running ${node.type}`);
      const nextId = await executeNode(db, node, state);

      if (node.type === 'end' || !nextId) break;

      const next = flow.definition.nodes.find((n) => n.id === nextId);
      if (!next) {
        await log(db, executionId, nextId, 'error', 'Next node not found');
        break;
      }
      node = next;
    }

    await db.query(
      `UPDATE flow_executions
       SET status = 'completed', finished_at = NOW(), context = $1
       WHERE id = $2`,
      [JSON.stringify(state), executionId]
    );
  } catch (e) {
    await db.query(
      `UPDATE flow_executions
       SET status = 'failed', finished_at = NOW(), error = $1
       WHERE id = $2`,
      [e.message, executionId]
    );
    throw e;
  }

  return { execution_id: executionId, status: 'completed' };
}

module.exports = { runFlow };
