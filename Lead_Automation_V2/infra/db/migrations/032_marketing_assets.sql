-- 032_marketing_assets.sql
--
-- NOTE ON HOW THIS ACTUALLY GETS APPLIED: docker-compose's postgres service
-- does NOT read this migrations/ directory at all — it mounts
-- infra/db/schema.sql, seed.sql, and rls.sql directly as
-- docker-entrypoint-initdb.d 01/02/03 (see docker-compose.yml). This file
-- is the readable, single-feature record of what changed, but the table
-- definition that a fresh `docker compose up` actually creates lives in
-- schema.sql, appended verbatim from this file. If you change one, change both.
--
-- Backs the Marketing Hub Assets Library
-- (frontend/src/components/marketing-hub/pages/MHAssetsLibrary.jsx).
-- File blobs live on local disk under marketing-hub-service's
-- public/uploads/marketing-assets (same pattern as campaign-service
-- templateMedia.js and automation-service mediaController.js). Metadata
-- and tenant scoping live here.
--
-- Owned by marketing-hub-service (routes: src/assets.js).

CREATE TABLE IF NOT EXISTS marketing_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name              TEXT NOT NULL,                 -- original filename
  type              TEXT NOT NULL CHECK (type IN (
                      'Logos', 'Images', 'Videos', 'PDFs', 'AI Generated Images'
                    )),
  size_bytes        BIGINT NOT NULL DEFAULT 0,
  storage_url       TEXT NOT NULL,                 -- GATEWAY_PUBLIC_URL-rooted URL
  mime_type         TEXT,

  uploaded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_marketing_assets_org
  ON marketing_assets (organization_id);
CREATE INDEX IF NOT EXISTS ix_marketing_assets_org_type
  ON marketing_assets (organization_id, type);
CREATE INDEX IF NOT EXISTS ix_marketing_assets_org_created
  ON marketing_assets (organization_id, created_at DESC);
