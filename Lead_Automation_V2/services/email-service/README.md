# email-service

Gmail integration for the Unified Inbox — OAuth connect, receive (Pub/Sub
push + polling fallback), send/reply with threading, and attachments.
Outlook/IMAP/SMTP are intentionally out of scope for now (see
`Email_Integration_Prompt.md`'s original spec if that's ever revisited).

## Endpoints

| Method | Path                                   | Notes |
|---|---|---|
| GET  | `/email/auth/connect-url`                | Returns the Google consent URL (JWT required) |
| GET  | `/email/auth/callback`                   | Public — Google's OAuth redirect target |
| POST | `/email/auth/:id/disconnect`             | Admin only |
| GET  | `/email/accounts`                        | List connected mailboxes for the org |
| GET  | `/email/accounts/:id`                    | |
| PUT  | `/email/accounts/:id`                    | Update `signatureHtml` |
| POST | `/email/accounts/:id/sync`               | Manual re-sync |
| GET  | `/email/threads`                         | List threads, optional `?accountId=` |
| GET  | `/email/threads/:id`                     | Thread + all messages + attachments |
| POST | `/email/messages/send`                   | multipart/form-data: `meta` (JSON) + `attachments[]` |
| POST | `/email/messages/reply`                  | multipart/form-data: `meta` (JSON) + `attachments[]` |
| GET  | `/email/attachments/:id/download`        | Lazily fetches bytes from Gmail on first request |
| POST | `/webhook/gmail`                         | Public — Cloud Pub/Sub push target |

A summarized copy of every thread/message is also mirrored into the
shared `conversations`/`messages` tables (`channel_type='email'`), so
connected mailboxes show up in `inbox-service`'s Unified Inbox exactly
like WhatsApp/Instagram/Facebook. Full-fidelity data (headers, HTML
bodies, attachments) lives in `email_threads`/`email_messages`/
`email_attachments` — see `infra/db/migrations/013_email_integration.sql`.

## Receiving email

Preferred path: Gmail `users.watch()` → Cloud Pub/Sub → `POST /webhook/gmail`
→ `syncService.incrementalSync()` (via `users.history.list`). Requires
`GMAIL_PUBSUB_TOPIC` to be set; `services/watchJob.js` registers/renews the
watch lease (max 7 days) daily.

Fallback path: `services/pollWorker.js` runs `incrementalSync()` for every
connected mailbox every `EMAIL_POLL_INTERVAL_MINUTES` (default 5),
regardless of whether Pub/Sub is configured — cheap insurance against a
missed push, and the only sync path at all if `GMAIL_PUBSUB_TOPIC` is unset.

## Setup

1. Create a Google Cloud project, enable the Gmail API.
2. Configure the OAuth consent screen, create an OAuth Client ID (Web
   application), and set the redirect URI to
   `<gateway-public-url>/email/auth/callback`.
3. (Optional, for real-time push) Create a Cloud Pub/Sub topic, grant
   `gmail-api-push@system.gserviceaccount.com` the Pub/Sub Publisher role
   on it, and create a push subscription pointed at
   `<gateway-public-url>/webhook/gmail?token=<GMAIL_PUBSUB_VERIFY_TOKEN>`.
4. Fill in the `GMAIL_*` variables in `.env` (see `.env.example`).
5. `docker compose up --build email-service`

## Extending

- **Outlook**: same shape (routes/auth.js + services/gmailApi.js analogues
  using Microsoft Graph, `provider='outlook'` on `email_accounts`) —
  `emailConversationStore.js`, the mirrored `conversations`/`messages`
  write-through, and the send/reply routes' multipart contract wouldn't
  need to change.
- **Per-tenant Google OAuth client**: review-service's
  `src/google/configStore.js` has the pattern (encrypted per-org client
  secret, falling back to the global env pair) if a customer ever needs
  to bring their own Google Cloud project instead of consenting through
  the platform's shared one.
