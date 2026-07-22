# Instagram Sandbox Setup (Creator account, no WhatsApp Business verification needed)
 
Goal: get real Instagram DMs hitting your local `automation-service` webhook
so you can test the flow builder end-to-end, without waiting on WhatsApp
Business API verification.
 
## 1. Convert to a Creator account
1. Open Instagram (mobile app) on the test account you'll use for sandbox messaging.
2. Settings → Account type and tools → Switch to Professional Account.
3. Choose **Creator** (not Business — Creator is enough for the Sandbox Messaging API and has no business-verification gate).
4. Pick any category; skip contact-info prompts.
## 2. Link a Facebook Page
Instagram messaging via the Graph API is always brokered through a linked Page.
1. Create a placeholder Facebook Page if you don't have one (facebook.com/pages/create).
2. In Instagram: Settings → Account → Linked accounts → Facebook → connect the Page you just created.
## 3. Create the Meta app + bind Instagram Graph API
1. developers.facebook.com → My Apps → Create App → type **Business**.
2. Add product: **Instagram Graph API** (not the older Basic Display API — that one can't send/receive messages).
3. App settings → Basic: note the App ID / App Secret.
4. Under the Instagram product → API setup with Instagram business login, add your Creator account as a **Sandbox Instagram Tester** and accept the invite from the Instagram app (Settings → Apps and websites → Tester invites).
5. Generate a **Page Access Token** (Graph API Explorer or the product's setup screen), selecting the linked Page and the scopes: `instagram_basic`, `instagram_manage_messages`, `pages_messaging`.
   - This token is short-lived by default — exchange it for a long-lived token (`GET /oauth/access_token?grant_type=fb_exchange_token...`) before putting it in `INSTAGRAM_PAGE_ACCESS_TOKEN`, or it'll expire mid-testing.
6. Webhooks → subscribe the app to the Page, field: **messaging** (the same field WhatsApp/Messenger use — this is what delivers `entry[].messaging[]` to your callback).
7. Callback URL: point it at your public tunnel (e.g. `https://<ngrok-id>.ngrok.io/automation/webhooks/<clientId>/instagram`) since Meta requires an HTTPS URL it can reach — localhost alone won't work here, ngrok/cloudflared is required even for sandbox testing.
8. Verify token: whatever you put in `INSTAGRAM_VERIFY_TOKEN` — the GET handler in `webhookController.js` checks this against Meta's handshake automatically.
## 4. Env vars to set
```
INSTAGRAM_PAGE_ACCESS_TOKEN=<the long-lived Page token from step 3.5>
INSTAGRAM_VERIFY_TOKEN=<any string you choose, must match what you type into the Meta webhook config>
```
 
## 5. Smoke test
1. DM the linked Instagram account from a different personal account (has to be a *different* account — Meta will not deliver a Page's own messages back to itself).
2. Check `automation-service` logs for the POST to `/automation/webhooks/:clientId/instagram`.
3. Confirm a `ConversationSession` document was created with `channel: 'instagram'`.
 
