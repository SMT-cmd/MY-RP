CREATE TABLE simulator.client_sessions (
 world_id text NOT NULL REFERENCES simulator.worlds(id),
 actor_id text NOT NULL,
 data jsonb NOT NULL,
 epoch bigint NOT NULL CHECK(epoch BETWEEN 1 AND 9007199254740991),
 PRIMARY KEY(world_id,actor_id),
 CHECK(data->>'actor'=actor_id AND (data->>'epoch')::bigint=epoch)
);
ALTER TABLE simulator.client_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator.client_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY world_scope ON simulator.client_sessions USING(world_id=(SELECT current_setting('simulator.world_id',true))) WITH CHECK(world_id=(SELECT current_setting('simulator.world_id',true)) AND actor_id=(SELECT current_setting('simulator.actor_id',true)));
REVOKE ALL ON simulator.client_sessions FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON simulator.client_sessions TO simulator_server;

CREATE FUNCTION simulator.client_session_monotonic() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
BEGIN
 IF NEW.world_id IS DISTINCT FROM OLD.world_id OR NEW.actor_id IS DISTINCT FROM OLD.actor_id OR NEW.epoch<OLD.epoch OR NEW.epoch>OLD.epoch+1
  OR (NEW.epoch=OLD.epoch AND (NEW.data->>'clientId' IS DISTINCT FROM OLD.data->>'clientId' OR NEW.data->>'sessionId' IS DISTINCT FROM OLD.data->>'sessionId' OR NEW.data->>'claimId' IS DISTINCT FROM OLD.data->>'claimId'))
  OR (NEW.data->>'lastSeenAt')::bigint<(OLD.data->>'lastSeenAt')::bigint THEN RAISE EXCEPTION 'Client fencing version or identity cannot be reversed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER client_session_version BEFORE UPDATE ON simulator.client_sessions FOR EACH ROW EXECUTE FUNCTION simulator.client_session_monotonic();

CREATE FUNCTION simulator.client_sessions_reconcile() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE s jsonb; actor text; lease jsonb; cached jsonb; w text;
BEGIN
 IF TG_TABLE_NAME='worlds' THEN s:=NEW.state;w:=NEW.id; ELSE w:=NEW.world_id;SELECT state INTO s FROM simulator.worlds WHERE id=w; END IF;
 IF s ? 'sessions' AND (jsonb_typeof(s->'sessions') IS DISTINCT FROM 'object' OR jsonb_typeof(s->'sessions'->'leases') IS DISTINCT FROM 'object' OR jsonb_typeof(s->'sessions'->'revoked') IS DISTINCT FROM 'object') THEN RAISE EXCEPTION 'Invalid client session state'; END IF;
 FOR actor,lease IN SELECT key,value FROM jsonb_each(COALESCE(s->'sessions'->'leases','{}'::jsonb)) LOOP
  IF jsonb_typeof(lease) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid client lease'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(lease))<>8 OR lease->>'actor' IS DISTINCT FROM actor OR actor!~'^[a-zA-Z0-9_-]{3,80}$' OR actor IN ('__proto__','constructor','prototype')
   OR COALESCE(lease->>'clientId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   OR COALESCE(lease->>'claimId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   OR COALESCE(lease->>'sessionId','')!~'^[a-zA-Z0-9_-]{3,100}$' OR COALESCE(lease->>'status','') NOT IN ('active','released')
   OR jsonb_typeof(lease->'epoch') IS DISTINCT FROM 'number' OR (lease->>'epoch')::numeric<>trunc((lease->>'epoch')::numeric) OR (lease->>'epoch')::numeric NOT BETWEEN 1 AND 9007199254740991
   OR jsonb_typeof(lease->'lastSeenAt') IS DISTINCT FROM 'number' OR (lease->>'lastSeenAt')::numeric<>trunc((lease->>'lastSeenAt')::numeric) OR (lease->>'lastSeenAt')::numeric NOT BETWEEN 0 AND 9007199254740991
   OR jsonb_typeof(lease->'expiresAt') IS DISTINCT FROM 'number' OR (lease->>'expiresAt')::numeric<>trunc((lease->>'expiresAt')::numeric) OR (lease->>'expiresAt')::numeric NOT BETWEEN 0 AND 9007199254740991
   OR (lease->>'expiresAt')::bigint-(lease->>'lastSeenAt')::bigint NOT BETWEEN 0 AND 60000
   OR (lease->>'status'='released' AND lease->>'expiresAt' IS DISTINCT FROM lease->>'lastSeenAt')
   OR (lease->>'status'='active' AND s->'sessions'->'revoked' ? (lease->>'sessionId')) THEN RAISE EXCEPTION 'Invalid client lease'; END IF;
  SELECT data INTO cached FROM simulator.client_sessions WHERE world_id=w AND actor_id=actor;
  IF cached IS DISTINCT FROM lease THEN RAISE EXCEPTION 'Client lease mirror mismatch'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM simulator.client_sessions c WHERE c.world_id=w AND NOT COALESCE(s->'sessions'->'leases','{}'::jsonb) ? c.actor_id) THEN RAISE EXCEPTION 'Orphan client lease'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER client_sessions_world_consistent AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.client_sessions_reconcile();
CREATE CONSTRAINT TRIGGER client_sessions_mirror_consistent AFTER INSERT OR UPDATE ON simulator.client_sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.client_sessions_reconcile();
REVOKE ALL ON FUNCTION simulator.client_session_monotonic(),simulator.client_sessions_reconcile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.client_session_monotonic(),simulator.client_sessions_reconcile() TO simulator_server;
