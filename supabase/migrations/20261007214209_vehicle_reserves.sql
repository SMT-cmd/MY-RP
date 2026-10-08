CREATE FUNCTION simulator.check_vehicle_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s jsonb;v record;t record;r record;expected bigint;domain_name text;storage_key text;
BEGIN
 SELECT state INTO s FROM simulator.worlds WHERE id=NEW.id;
 FOR v IN SELECT * FROM jsonb_each(coalesce(s->'mobility'->'vehicles','{}'::jsonb)) LOOP
  IF jsonb_typeof(v.value->'owner') IS DISTINCT FROM 'string' OR NOT (s->'citizens' ? (v.value->>'owner'))
   OR jsonb_typeof(v.value->'fuel') IS DISTINCT FROM 'number' OR jsonb_typeof(v.value->'tank') IS DISTINCT FROM 'number'
   OR jsonb_typeof(v.value->'condition') IS DISTINCT FROM 'number' OR jsonb_typeof(v.value->'permitted') IS DISTINCT FROM 'array'
   OR NOT (v.value->'permitted' ? (v.value->>'owner')) OR (v.value->>'fuel')::numeric<0 OR (v.value->>'fuel')::numeric>(v.value->>'tank')::numeric
   OR (v.value->>'condition')::numeric<20 OR (v.value->>'condition')::numeric>100 THEN RAISE EXCEPTION 'Invalid vehicle title or operating record';END IF;
  IF (v.value->>'fuel')::bigint<>coalesce((s->'commerce'->'stock'->'balances'->>('fuel:vehicle:'||v.key))::bigint,0) THEN RAISE EXCEPTION 'Vehicle tank does not reconcile';END IF;
  IF v.value->>'status'='travelling' AND (s->'world'->'trips'->(v.value->>'trip')->>'vehicleId' IS DISTINCT FROM v.key OR s->'world'->'trips'->(v.value->>'trip')->>'status' IS DISTINCT FROM 'travelling') THEN RAISE EXCEPTION 'Vehicle journey does not reconcile';END IF;
 END LOOP;
 FOR t IN SELECT * FROM jsonb_each(coalesce(s->'world'->'trips','{}'::jsonb)) WHERE value ? 'vehicleId' LOOP
  IF jsonb_typeof(t.value->'vehicleFuel') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid reserved journey fuel';END IF;
  expected=CASE WHEN t.value->>'status'='travelling' THEN (t.value->>'vehicleFuel')::bigint ELSE 0 END;
  IF expected<>coalesce((s->'commerce'->'stock'->'balances'->>('fuel:trip-fuel:'||t.key))::bigint,0) THEN RAISE EXCEPTION 'Vehicle journey fuel does not reconcile';END IF;
 END LOOP;
 FOREACH domain_name IN ARRAY ARRAY['sale','repair'] LOOP
  FOR r IN SELECT * FROM jsonb_each(coalesce(s->'mobility'->(domain_name||'s'),'{}'::jsonb)) LOOP
   IF jsonb_typeof(r.value->'status') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid vehicle reservation';END IF;
   expected=CASE WHEN r.value->>'status'='reserved' THEN (r.value->>CASE domain_name WHEN 'sale' THEN 'price' ELSE 'fee' END)::bigint ELSE 0 END;
   IF expected IS NULL OR expected<>coalesce((s->'balances'->>(CASE domain_name WHEN 'sale' THEN 'vehicle-sale:' ELSE 'repair:' END||r.key))::bigint,0) THEN RAISE EXCEPTION 'Vehicle cash reserve does not reconcile';END IF;
  END LOOP;
 END LOOP;
 FOREACH domain_name IN ARRAY ARRAY['vehicle','invitation','sale','repair'] LOOP
  storage_key=CASE domain_name WHEN 'invitation' THEN 'invites' ELSE domain_name||'s' END;
  IF EXISTS(SELECT 1 FROM jsonb_each(coalesce(s->'mobility'->storage_key,'{}'::jsonb)) entity WHERE entity.value IS DISTINCT FROM (SELECT d.data FROM simulator.domain_records d WHERE d.world_id=NEW.id AND d.domain='mobility.'||domain_name AND d.id=entity.key)) THEN RAISE EXCEPTION 'Vehicle records do not match snapshot';END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER vehicle_snapshot_reconciled AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_vehicle_snapshot();
REVOKE EXECUTE ON FUNCTION simulator.check_vehicle_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.check_vehicle_snapshot() TO simulator_server;
