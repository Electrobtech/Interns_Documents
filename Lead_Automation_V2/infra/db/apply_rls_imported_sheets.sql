-- Standalone RLS grant for imported_sheets only — safe to run even though
-- rls.sql's full loop fails partway through on unrelated pre-existing
-- tables missing from this database (channel_quotas, etc). Mirrors the
-- exact policy shape that loop would have applied to imported_sheets.
ALTER TABLE imported_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_sheets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON imported_sheets;
CREATE POLICY tenant_isolation ON imported_sheets
  USING      (app_rls_bypass() OR organization_id = app_current_org())
  WITH CHECK (app_rls_bypass() OR organization_id = app_current_org());