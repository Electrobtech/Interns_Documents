// services/automation-service/src/controllers/playbookController.js
//
// Gives the Playbook Studio (frontend/src/components/automation/
// PlaybookStudioApp.jsx) a real backend to read from and autosave to,
// instead of the browser's localStorage. This is what makes a flow built
// on one laptop show up automatically on another: the canvas graph is now
// the same PostgreSQL row (`playbooks`) the engine itself reads at runtime
// (see playbookRepository.js / infra/db/schema.sql), not a browser-local
// cache — so `git clone` + a shared DATABASE_URL is all a second machine
// needs to see the identical flow, nodes, branches, and uploaded document
// references.

const express = require('express');
const playbookRepository = require('../repositories/playbookRepository');

const router = express.Router();

// GET /automation/playbooks/:id
// Scoped to the caller's own organization — a playbook id existing at all
// doesn't mean this user's org owns it, so a cross-tenant guess still 404s.
router.get('/automation/playbooks/:id', async (req, res) => {
  try {
    const playbook = await playbookRepository.findById(req.params.id);
    if (!playbook || playbook.clientId !== req.user.organizationId) {
      return res.status(404).json({ error: 'Playbook not found' });
    }
    res.status(200).json(playbook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /automation/playbooks/:id
// Upsert (create-or-update) the whole canvas in one atomic write — called
// by PlaybookStudioApp's debounced autosave on every graph/title edit.
// Body shape matches FlowBuilder's exportFlowJson() output plus a couple of
// top-level fields the builder doesn't track (channels/playbookType/status),
// which the frontend fills in from its own `channel` prop.
router.put('/automation/playbooks/:id', async (req, res) => {
  try {
    const { name, entryNodeId, nodes, channels, playbookType, status, triggerKeywords, globalLimits } = req.body;

    if (!name || !entryNodeId || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'name, entryNodeId, and nodes[] are required.' });
    }

    // If a playbook already exists at this id, only its own org may
    // overwrite it — prevents one organization's autosave from clobbering
    // another's playbook even if they somehow reused the same id.
    const existing = await playbookRepository.findById(req.params.id);
    if (existing && existing.clientId !== req.user.organizationId) {
      return res.status(403).json({ error: 'This playbook belongs to a different organization.' });
    }

    const saved = await playbookRepository.upsert({
      id: req.params.id,
      clientId: req.user.organizationId,
      name,
      channels: channels || existing?.channels || [],
      playbookType: playbookType || existing?.playbookType || 'standard',
      triggerKeywords: triggerKeywords || existing?.triggerKeywords || [],
      status: status || existing?.status || 'draft',
      entryNodeId,
      globalLimits: globalLimits || existing?.globalLimits || {},
      nodes,
    });

    res.status(200).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
