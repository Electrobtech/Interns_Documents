# WhatsApp / Meta Messaging Compliance — Do's and Don'ts

This covers the rules Meta actively enforces on the WhatsApp Business
Platform (and, where noted, Instagram/Messenger). Violating these doesn't
just fail a single API call — repeated or severe violations get your
number **quality-rated down**, **rate-limited**, or the phone number /
WABA **banned outright**. Everyone touching Playbook Studio, campaigns, or
the webhook/automation code should read this once.

Where relevant, this notes what's already enforced in code (see
`services/automation-service/src/services/complianceGuard.js`) versus what
still depends on a human following the rule.

---

## 1. The 24-hour customer service window

**Rule:** You may only send free-form (non-template) messages to a contact
within 24 hours of their **last inbound message** to you. Outside that
window, WhatsApp will reject anything that isn't a pre-approved **message
template**.

✅ **Do**
- Treat every inbound message as resetting a 24-hour clock for that contact.
- Use approved message templates for anything sent outside the window —
  order updates, appointment reminders, re-engagement, abandoned-cart
  nudges, etc.
- Design playbooks so the bot's replies happen inside the same turn as the
  triggering inbound message (this is how the flow engine already works —
  see `processInboundEvent` in `webhookController.js`).

🚫 **Don't**
- Don't queue a delayed follow-up ("wait 2 days, then message again") as a
  free-form send — it will be outside the window and get rejected, or
  silently blocked by `complianceGuard.checkSendAllowed()` if the rest of
  this codebase's guard is in place. Build a template for it instead.
- Don't try to "restart the clock" by sending the customer something and
  hoping they reply — that's not how the window works; only *their*
  message extends it.

**In code:** `complianceGuard.checkSendAllowed()` checks this before every
send from the playbook engine (`webhookController.js`) and every campaign
broadcast (`campaignSendController.js`), and blocks the send with a clear
reason instead of letting Meta 4xx it. **Caveat:** nothing in this
codebase currently sends real, pre-approved Meta templates (`type:
'template'`) — the flow builder only produces free-form text/interactive/
document messages. That means today, a contact who's outside the window
simply **cannot** be reached by a campaign or a delayed flow step at all.
Adding real template support (template name + approved variables) to
`buildSendTemplate()` and the campaign send path is the real fix — until
then, treat "outside window" as a hard stop, not something to work around.

---

## 2. Opt-in and opt-out

**Rule:** You need a clear opt-in before messaging someone on WhatsApp for
business/marketing purposes (them messaging you first, or an explicit
opt-in flow, both count). Once someone opts out, you must stop.

✅ **Do**
- Let an inbound message from a contact count as opt-in for replying to
  *that conversation* — this is standard and how the playbook engine
  already treats it.
- Honor STOP/UNSUBSCRIBE/"opt out" (and similar phrasing) immediately —
  send at most one confirmation, then stop.
- For proactive/campaign sends to contacts who didn't message you first,
  make sure there's a real opt-in on record (a signup form, a checkbox, an
  explicit "yes, message me on WhatsApp") before adding them to a campaign
  list.

🚫 **Don't**
- Don't keep sending campaign messages to a contact who has opted out,
  even if it's a "different" campaign or a different playbook — the
  opt-out is per-contact, not per-flow.
- Don't add someone to a WhatsApp campaign list just because they exist
  as a CRM contact from another channel (email, a lead form) without a
  WhatsApp-specific opt-in.

**In code:** `contacts.opted_out` / `opted_out_at` (see
`infra/db/migrations/014_contact_opt_out.sql`) persist the opt-out.
`resolvePlaybook()` already routes a STOP-style keyword to the
`unsubscribe` playbook role for that turn's confirmation reply;
`complianceGuard.recordOptOut()` then flips the flag right after that
reply sends, which blocks every future playbook turn (`processInboundEvent`
short-circuits to `status: 'opted_out'` with no reply at all) and every
future campaign send (`campaignSendController.js` returns a 422 instead of
attempting delivery). This is enforced identically in
`integration-service`'s generic auto-reply path
(`webhookWorker.js`), which writes to the same `contacts.opted_out` column.

---

## 3. Message templates

**Rule:** Any message template you want to use outside the 24-hour window
must be submitted to Meta and approved before use. Templates get
categorized (Marketing / Utility / Authentication) and Meta reviews both
the content and the category you claimed.

✅ **Do**
- Keep template copy close to what you submitted — Meta can reject or
  disable a template if the live content drifts from what was approved.
- Pick the correct category honestly. Utility/Authentication templates get
  better deliverability and pricing, but only for their actual use case
  (e.g. OTPs, order confirmations, appointment reminders) — mis-tagging a
  marketing blast as "utility" is a common way to get flagged.
- Keep variable placeholders (`{{1}}`, `{{2}}`, etc.) filled with real,
  relevant values at send time — Meta's review assumes realistic sample
  data.

🚫 **Don't**
- Don't submit vague or overly generic templates ("Hi {{1}}, check this
  out!") — these get rejected more often and looked at more closely later.
- Don't reuse an approved template for a purpose it wasn't approved for
  (e.g. an approved "your order has shipped" utility template repurposed
  to announce a sale).

---

## 4. Quality rating & messaging limits

**Rule:** Meta tracks a rolling **quality rating** (High / Medium / Low)
per phone number, driven by block rates, reports, and negative feedback.
Your **messaging tier** (how many unique users you can contact in a
rolling 24h window — starts at 250/day and scales up) is gated by that
rating, and a number that drops to Low quality can be rate-limited or
paused entirely by Meta.

✅ **Do**
- Only message people who actually expect to hear from you (see §2) —
  block/report rate is the single biggest quality-rating driver.
- Keep automated replies relevant to what the customer actually asked;
  vague/canned replies to unrelated questions increase blocks.
- Watch the phone number's quality rating in Meta Business Manager
  regularly, not just when something breaks (`getPhoneNumberProfile()` in
  `whatsappService.js` can pull `quality_rating` programmatically if you
  want to surface it in the CRM).
- Ramp up new campaign volume gradually rather than blasting your full
  contact list on day one of a new number.

🚫 **Don't**
- Don't buy or scrape contact lists and message them cold — this is the
  fastest way to a banned number.
- Don't ignore a quality-rating drop and keep sending at the same volume;
  back off and investigate what triggered it first.

---

## 5. Rate limits and retries

**Rule:** The Cloud API enforces per-number and per-app rate limits
(HTTP 429, and Graph API error codes like `4`, `80007`, `130429`,
`131048`). These are throttling, not permanent rejections — the right
response is to back off and retry, not to treat every failure as fatal.

✅ **Do**
- Retry transient failures (429, 5xx, the rate-limit error codes above)
  with exponential backoff, honoring `Retry-After` when Meta sends it —
  this is already built into `whatsappSender.js` (automation-service) and
  `whatsappService.js` (integration-service)'s `graphPost` helper.
- Treat permanent failures (invalid recipient, template not found, bad
  parameters, expired token) as final — retrying those just wastes calls
  and delays the real error surfacing.
- Batch/throttle campaign sends rather than firing the entire recipient
  list in a tight loop.

🚫 **Don't**
- Don't retry indefinitely — a small bounded number of attempts (this
  codebase uses 3) with backoff. If it's still failing after that, surface
  the error and stop.
- Don't treat a rate-limit response as a signal to send *faster* on the
  assumption "it'll get through eventually" — back off.

---

## 6. General platform hygiene

✅ **Do**
- Keep the webhook signature check (`X-Hub-Signature-256`, verified in
  `integration-service`'s `webhookController.js`) in place — never disable
  it, even for local debugging (use `curl`/Postman payloads for that
  instead, not by relaxing production signature checks).
- Keep access tokens and the App Secret out of source control — this repo
  already keeps them in `.env` (see `.env.example`), never hardcode them.
- Review Meta's own policy pages periodically — this document reflects
  the rules as understood at time of writing; Meta updates its Commerce
  Policy and WhatsApp Business Messaging Policy independently of this
  codebase.

🚫 **Don't**
- Don't disable or bypass the compliance checks in
  `complianceGuard.js` "just for a demo" against a real, verified WABA —
  use the Meta sandbox/test number for that instead (see
  `docs/META_SANDBOX.md` and `docs/WHATSAPP_LOCAL_TESTING.md`).
- Don't assume a passing local test means Meta will accept the same call
  in production — sandbox numbers and test templates have looser
  restrictions than a live, verified business number.

---

## Quick reference: where each rule lives in code

| Rule | Enforced in |
|---|---|
| 24-hour window | `services/automation-service/src/services/complianceGuard.js` → `checkSendAllowed()` |
| Opt-out persistence | `contacts.opted_out` (`infra/db/migrations/014_contact_opt_out.sql`) |
| Opt-out enforcement (playbook engine) | `webhookController.js` → `processInboundEvent()` |
| Opt-out enforcement (campaigns) | `campaignSendController.js` |
| Opt-out enforcement (generic auto-reply) | `integration-service/src/services/webhookWorker.js` |
| STOP/keyword detection | `webhookController.js` → `resolvePlaybook()`, `complianceGuard.js` → `isOptOutText()` |
| Rate-limit retry/backoff | `automation-service/src/services/whatsappSender.js`, `integration-service/src/services/whatsappService.js` |
| Webhook signature verification | `integration-service/src/controllers/webhookController.js` → `isValidSignature()` |
