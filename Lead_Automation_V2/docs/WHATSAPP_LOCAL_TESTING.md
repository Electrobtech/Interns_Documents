# WhatsApp Local Testing — Ngrok + Postman

Verifies, end to end, on your own machine: the webhook receiver, the
automation/playbook engine, the live (Socket.io) chat updates in the
frontend, and the compliance guardrails (24h window, opt-out).

Prerequisite: `docker compose up` (or the equivalent services running
individually) — `postgres`, `redis`, `api-gateway`, `inbox-service`,
`automation-service`, `integration-service`, `frontend`.

---

## 1. Expose your local gateway with ngrok

Meta needs an HTTPS URL it can reach — `localhost` alone won't work, even
for sandbox/test numbers.

```bash
ngrok http 8080
```

Note the `https://<random-id>.ngrok-free.app` URL it gives you — every
webhook URL below is `<NGROK_URL>` + a path.

---

## 2. Register the webhook in Meta's dashboard

For a **real WhatsApp test number** (Meta Developer Portal → your app →
WhatsApp → Configuration):

- **Callback URL:** `https://<NGROK_URL>/automation/webhooks/<clientId>/whatsapp`
  - `<clientId>` is your organization's UUID in this CRM — grab it from the
    JWT after logging in (step 3 below), or from the `organizations` table.
  - This hits **automation-service**'s real playbook engine
    (`webhookController.js`), not integration-service's generic
    auto-reply — this is the path with the flow builder, opt-out
    handling, and the 24h-window check.
- **Verify token:** whatever you set `WHATSAPP_VERIFY_TOKEN` to in `.env` —
  the `GET` handler checks this on save.
- **Webhook fields:** subscribe to `messages`.

If you don't have a verified WhatsApp Business number yet, use Meta's
**Test Number** (auto-provisioned per app, free, no business verification
needed) — same callback URL setup, just send messages from WhatsApp on
your phone to that test number instead of a real one.

---

## 3. Log in and grab a bearer token

```bash
TOKEN=$(curl -s localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@electrobtech.com","password":"Admin@123"}' | jq -r .token)
echo $TOKEN
```

(Swap in your own seeded/created user if different — see `docs/TESTING.md`.)

Decode it at [jwt.io](https://jwt.io) if you need to confirm the
`organizationId` matches the `<clientId>` you put in the callback URL.

---

## 4. Simulate an inbound WhatsApp message (Postman or curl)

Rather than waiting on a real WhatsApp message, POST a Meta-shaped payload
straight at your ngrok URL — this is exactly what Meta's own servers send.

**Postman:** new `POST` request to
`https://<NGROK_URL>/automation/webhooks/<clientId>/whatsapp`, body raw
JSON:

```json
{
  "entry": [{
    "id": "WABA_ID_PLACEHOLDER",
    "changes": [{
      "value": {
        "messages": [{
          "from": "919000000001",
          "id": "wamid.TEST123",
          "type": "text",
          "text": { "body": "hi" }
        }]
      }
    }]
  }]
}
```

> Note: `automation-service`'s webhook route is intentionally
> **unauthenticated** (Meta can't send a CRM bearer token) and does not
> check the `X-Hub-Signature-256` header the way `integration-service`'s
> does — that's fine for this local-simulation path. If you're testing
> against `integration-service`'s `/webhook/meta` instead, you'll need a
> real signature (see §7) or it'll silently drop the payload.

Expect a `200` with a JSON body like:
```json
{ "status": "active", "sessionId": "...", "conversationId": "...", "templates": [...] }
```

`"hi"` should match your seeded `default` playbook's trigger keywords (see
`services/automation-service/src/seeds/*.json` — run `npm run seed` in
automation-service first if you haven't).

---

## 5. Verify the automation engine actually ran

```bash
curl -s "localhost:8080/conversations?channel=whatsapp" -H "Authorization: Bearer $TOKEN" | jq
```

You should see a conversation for contact `919000000001` with
`last_message_preview` showing the bot's reply. Grab its `id` and check
the full transcript:

```bash
curl -s "localhost:8080/conversations/<conversationId>" -H "Authorization: Bearer $TOKEN" | jq '.messages'
```

Both the inbound `"hi"` and the bot's outbound reply should be there.

---

## 6. Verify live updates in the frontend (Socket.io)

1. Open the CRM at `http://localhost:3000` (or wherever the frontend
   runs), log in, and navigate to **Channels → WhatsApp**, or
   **Inbox**, then open the conversation from step 5
   (`/app/channels/whatsapp/conversation/<id>`).
2. With that thread open, send another simulated inbound message (repeat
   step 4 with a different `"text.body"`, same `"from"`).
3. **Expected:** the new message appears in the open thread within a
   second or two, with no page refresh.
4. Now go back to the **Channels → WhatsApp** list (or Unified Inbox) view
   without a thread open, and repeat step 4 once more with a **new**
   `"from"` number (a brand-new contact).
5. **Expected:** a new conversation row appears in the list live.

If neither updates: check `inbox-service` logs for
`[realtime] Listening for new messages on messages_channel` (confirms the
Postgres LISTEN client connected) and your browser console for a
Socket.io connection error (confirms the gateway's `/socket.io` proxy and
JWT handshake are working — see `api-gateway/src/index.js` and
`services/inbox-service/src/realtime.js`).

---

## 7. Verify the 24-hour window guard

The check only bites when a message would be sent **outside** the window,
which a live simulated inbound turn (step 4) never triggers on its own —
the customer's own message you just sent always satisfies it. Exercise it
via a **campaign send** instead, against a conversation with no inbound
message at all (or one whose last inbound message you manually backdate):

```bash
# A conversationId that has never received an inbound message —
# use a freshly created contact with no messages, e.g. via POST /contacts,
# and note its external phone number as `externalId` below.
curl -s -X POST localhost:8080/automation/internal/campaign-send \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"channel":"whatsapp","externalId":"919000000099","body":"Hey, 20% off today!"}'
```

Expected: **HTTP 422** with a body like
`{"error":"This contact has never messaged in — only a pre-approved template message can open the conversation.","code":"outside_window_never_messaged"}`
— and a system-style line in that conversation's transcript noting the
block, instead of an attempted (and Meta-rejected) send.

To test the "was in-window, now expired" case instead of "never
messaged", backdate an existing message:

```sql
UPDATE messages SET created_at = now() - interval '25 hours'
 WHERE conversation_id = '<conversationId>' AND direction = 'inbound';
```
then repeat the campaign-send call above against that `externalId` —
expect `code: "outside_window"`.

---

## 8. Verify opt-out handling

Send a simulated inbound message with `"text.body": "stop"` (step 4's
payload, same `"from"` as an existing conversation). Then:

```bash
curl -s "localhost:8080/conversations/<conversationId>" -H "Authorization: Bearer $TOKEN" \
  | jq '.messages[-1]'   # should show the unsubscribe playbook's confirmation reply
```

Then send **another** simulated inbound message from that same `"from"`
number (any text) — expect the engine response to come back
`{"status":"opted_out","conversationId":"..."}` with **no** bot reply
logged this time.

Finally, try a campaign send to that same `externalId` — expect `HTTP 422`
with `code: "opted_out"`.

---

## 9. Verify rate-limit retry (optional, harder to trigger locally)

This is easiest to confirm by reading logs rather than forcing a real
429 from Meta. Temporarily point `WHATSAPP_CLOUD_API_TOKEN` at an invalid
value and send a message — you should see the **first** attempt fail with
a clear "invalid token" error and **no retries** (permanent failure, not
retryable). Real 429s during a genuine send burst will show up in
`automation-service`/`integration-service` logs as
`Cloud API rejected message (attempt 1/3)` followed by a retry — this is
expected behavior under real send volume, not a bug.

---

## Troubleshooting

- **Webhook returns 400 "Unsupported channel"** — check the `:channel`
  segment in your callback URL matches `whatsapp` exactly (case-sensitive).
- **Webhook returns 404 "No active playbook"** — run
  `npm run seed` in `services/automation-service` to create the default
  demo playbooks, or create one in Playbook Studio first.
- **ngrok URL changes every restart** — expected on the free tier; update
  the Meta callback URL each time, or use a reserved ngrok domain.
- **Socket.io connects then immediately disconnects** — usually an
  expired/invalid JWT in `localStorage`; log out and back in.
