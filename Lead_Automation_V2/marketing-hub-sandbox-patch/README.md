# Marketing Hub — Sandbox Mode Patch

This zip contains ONLY the files that changed — not the whole repo, not
node_modules. It mirrors your project's folder structure exactly, so you can
copy it straight on top of `Lead_Automation_V2/`.

## What's in here (11 files)

Backend (1 file):
- services/marketing-hub-service/src/routes/campaignsRouter.js
  → adds POST /:id/optimize (real, zero-dependency heuristic suggestions off
    a campaign's own metrics — no new npm packages, no new env vars)

Frontend (10 files):
- frontend/src/lib/queries/marketingHub.js
  → adds useOptimizeCampaign/useOptimizeBroadcast, useSandboxSetting/
    useSetSandboxSetting, useIntegrationsList, useConnectIntegration/
    useDisconnectIntegration
- frontend/src/components/marketing-hub/MarketingHub.jsx
  → passes onNavigate into Channels/Campaigns/Broadcasts so those pages can
    jump between tabs
- frontend/src/components/marketing-hub/prefill.js  (NEW)
  → tiny sessionStorage handoff so "Create Campaign" on the Channels page
    lands you in the Campaigns wizard with that channel pre-selected
- frontend/src/components/marketing-hub/export.js  (NEW)
  → zero-dependency CSV download + print-to-PDF helpers (uses the browser's
    own print dialog — "Save as PDF" — no jsPDF or similar added)
- frontend/src/components/marketing-hub/pages/MHBroadcasts.jsx
  → was 100% mock data, now fully wired to the real backend
- frontend/src/components/marketing-hub/pages/MHAudience.jsx
  → was 100% mock data, now fully wired (real tag-based audiences from
    contact-service)
- frontend/src/components/marketing-hub/pages/MHChannels.jsx
  → real connection status, working "Create Campaign"/"Create Broadcast"
    buttons that now navigate into the right tab with the channel preset
- frontend/src/components/marketing-hub/pages/MHCampaigns.jsx
  → toolbar buttons (Duplicate/Archive/Export/Report/AI Optimize) are now
    real instead of toast-only stubs; added a live activity feed and an
    AI Optimize panel to the campaign detail drawer
- frontend/src/components/marketing-hub/pages/MHDashboard.jsx
  → Export Report, Apply Suggestions, and View Details buttons now work
- frontend/src/components/marketing-hub/pages/MHSettings.jsx
  → added a real Sandbox Mode banner (reads/writes the DB) and wired the
    Integrations tab to real connect/disconnect

## How to apply

1. Unzip this file.
2. Copy the `Lead_Automation_V2/` folder from the zip on top of your project
   root, letting it overwrite the 11 files above. Example (from wherever you
   unzipped this):

   ```
   cp -r Lead_Automation_V2/* /path/to/your/Lead_Automation_V2/
   ```

   Or just drag-and-drop each file into its matching path if you'd rather
   review each change first — every path matches your existing project
   exactly.

3. **No `package.json` changes. No `Dockerfile` changes. No new
   dependencies.** Everything here uses libraries and backend routes that
   already existed in your project.

4. Rebuild and restart:

   ```
   docker compose build marketing-hub-service frontend
   docker compose up -d
   ```

   (Or `docker compose build && docker compose up -d` if you want to rebuild
   everything — either works, only these two services actually changed.)

## What changed, functionally

- **Channels tab**: "Create Campaign" / "Create Broadcast" on any channel
  card now actually takes you to that wizard with the channel pre-filled,
  instead of a toast saying "Opening…".
- **Broadcasts + Audience pages**: previously local mock state that reset on
  refresh. Now real Postgres-backed CRUD — an audience you create here
  immediately shows up in the Campaign/Broadcast wizard's audience dropdown.
- **Campaigns toolbar**: Duplicate, Archive, Export (CSV), Report (PDF via
  print dialog), and AI Optimize (heuristic suggestions from real campaign
  metrics) all do real things now. The old "Import" stub button was removed
  rather than left as a non-functional placeholder — happy to build a real
  CSV-to-audience importer as a follow-up if you want it.
- **Campaign drawer**: while a campaign is sending, you'll see a live
  "Delivered to X / Read by Y" activity feed sourced from the existing
  realtime socket infrastructure — nothing new on the backend, just finally
  surfaced in the UI.
- **Dashboard**: the 3 buttons that previously had no onClick at all now
  export a real report / navigate to Campaigns.
- **Settings**: a plain-language "Sandbox Mode" banner explains, in exactly
  one place in the whole app, that sends are simulated because no live
  WhatsApp/Meta/LinkedIn/SMS credentials are connected — and the
  Integrations tab's Connect/Disconnect buttons now persist to the real
  `mh_integrations` table instead of just flipping local component state.

## What's still mock data (not touched in this patch)

Content Studio, SEO, AEO, Marketing Calendar, Competitor Analysis, Assets
Library, Knowledge Base, and Analytics/Reports pages still use static mock
data — their backend routes already exist (see the earlier review), they
just weren't in scope for this pass. Same fix pattern applies to each: swap
the `../mockData` import for the matching real hook.

## Sanity-checked before packaging

- All plain `.js` files passed `node --check`.
- All `.jsx` files were checked for balanced brackets/braces/parens.
- No new npm dependencies were introduced anywhere in this patch.
