# Marketing Hub — Full Patch (crash fix + real data everywhere + 15-row seed)

## How to apply

```bash
cp -r Lead_Automation_V2/* /path/to/your/Lead_Automation_V2/
```

Then, because this includes a **new database init file** and an updated
`docker-compose.yml`, you need a clean Postgres volume for the seed data to
load (init scripts only run once, on an empty volume):

```bash
docker compose down -v          # -v removes the Postgres volume — do this
                                 # only if you don't have real data in it yet
docker compose build
docker compose up -d
```

If you already have real data in Postgres and don't want to wipe it, skip
`down -v` — everything except the new 15-row seed data will still apply
(the code fixes don't need a fresh volume, only the seed file does).

No new npm packages, no new environment variables beyond what's already in
your `.env` (this uses `GROQ_API_KEY`, which was already there).

---

## What changed in this round

1. **15 real rows in every Marketing Hub table, seeded automatically on
   first `docker compose up`** — `infra/db/02b-seed-marketing-hub.sql`
   (new file, ~490 lines). This is the main ask this round: a fresh clone
   of your project now shows real data in every tab instead of empty
   states. Specifically it adds:
   - 30 more tagged contacts (so audience tag-filtering has something
     real to match — the original seed only had 6 contacts)
   - 15 audiences, tag-based, with **real** `size_cached` counts (computed
     from the actual contacts, not made up)
   - 15 campaigns/broadcasts across every channel and status
   - Real recipient rows + delivery events for each — **the sent/
     delivered/read/replied/failed counters shown on screen are rolled up
     from these actual rows**, not separately-invented numbers that could
     drift out of sync
   - 15 rows each in Assets, Templates, Content Studio, SEO Keywords, SEO
     Audits, AEO Optimizations, Calendar Events, Knowledge Articles
   - 15 competitors + one real analysis run per competitor
   - Sandbox Mode defaulted **on**, General/Notifications/AI Config
     defaults, and 15 integration rows (only the LLM one starts "active" —
     everything else honestly starts "not connected" until you add real
     credentials)
   - `docker-compose.yml` updated to mount this file into
     `docker-entrypoint-initdb.d` right after the existing seed.sql

2. **Settings — General / Notifications / AI Config tabs now actually
   save.** Previously all three just showed a toast and reset on refresh.
   They now read/write real rows in `mh_settings` via the same generic
   category/key store Sandbox Mode already used. (AI Config's model
   dropdown is honestly labeled: it saves for real, but Content Studio
   currently always calls whatever model is set server-side via
   `GROQ_MODEL` — wiring the dropdown into actual generation calls is
   further work, not done this round.)

3. **Settings → Team → Remove member** now actually removes the row (was
   a toast with no effect). Note: team membership isn't a `mh_` table —
   it's core-platform data, so this is a local-state fix, not a backend
   one; a full fix would live outside marketing-hub-service.

4. **Marketing Calendar** — Prev/Next/Today now actually navigate (was
   hardcoded to August 2025 with toast-only arrows). Wired to real
   `GET /calendar/view/month` and shows real seeded events; Add/Delete
   Event are real too.

5. **Channels — date-range picker actually filters now.** Added `?days=`
   support to `GET /channels/stats` and wired the dropdown to it (was
   toast-only, counts were always all-time regardless of selection).

6. **Assets Library** — real file upload (multipart, actual file goes to
   disk + a row in `mh_assets`), real View/Download (fetches with the
   auth header client-side, since it's a direct binary stream), real
   delete. Note: the 15 seeded asset rows reference file paths that don't
   exist on disk (we seeded metadata, not real binary files) — View/
   Download on those will show a clear "file not found" message; anything
   you actually upload works end-to-end.

7. **Knowledge Base** — real article list/search/create/delete/helpful-vote
   against `routes/knowledge.js` (was 100% static mock data).

8. **AI Agents ↔ Marketing Hub unification** (carried over from the
   previous patch, included here for completeness): "Convert to campaign"
   in AI Agents → Marketing → Campaign Planner now creates a real draft in
   the same `mh_campaigns` table Marketing Hub's Campaigns page reads —
   previously it silently wrote to a different, older `campaign-service`
   table nobody's UI reads from.

### Carried over from earlier rounds (already applied if you took those zips)
- The crash fix: 10 route files (`aeo`, `analytics`, `assets`, `calendar`,
  `competitors`, `content`, `knowledge`, `seo`, `settings`, `templates`)
  called an `authorize()` function that doesn't exist in `@lead/shared` —
  this crashed the entire service on boot. Fixed to `requirePermission`,
  plus `req.organizationId` → `req.user.organizationId`, plus removed a
  wrongly-signatured `withTenantScope` middleware call.
- RLS gap: 12 newer `mh_*` tables had zero row-level-security policy.
  Added.
- Content Studio's "Generate" now calls a real LLM (Groq, via
  `services/llmClient.js`) instead of a hardcoded template.
- Broadcasts, Audience, Campaigns toolbar, Dashboard buttons, SEO, AEO,
  Competitor Analysis all rewired from mock data to real hooks.

---

## Walkthrough — what each tab looks like and does now

**Dashboard** — KPI cards and the AI summary card are still static sample
numbers (not wired to real aggregates yet — flagged below). Export
Report, Apply Suggestions, and View Details buttons all do something real
now (CSV export / honest toast / navigate to Campaigns) instead of nothing.

**Campaigns** — the one page that was already solid. 4-step create
wizard (Basics → Budget & Schedule → Audience & Message → Review), real
Postgres persistence, live delivery-simulator counts. Toolbar: Duplicate,
Archive, Export (CSV), and AI Optimize all work for real; AI Optimize
calls the LLM over the campaign's actual metrics first, falls back to a
deterministic heuristic only if the LLM call fails.

**Broadcasts** — same real wizard/persistence pattern as Campaigns, just
simpler (no budget/objective, no LinkedIn). 15 seeded rows to look at
immediately.

**Audience** — build audiences from real contact tags (pulled live from
contact-service), with a real size estimate — not a random number.

**Channels** — real per-channel campaign/broadcast counts, real
connection status per channel (all "Not Connected" until you add
credentials in Settings), working Create Campaign/Broadcast buttons that
jump into the right wizard with the channel pre-selected. Date-range
picker now actually filters the counts shown.

**Content Studio** — pick a campaign type/industry/goal, hit Generate:
this is a real LLM call now, not hardcoded text. Save persists to a real
content library; Recent Generations shows what you've actually saved.

**Marketing Calendar** — real month grid with working Prev/Next/Today,
real events (15 seeded), Add/Delete Event both persist.

**SEO** — real keyword tracking (add/remove/filter) and real audit runs
against Postgres. Search volume/rank/difficulty numbers are simulated per
keyword (no real search-console key connected), but every keyword and
audit you see is a real saved row, not static mock data.

**AEO** — redesigned this round around what the database actually models
(per-query optimization), since the old page showed a fabricated global
"ChatGPT/Gemini/Claude visibility score" with nothing backing it. Enter a
query, pick an answer type, and it generates a real LLM-optimized answer
you can save and reuse.

**Competitor Analysis** — add competitors, run SEO/content/social
analysis per one, get real recommendations. Metrics inside each analysis
are simulated (no SEMrush/Ahrefs-style key connected) but every
competitor and every analysis run is a real saved row.

**Assets Library** — real upload/view/download/delete now. 15 seeded rows
show metadata immediately; View/Download on those specifically will note
there's no real file behind them (we didn't seed actual binary files) —
anything you upload yourself works fully.

**Knowledge Base** — real articles now (15 seeded), with working
search/create/delete/helpful-vote.

**Settings** — Sandbox Mode banner (real, reads/writes DB), Integrations
tab (real connect/disconnect), and now General/Notifications/AI Config
tabs all persist for real too. Team tab's Remove button now works
(locally — team membership isn't Marketing Hub's data to own).

**Reports** — still not wired. This is the one tab that needs a genuinely
new backend route built first (there's no `routes/reports.js` at all
yet), not just a frontend swap — bigger lift than everything else on this
list, intentionally left for a following round.

**Analytics** — still static mock charts end-to-end. Same "swap the
import for a real hook" pattern as everything above would apply once
prioritized — just didn't fit in this round.

---

## What's still not done, ranked by how much it'd matter next

1. **Reports** — needs a new backend route (aggregate query across
   campaigns/broadcasts/content), then frontend wiring.
2. **Analytics** — same pattern as SEO/Competitor Analysis, just hasn't
   been done yet.
3. **Dashboard's KPI cards/AI summary** — still static; would need either
   a new aggregate route or reuse of Analytics' once that exists.
4. **AI Config's model dropdown** — saves for real now, but doesn't yet
   change which model Content Studio/AI Optimize actually call.
