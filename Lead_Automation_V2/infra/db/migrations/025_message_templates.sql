-- 025_message_templates.sql
--
-- NOTE ON HOW THIS ACTUALLY GETS APPLIED: docker-compose's postgres service
-- does NOT read this migrations/ directory at all — it mounts
-- infra/db/schema.sql, seed.sql, and rls.sql directly as
-- docker-entrypoint-initdb.d 01/02/03 (see docker-compose.yml). This file
-- is the readable, single-feature record of what changed (and what other
-- docs/code should cite — see e.g. 016_contact_opt_out.sql being cited
-- from docs/META_COMPLIANCE.md), but the table definition that a fresh
-- `docker compose up` actually creates lives in schema.sql, appended
-- verbatim from this file. If you change one, change both — the same
-- gap (023_products.sql existing here but never folded into schema.sql)
-- is exactly what made `/products` 500 on every call against a fresh
-- database until this pass.
--
-- Backs the Template Creation module (sidebar: Automation > Templates ->
-- frontend/src/app/app/campaigns/templates). This is a *local* template
-- library with its own review/approval workflow — distinct from
-- integration-service's POST /whatsapp/send-template, which sends a
-- message using a template name already approved on Meta's side. The two
-- meet at send time: campaign-service resolves a campaigns.template_id to
-- this table's `name` + `header`/`body`/`buttons` and hands that name to
-- integration-service's send-template call. Reconciling `status` here with
-- Meta's actual per-template review outcome (via WhatsApp Business
-- Management API / webhooks) is a follow-up, not part of this migration —
-- for now `status` starts at 'PENDING' and is moved by hand (the Approve/
-- Reject buttons on the Template Dashboard) or by whatever sync job is
-- added later.
--
-- Owned by campaign-service (routes: src/templates.js) for the same reason
-- products.js lives there — a template is a marketing object consumed by
-- the Bulk Campaign builder, so it belongs next to `campaigns`, not behind
-- a new microservice.

CREATE TABLE IF NOT EXISTS message_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name              TEXT NOT NULL,               -- auto-slugified, e.g. college_broadcast_17_6_26
  category          TEXT NOT NULL DEFAULT 'MARKETING',   -- MARKETING | UTILITY | AUTHENTICATION
  language          TEXT NOT NULL DEFAULT 'en_US',
  channels          TEXT[] NOT NULL DEFAULT '{WHATSAPP}', -- WHATSAPP | RCS | SMS | EMAIL (multi-tag)
  status            TEXT NOT NULL DEFAULT 'PENDING',      -- PENDING | APPROVED | REJECTED

  header_type       TEXT NOT NULL DEFAULT 'NONE',   -- NONE | TEXT | IMAGE | VIDEO | DOCUMENT
  header_text       TEXT,
  header_media_url  TEXT,

  body              TEXT NOT NULL DEFAULT '',
  body_variables    JSONB NOT NULL DEFAULT '{}',    -- {"1": "example value", "2": "..."}  (fills {{1}}, {{2}}… in previews)
  footer            TEXT,                            -- max 60 chars, enforced app-side

  -- Array of { type: 'QUICK_REPLY'|'PHONE_NUMBER'|'URL', text, value? }
  buttons           JSONB NOT NULL DEFAULT '[]',

  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_message_templates_org         ON message_templates (organization_id);
CREATE INDEX IF NOT EXISTS ix_message_templates_org_status  ON message_templates (organization_id, status);
-- GET /templates?channel=WHATSAPP&status=APPROVED (Bulk Campaign builder's
-- template picker) filters on both of these together.
CREATE INDEX IF NOT EXISTS ix_message_templates_channels    ON message_templates USING GIN (channels);

-- A campaign can be built directly from a saved template rather than free
-- text — nullable, since plenty of campaigns (and every non-WhatsApp
-- broadcast today) still just use campaigns.message_body directly.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_campaigns_template ON campaigns (template_id) WHERE template_id IS NOT NULL;
