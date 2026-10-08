-- Hosted PostgreSQL does not automatically allow its administration login to
-- SET ROLE to newly-created NOLOGIN roles. Runtime transactions still use the
-- restricted role, never a browser/Data API role.
GRANT simulator_server TO postgres;
CREATE INDEX household_invitation_household ON simulator.household_invitations(world_id,household_id);
DO $$ DECLARE tab text; scope_column text; BEGIN
 FOR tab IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='simulator' LOOP
  scope_column:=CASE WHEN tab='worlds' THEN 'id' ELSE 'world_id' END;
  EXECUTE format('ALTER TABLE simulator.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER POLICY world_scope ON simulator.%I USING (%I=(SELECT current_setting(''simulator.world_id'',true))) WITH CHECK (%I=(SELECT current_setting(''simulator.world_id'',true)))',tab,scope_column,scope_column);
 END LOOP;
END $$;
