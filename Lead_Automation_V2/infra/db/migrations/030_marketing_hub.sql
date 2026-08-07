-- Marketing Hub backend — see infra/db/schema.sql's "Marketing Hub" section
-- for the same DDL with full comments (this repo folds every migration's
-- DDL directly into schema.sql, since only schema.sql/seed.sql/rls.sql are
-- mounted into docker-entrypoint-initdb.d and run on a fresh volume; this
-- file exists purely as a historical record of when/why).

CREATE TABLE IF NOT EXISTS mh_audiences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'custom',
  filter            JSONB NOT NULL DEFAULT '{}',
  size_cached       INT,
  size_computed_at  TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'active',
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_mh_audiences_org ON mh_audiences (organization_id);

CREATE TABLE IF NOT EXISTS mh_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('campaign','broadcast')),
  name              TEXT NOT NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('whatsapp','email','sms','messenger','instagram','linkedin')),
  objective         TEXT,
  audience_id       UUID REFERENCES mh_audiences(id) ON DELETE SET NULL,
  message_body      TEXT,
  budget_amount     NUMERIC(12,2),
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','scheduled','queued','processing','completed','failed','paused','archived')),
  scheduled_at      TIMESTAMPTZ,
  start_date        DATE,
  end_date          DATE,
  total_recipients  INT NOT NULL DEFAULT 0,
  sent_count        INT NOT NULL DEFAULT 0,
  delivered_count   INT NOT NULL DEFAULT 0,
  read_count        INT NOT NULL DEFAULT 0,
  replied_count     INT NOT NULL DEFAULT 0,
  failed_count      INT NOT NULL DEFAULT 0,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mh_no_linkedin_broadcast CHECK (NOT (channel = 'linkedin' AND kind = 'broadcast'))
);
CREATE INDEX IF NOT EXISTS ix_mh_campaigns_org_kind_status ON mh_campaigns (organization_id, kind, status);
CREATE INDEX IF NOT EXISTS ix_mh_campaigns_audience ON mh_campaigns (audience_id) WHERE audience_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mh_recipients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES mh_campaigns(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  channel             TEXT NOT NULL,
  destination         TEXT NOT NULL,
  display_name        TEXT,
  rendered_message    TEXT,
  status              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','sending','sent','delivered','read','replied','failed')),
  attempts            INT NOT NULL DEFAULT 0,
  error               TEXT,
  job_id              TEXT,
  provider_message_id TEXT,
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  replied_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_mh_recipients_campaign_status ON mh_recipients (campaign_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_mh_recipients_campaign_destination ON mh_recipients (campaign_id, destination);

CREATE TABLE IF NOT EXISTS mh_delivery_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES mh_recipients(id) ON DELETE CASCADE,
  campaign_id   UUID NOT NULL REFERENCES mh_campaigns(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN ('queued','sending','sent','delivered','read','replied','failed')),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload       JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS ix_mh_delivery_events_campaign ON mh_delivery_events (campaign_id, occurred_at);

CREATE OR REPLACE FUNCTION notify_mh_recipient_update() RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id FROM mh_campaigns WHERE id = NEW.campaign_id;
  PERFORM pg_notify(
    'marketing_hub_channel',
    json_build_object(
      'recipient_id', NEW.id,
      'campaign_id', NEW.campaign_id,
      'organization_id', org_id,
      'status', NEW.status
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mh_recipients_notify_trigger ON mh_recipients;
CREATE TRIGGER mh_recipients_notify_trigger
  AFTER INSERT OR UPDATE OF status ON mh_recipients
  FOR EACH ROW EXECUTE FUNCTION notify_mh_recipient_update();
