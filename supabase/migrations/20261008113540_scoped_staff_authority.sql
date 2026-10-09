CREATE TABLE simulator.staff_grants (
 world_id text NOT NULL REFERENCES simulator.worlds(id),id text NOT NULL,actor_id uuid NOT NULL,data jsonb NOT NULL,version bigint NOT NULL CHECK(version>0),
 PRIMARY KEY(world_id,id),CHECK(data->>'id'=id AND data->>'actor'=actor_id::text AND (data->>'version')::bigint=version)
);
CREATE TABLE simulator.staff_proposals (
 world_id text NOT NULL REFERENCES simulator.worlds(id),id text NOT NULL,data jsonb NOT NULL,version bigint NOT NULL CHECK(version>0),
 PRIMARY KEY(world_id,id),CHECK(data->>'id'=id AND (data->>'version')::bigint=version)
);
CREATE TABLE simulator.staff_audit (
 world_id text NOT NULL REFERENCES simulator.worlds(id),sequence bigint NOT NULL CHECK(sequence>0),actor_id text NOT NULL,command_id text NOT NULL,data jsonb NOT NULL,
 PRIMARY KEY(world_id,sequence),UNIQUE(world_id,actor_id,command_id),
 FOREIGN KEY(world_id,actor_id,command_id) REFERENCES simulator.commands(world_id,actor_id,id) DEFERRABLE INITIALLY DEFERRED,
 CHECK(data->>'actor'=actor_id AND (data->>'sequence')::bigint=sequence AND data->>'commandKey'=actor_id||':'||command_id)
);
ALTER TABLE simulator.staff_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator.staff_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE simulator.staff_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator.staff_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE simulator.staff_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator.staff_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY world_scope ON simulator.staff_grants USING(world_id=(SELECT current_setting('simulator.world_id',true))) WITH CHECK(world_id=(SELECT current_setting('simulator.world_id',true)));
CREATE POLICY world_scope ON simulator.staff_proposals USING(world_id=(SELECT current_setting('simulator.world_id',true))) WITH CHECK(world_id=(SELECT current_setting('simulator.world_id',true)));
CREATE POLICY world_scope ON simulator.staff_audit USING(world_id=(SELECT current_setting('simulator.world_id',true))) WITH CHECK(world_id=(SELECT current_setting('simulator.world_id',true)) AND actor_id=(SELECT current_setting('simulator.actor_id',true)));
REVOKE ALL ON simulator.staff_grants,simulator.staff_proposals,simulator.staff_audit FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON simulator.staff_grants,simulator.staff_proposals TO simulator_server;
GRANT SELECT,INSERT ON simulator.staff_audit TO simulator_server;

CREATE FUNCTION simulator.staff_record_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE old_count integer; new_count integer;
BEGIN
 IF TG_TABLE_NAME='staff_audit' THEN RAISE EXCEPTION 'Staff audit is append only'; END IF;
 IF NEW.world_id IS DISTINCT FROM OLD.world_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Staff record identity or version changed'; END IF;
 IF TG_TABLE_NAME='staff_grants' THEN
  IF NEW.actor_id IS DISTINCT FROM OLD.actor_id OR NEW.data-ARRAY['status','version'] IS DISTINCT FROM OLD.data-ARRAY['status','version'] OR OLD.data->>'status'<>'active' OR NEW.data->>'status'<>'revoked' THEN RAISE EXCEPTION 'Staff grant terms are immutable'; END IF;
 ELSE
  IF NEW.data-ARRAY['approvals','status','version','settledBy'] IS DISTINCT FROM OLD.data-ARRAY['approvals','status','version','settledBy'] OR OLD.data->>'status' NOT IN ('pending','ready') THEN RAISE EXCEPTION 'Staff proposal terms are immutable'; END IF;
  old_count:=jsonb_array_length(OLD.data->'approvals');new_count:=jsonb_array_length(NEW.data->'approvals');
  IF new_count NOT BETWEEN old_count AND old_count+1 OR EXISTS(SELECT 1 FROM jsonb_array_elements(OLD.data->'approvals') WITH ORDINALITY a(value,n) WHERE NEW.data->'approvals'->(n::integer-1) IS DISTINCT FROM value) THEN RAISE EXCEPTION 'Staff approvals are append only'; END IF;
  IF NEW.data->>'status'='applied' AND (OLD.data->>'status'<>'ready' OR new_count<2) OR NEW.data->>'status' NOT IN ('pending','ready','rejected','applied') THEN RAISE EXCEPTION 'Invalid staff proposal transition'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER staff_grant_guard BEFORE UPDATE ON simulator.staff_grants FOR EACH ROW EXECUTE FUNCTION simulator.staff_record_guard();
CREATE TRIGGER staff_proposal_guard BEFORE UPDATE ON simulator.staff_proposals FOR EACH ROW EXECUTE FUNCTION simulator.staff_record_guard();
CREATE TRIGGER staff_audit_immutable BEFORE UPDATE OR DELETE ON simulator.staff_audit FOR EACH ROW EXECUTE FUNCTION simulator.staff_record_guard();

CREATE FUNCTION simulator.staff_state_reconcile() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE s jsonb; m jsonb; w text; k text; item jsonb; cached jsonb; record jsonb; n bigint:=0; previous_hash text:=repeat('0',64); receipt jsonb;
BEGIN
 IF TG_TABLE_NAME='worlds' THEN s:=NEW.state;w:=NEW.id; ELSE w:=NEW.world_id;SELECT state INTO s FROM simulator.worlds WHERE id=w; END IF;
 m:=s->'administration';
 IF m IS NOT NULL THEN
  IF jsonb_typeof(m) IS DISTINCT FROM 'object' OR jsonb_typeof(m->'grants') IS DISTINCT FROM 'object' OR jsonb_typeof(m->'proposals') IS DISTINCT FROM 'object' OR jsonb_typeof(m->'audit') IS DISTINCT FROM 'array' OR jsonb_typeof(m->'bootstrapActors') IS DISTINCT FROM 'array' OR jsonb_array_length(m->'bootstrapActors')<>2 OR m->'bootstrapActors'->>0=m->'bootstrapActors'->>1 OR (m->>'version')::bigint IS DISTINCT FROM jsonb_array_length(m->'audit') OR jsonb_array_length(m->'audit')<1 THEN RAISE EXCEPTION 'Invalid staff administration state'; END IF;
  FOR k,item IN SELECT key,value FROM jsonb_each(m->'grants') LOOP
   SELECT data INTO cached FROM simulator.staff_grants WHERE world_id=w AND id=k;
   IF cached IS DISTINCT FROM item OR item->>'id' IS DISTINCT FROM k OR item->>'role' NOT IN ('super','moderator','economy','support','content','technical') OR item->>'status' NOT IN ('active','revoked') OR item->>'role' IN ('super','technical') AND item->'region'<>'null'::jsonb THEN RAISE EXCEPTION 'Staff grant mirror mismatch or invalid scope'; END IF;
   IF (item->>'bootstrap')::boolean THEN
    IF item->>'role' IS DISTINCT FROM 'super' OR item->'expiresAt' IS DISTINCT FROM 'null'::jsonb OR NOT m->'bootstrapActors' ? (item->>'actor') OR s->'commands'->(item->>'issuedBy')->'receipt'->>'type' IS DISTINCT FROM 'BootstrapStaff' THEN RAISE EXCEPTION 'Invalid staff bootstrap proof'; END IF;
   ELSIF NOT EXISTS(SELECT 1 FROM jsonb_each(m->'proposals') p WHERE p.value->>'settledBy'=item->>'issuedBy' AND p.value->>'action'='grant' AND p.value->>'status'='applied' AND p.value->>'target'=item->>'actor' AND p.value->>'role'=item->>'role' AND p.value->'region'=item->'region' AND p.value->'grantUntil'=item->'expiresAt') THEN RAISE EXCEPTION 'Staff grant approval proof missing'; END IF;
   IF item->>'status'='revoked' AND NOT EXISTS(SELECT 1 FROM jsonb_each(m->'proposals') p WHERE p.value->>'action'='revoke' AND p.value->>'status'='applied' AND p.value->>'grantId'=k) THEN RAISE EXCEPTION 'Staff revocation approval proof missing'; END IF;
  END LOOP;
  FOR k,item IN SELECT key,value FROM jsonb_each(m->'proposals') LOOP
   SELECT data INTO cached FROM simulator.staff_proposals WHERE world_id=w AND id=k;
   IF cached IS DISTINCT FROM item OR item->>'id' IS DISTINCT FROM k OR item->>'status' NOT IN ('pending','ready','rejected','applied') OR jsonb_array_length(item->'approvals')<1 OR (SELECT count(DISTINCT a->>'actor') FROM jsonb_array_elements(item->'approvals') a)<>jsonb_array_length(item->'approvals') THEN RAISE EXCEPTION 'Staff proposal mirror or independent approvals invalid'; END IF;
   IF item->>'status'='applied' AND (jsonb_array_length(item->'approvals')<2 OR s->'commands'->(item->>'settledBy')->'receipt'->>'type' IS DISTINCT FROM 'ApplyStaffChange') THEN RAISE EXCEPTION 'Staff application proof missing'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(item->'approvals') a WHERE (a->>'stepUpAt')::bigint IS NULL OR (a->>'at')::bigint<(item->>'createdAt')::bigint OR (a->>'at')::bigint>=(item->>'expiresAt')::bigint OR (a->>'stepUpAt')::bigint>(a->>'at')::bigint OR (a->>'at')::bigint-(a->>'stepUpAt')::bigint>=900000) THEN RAISE EXCEPTION 'Staff approval requires recent authentication'; END IF;
  END LOOP;
  FOR record IN SELECT value FROM jsonb_array_elements(m->'audit') LOOP
   n:=n+1;SELECT data INTO cached FROM simulator.staff_audit WHERE world_id=w AND sequence=n;
   receipt:=s->'commands'->(record->>'commandKey')->'receipt';
   IF cached IS DISTINCT FROM record OR (record->>'sequence')::bigint<>n OR record->>'previousHash' IS DISTINCT FROM previous_hash OR COALESCE(record->>'hash','')!~'^[a-f0-9]{64}$' OR COALESCE(record->>'before','')!~'^[a-f0-9]{64}$' OR COALESCE(record->>'after','')!~'^[a-f0-9]{64}$' OR receipt->>'actorId' IS DISTINCT FROM record->>'actor' OR receipt->>'type' IS DISTINCT FROM record->>'action' OR (receipt->>'at')::bigint IS DISTINCT FROM (record->>'at')::bigint THEN RAISE EXCEPTION 'Staff audit mirror or receipt mismatch'; END IF;
   IF n=1 AND (record->>'action' IS DISTINCT FROM 'BootstrapStaff' OR record->>'role' IS DISTINCT FROM 'out-of-band-bootstrap' OR record->'sessionId' IS DISTINCT FROM 'null'::jsonb OR record->'stepUpAt' IS DISTINCT FROM 'null'::jsonb) OR n>1 AND (record->>'role' IS DISTINCT FROM 'super' OR COALESCE(record->>'sessionId','')!~'^[a-zA-Z0-9_-]{3,100}$' OR (record->>'stepUpAt')::bigint IS NULL OR (record->>'stepUpAt')::bigint>(record->>'at')::bigint OR (record->>'at')::bigint-(record->>'stepUpAt')::bigint>=900000) THEN RAISE EXCEPTION 'Staff audit requires session verification'; END IF;
   previous_hash:=record->>'hash';
  END LOOP;
 END IF;
 IF EXISTS(SELECT 1 FROM simulator.staff_grants WHERE world_id=w AND NOT COALESCE(m->'grants','{}'::jsonb) ? id) OR EXISTS(SELECT 1 FROM simulator.staff_proposals WHERE world_id=w AND NOT COALESCE(m->'proposals','{}'::jsonb) ? id) OR (SELECT count(*) FROM simulator.staff_audit WHERE world_id=w)<>n THEN RAISE EXCEPTION 'Staff authority or audit cannot be removed'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER staff_world_consistent AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.staff_state_reconcile();
CREATE CONSTRAINT TRIGGER staff_grants_consistent AFTER INSERT OR UPDATE ON simulator.staff_grants DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.staff_state_reconcile();
CREATE CONSTRAINT TRIGGER staff_proposals_consistent AFTER INSERT OR UPDATE ON simulator.staff_proposals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.staff_state_reconcile();
CREATE CONSTRAINT TRIGGER staff_audit_consistent AFTER INSERT ON simulator.staff_audit DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.staff_state_reconcile();
REVOKE ALL ON FUNCTION simulator.staff_record_guard(),simulator.staff_state_reconcile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.staff_record_guard(),simulator.staff_state_reconcile() TO simulator_server;
