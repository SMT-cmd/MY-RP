CREATE FUNCTION simulator.check_clinical_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s jsonb;c record;expected bigint;domain_name text;
BEGIN
 SELECT state INTO s FROM simulator.worlds WHERE id=NEW.id;
 FOR c IN SELECT * FROM jsonb_each(coalesce(s->'healthcare'->'cases','{}'::jsonb)) LOOP
  IF jsonb_typeof(c.value->'patient') IS DISTINCT FROM 'string' OR NOT (s->'citizens' ? (c.value->>'patient'))
   OR jsonb_typeof(c.value->'provider') IS DISTINCT FROM 'string' OR jsonb_typeof(c.value->'status') IS DISTINCT FROM 'string'
   OR jsonb_typeof(c.value->'consultation') IS DISTINCT FROM 'number' OR jsonb_typeof(c.value->'fee') IS DISTINCT FROM 'number'
   OR (c.value->>'consultation')::numeric<0 OR (c.value->>'fee')::numeric<0
   OR (c.value->>'provider'<>'npc' AND NOT (s->'healthcare'->'hospitals' ? (c.value->>'provider'))) THEN RAISE EXCEPTION 'Invalid clinical episode';END IF;
  expected=CASE WHEN c.value->>'status'='queued' THEN (c.value->>'consultation')::bigint ELSE 0 END;
  IF expected<>coalesce((s->'balances'->>('consultation:'||c.key))::bigint,0) THEN RAISE EXCEPTION 'Consultation reserve does not reconcile';END IF;
  expected=CASE WHEN c.value->>'status' IN ('funded','recovering') THEN (c.value->>'fee')::bigint ELSE 0 END;
  IF expected<>coalesce((s->'balances'->>('treatment:'||c.key))::bigint,0) THEN RAISE EXCEPTION 'Treatment reserve does not reconcile';END IF;
  IF c.value->>'transport' IS NOT NULL AND (s->'world'->'trips'->(c.value->>'transport')->>'careCaseId' IS DISTINCT FROM c.key OR s->'world'->'trips'->(c.value->>'transport')->>'status' IS DISTINCT FROM 'travelling') THEN RAISE EXCEPTION 'Emergency transport does not reconcile';END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_each(coalesce(s->'healthcare'->'cases','{}'::jsonb)) episode WHERE episode.value->>'status' NOT IN ('completed','cancelled') GROUP BY episode.value->>'patient' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate active patient episode';END IF;
 FOREACH domain_name IN ARRAY ARRAY['hospital','case'] LOOP
  IF EXISTS(SELECT 1 FROM jsonb_each(coalesce(s->'healthcare'->(domain_name||'s'),'{}'::jsonb)) entity WHERE entity.value IS DISTINCT FROM (SELECT d.data FROM simulator.domain_records d WHERE d.world_id=NEW.id AND d.domain='healthcare.'||domain_name AND d.id=entity.key)) THEN RAISE EXCEPTION 'Clinical records do not match snapshot';END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER clinical_snapshot_reconciled AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_clinical_snapshot();
REVOKE EXECUTE ON FUNCTION simulator.check_clinical_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.check_clinical_snapshot() TO simulator_server;
