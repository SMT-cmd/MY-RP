-- Build-only migration. All property records remain in the private server schema.
CREATE FUNCTION simulator.check_property_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s jsonb;a record;t record;p record;b record;expected bigint;domain_name text;records jsonb;
BEGIN
 SELECT state INTO s FROM simulator.worlds WHERE id=NEW.id;
 FOR a IN SELECT * FROM jsonb_each(coalesce(s->'property'->'assets','{}'::jsonb)) LOOP
  IF jsonb_typeof(a.value->'owner') IS DISTINCT FROM 'string'
   OR jsonb_typeof(a.value->'taxDue') IS DISTINCT FROM 'number'
   OR jsonb_typeof(a.value->'utilities'->'bill') IS DISTINCT FROM 'number'
   OR (a.value->>'taxDue')::numeric<0 OR (a.value->'utilities'->>'bill')::numeric<0
   OR (a.value->>'owner'<>'npc' AND NOT (s->'citizens' ? (a.value->>'owner'))) THEN RAISE EXCEPTION 'Invalid property title or liability';END IF;
  IF (SELECT count(*) FROM jsonb_each(coalesce(s->'property'->'tenancies','{}'::jsonb)) tenant_entry WHERE tenant_entry.value->>'property'=a.key AND tenant_entry.value->>'status'<>'ended')>1 THEN RAISE EXCEPTION 'Duplicate property occupancy';END IF;
 END LOOP;
 FOR t IN SELECT * FROM jsonb_each(coalesce(s->'property'->'tenancies','{}'::jsonb)) LOOP
  IF jsonb_typeof(t.value->'deposit') IS DISTINCT FROM 'number' OR jsonb_typeof(t.value->'status') IS DISTINCT FROM 'string'
   OR jsonb_typeof(t.value->'arrears') IS DISTINCT FROM 'number' OR jsonb_typeof(t.value->'rent') IS DISTINCT FROM 'number'
   OR NOT (s->'property'->'assets' ? (t.value->>'property')) OR NOT (s->'citizens' ? (t.value->>'tenant')) THEN RAISE EXCEPTION 'Invalid tenancy record';END IF;
  expected=CASE WHEN t.value->>'status'='ended' THEN 0 ELSE (t.value->>'deposit')::bigint END;
  IF coalesce((s->'balances'->>('deposit:'||t.key))::bigint,0)<>expected OR (t.value->>'arrears')::numeric<0 OR (t.value->>'arrears')::numeric>2*(t.value->>'rent')::numeric THEN RAISE EXCEPTION 'Tenancy reserve does not reconcile';END IF;
 END LOOP;
 FOR p IN SELECT * FROM jsonb_each(coalesce(s->'property'->'purchases','{}'::jsonb)) LOOP
  IF jsonb_typeof(p.value->'status') IS DISTINCT FROM 'string' OR jsonb_typeof(p.value->'price') IS DISTINCT FROM 'number' OR jsonb_typeof(p.value->'tax') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid property purchase';END IF;
  expected=CASE WHEN p.value->>'status'='reserved' THEN (p.value->>'price')::bigint+(p.value->>'tax')::bigint ELSE 0 END;
  IF coalesce((s->'balances'->>('purchase:'||p.key))::bigint,0)<>expected THEN RAISE EXCEPTION 'Property purchase reserve does not reconcile';END IF;
 END LOOP;
 FOR b IN SELECT * FROM jsonb_each(coalesce(s->'property'->'builds','{}'::jsonb)) LOOP
  IF jsonb_typeof(b.value->'cost') IS DISTINCT FROM 'number' OR jsonb_typeof(b.value->'status') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid construction record';END IF;
  expected=CASE WHEN b.value->>'status'='building' THEN (b.value->>'cost')::bigint ELSE 0 END;
  IF coalesce((s->'balances'->>('build:'||b.key))::bigint,0)<>expected THEN RAISE EXCEPTION 'Construction reserve does not reconcile';END IF;
 END LOOP;
 FOREACH domain_name IN ARRAY ARRAY['asset','sale','purchase','rental','tenancy','build','inspection'] LOOP
  records=coalesce(s->'property'->CASE domain_name WHEN 'purchase' THEN 'purchases' WHEN 'tenancy' THEN 'tenancies' ELSE domain_name||'s' END,'{}'::jsonb);
  -- asset plural is irregular in the vocabulary, not in the storage key.
  IF domain_name='asset' THEN records=coalesce(s->'property'->'assets','{}'::jsonb);END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(records) entity WHERE entity.value IS DISTINCT FROM (SELECT d.data FROM simulator.domain_records d WHERE d.world_id=NEW.id AND d.domain='property.'||domain_name AND d.id=entity.key)) THEN RAISE EXCEPTION 'Property records do not match snapshot';END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER property_snapshot_reconciled AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_property_snapshot();
REVOKE EXECUTE ON FUNCTION simulator.check_property_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.check_property_snapshot() TO simulator_server;
