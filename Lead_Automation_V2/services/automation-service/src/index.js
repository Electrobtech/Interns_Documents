const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
// Reuse the CRM's own JWT auth (@lead/shared) — imported directly from the
// auth module (not the package's top-level index) so this stays consistent
// with the auth-only import style other lightweight route handlers use.
const { authenticate } = require('@lead/shared/src/auth');

const webhookController = require('./controllers/webhookController');
const campaignSendController = require('./controllers/campaignSendController');
const inboxReplyController = require('./controllers/inboxReplyController');
const mediaController = require('./controllers/mediaController');
const playbookController = require('./controllers/playbookController');
const conversationSessionRepository = require('./repositories/conversationSessionRepository');
const { runFlow } = require('./services/flowEngine');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = { query: (text, params) => pool.query(text, params) };

const app = express();
app.use(cors());
app.use(express.json());

// Serves uploaded documents (see mediaController.js) at
// /uploads/documents/<file>. Deliberately public/unauthenticated: the
// WhatsApp Cloud API fetches this URL directly from Meta's servers, which
// can't carry a CRM bearer token.
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

app.get('/health', (_req, res) => res.json({ service: 'automation', ok: true }));

// --- Diagnostic Bench helper routes (used by the WhatsApp > Automation UI) ---
// Both require CRM auth: only logged-in CRM users can simulate/reset test
// sessions. The real inbound-webhook endpoint (mounted below via
// webhookController) stays public since external channel providers call it
// directly and can't carry a CRM bearer token.
app.use('/automation/session', authenticate);

// POST /automation/session/simulate
// The Playbook Studio "Simulate" tab talks to the engine directly with the
// simplified { recipientPhone, playbookId, interaction } shape (rather than
// a provider-shaped webhook body) — this exposes evaluateWorkflowStep for
// exactly that, scoped to the calling user's organization as clientId.
// NOTE: this only returns a "live" result once the flow you're testing has a
// matching playbook row seeded in Postgres (see src/seeds/*.json + the
// `npm run seed` script) — otherwise it 404s and the UI falls back to its
// built-in offline mock walk, same as it always has.
app.post('/automation/session/simulate', async (req, res) => {
  try {
    const { recipientPhone, playbookId, interaction, channel = 'whatsapp' } = req.body;
    const { evaluateWorkflowStep } = require('./services/workflowEngine');

    const result = await evaluateWorkflowStep({
      clientId: req.user.organizationId,
      channel,
      contactExternalId: recipientPhone,
      playbookId,
      interaction,
    });

    const nodesToRender = result.nodesToRender || (result.nodeToRender ? [result.nodeToRender] : []);
    res.status(200).json({
      status: result.terminal ? 'terminal' : 'active',
      sessionId: result.session?.id,
      nodesToRender,
      denied: result.denied,
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /automation/session/reset -> drops the Postgres session row for the tester contact
app.post('/automation/session/reset', async (req, res) => {
  try {
    const { recipientPhone, playbookId } = req.body;
    await conversationSessionRepository.deleteOne({
      clientId: req.user.organizationId,
      contactExternalId: recipientPhone,
      playbookId,
    });
    res.status(200).json({ ok: true, message: 'Session dropped successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /automation/preferences/conversation-view
// UI-preference stub: the Playbook Studio toolbar's Compact/Detailed toggle
// posts here on every change. There's no preferences table yet — this
// just confirms the round-trip and logs who changed what, so the frontend
// has a real endpoint to integrate against before persistence is built out.
// Gated behind the same CRM auth as /automation/session/* since it's a
// per-user setting, not a public webhook.
app.use('/automation/preferences', authenticate);
app.post('/automation/preferences/conversation-view', (req, res) => {
  const { preference } = req.body;
  if (!['compact', 'detailed'].includes(preference)) {
    return res.status(400).json({ error: "preference must be 'compact' or 'detailed'" });
  }
  console.log(`[preferences] user ${req.user.userId} (org ${req.user.organizationId}) set conversation view -> ${preference}`);
  res.status(200).json({ success: true, preference });
});

// POST /automation/internal/campaign-send and /automation/internal/inbox-reply
// — both internal-use routes (called by campaign-service and the Unified
// Inbox UI respectively, never by an external channel provider), so they
// sit behind the same CRM auth as /automation/session/* rather than the
// public webhook path. See campaignSendController.js / inboxReplyController.js.
app.use('/automation/internal', authenticate);
app.use('/', campaignSendController);
app.use('/', inboxReplyController);

// POST /automation/media/upload — Message Node "document" badge upload
// (see FlowBuilder.jsx / mediaController.js). CRM-auth gated, same as the
// other builder-facing routes above; the resulting URL that gets returned
// is what's later fetched *unauthenticated* by Meta at send time.
app.use('/automation/media', authenticate);
app.use('/', mediaController);

// GET/PUT /automation/playbooks/:id — Playbook Studio load + autosave
// (see PlaybookStudioApp.jsx / playbookController.js). This is the real
// persistence layer the builder writes to now instead of only localStorage.
app.use('/automation/playbooks', authenticate);
app.use('/', playbookController);

// Workflow Automation Engine routes
app.get('/flows', async (req, res) => {
  const { workspace_id } = req.query;
  const { rows } = await db.query(
    `SELECT * FROM automation_flows
     WHERE workspace_id = $1
     ORDER BY updated_at DESC`,
    [workspace_id]
  );
  res.json(rows);
});

app.post('/flows', async (req, res) => {
  const { workspace_id, name, description, definition } = req.body;
  const { rows } = await db.query(
    `INSERT INTO automation_flows (id, workspace_id, name, description, definition, active, published, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
    [crypto.randomUUID(), workspace_id, name, description || '', JSON.stringify(definition || { nodes: [] }), true, false]
  );
  res.status(201).json(rows[0]);
});

app.get('/flows/:id', async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM automation_flows WHERE id = $1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

app.put('/flows/:id', async (req, res) => {
  const { name, description, definition, active, published } = req.body;
  const { rows } = await db.query(
    `UPDATE automation_flows
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         definition = COALESCE($3, definition),
         active = COALESCE($4, active),
         published = COALESCE($5, published),
         updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [name, description, definition ? JSON.stringify(definition) : null, active, published, req.params.id]
  );
  res.json(rows[0]);
});

app.post('/flows/:id/publish', async (req, res) => {
  await db.query(
    `UPDATE automation_flows SET published = true, updated_at = NOW() WHERE id = $1`,
    [req.params.id]
  );
  res.json({ published: true });
});

app.post('/flows/:id/trigger', async (req, res) => {
  try {
    const run = await runFlow(req.params.id, req.body, db);
    res.json(run);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/flows/:id/executions', async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM flow_executions WHERE flow_id = $1 ORDER BY started_at DESC LIMIT 50`,
    [req.params.id]
  );
  res.json(rows);
});

app.get('/executions/:id/logs', async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM flow_execution_logs WHERE execution_id = $1 ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json(rows);
});

// Real inbound webhook entry point (public — see comment in webhookController.js)
app.use('/', webhookController);

const PORT = process.env.AUTOMATION_PORT || process.env.PORT || 4011;
app.listen(PORT, () => console.log(`automation-service on :${PORT}`));

module.exports = app;