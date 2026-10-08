CREATE FUNCTION simulator.protect_incident_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.domain='incident.record' AND ((OLD.data-'invoice'-'version') IS DISTINCT FROM (NEW.data-'invoice'-'version') OR (OLD.data->'invoice' IS NOT NULL AND OLD.data->'invoice' IS DISTINCT FROM NEW.data->'invoice')) THEN RAISE EXCEPTION 'Recorded incident evidence is immutable';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER incident_evidence_immutable BEFORE UPDATE ON simulator.domain_records FOR EACH ROW EXECUTE FUNCTION simulator.protect_incident_evidence();
CREATE FUNCTION simulator.check_insurance_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s jsonb;p record;c record;i record;expected bigint;committed numeric;domain_name text;receipt jsonb;
BEGIN
 SELECT state INTO s FROM simulator.worlds WHERE id=NEW.id;
 FOR p IN SELECT * FROM jsonb_each(coalesce(s->'insurance'->'policies','{}'::jsonb)) LOOP
  IF jsonb_typeof(p.value->'remaining') IS DISTINCT FROM 'number' OR jsonb_typeof(p.value->'limit') IS DISTINCT FROM 'number' OR jsonb_typeof(p.value->'status') IS DISTINCT FROM 'string' OR jsonb_typeof(p.value->'premiumEarned') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p.value->'premium') IS DISTINCT FROM 'number' OR NOT (s->'citizens' ? (p.value->>'actor')) THEN RAISE EXCEPTION 'Invalid insurance policy';END IF;
  SELECT coalesce(sum((entry.value->>'payout')::numeric),0) INTO committed FROM jsonb_each(coalesce(s->'insurance'->'claims','{}'::jsonb)) entry WHERE entry.value->>'policy'=p.key AND entry.value->>'status' IN ('approved','paid');
  IF (p.value->>'remaining')::numeric<0 OR committed+(p.value->>'remaining')::numeric>(p.value->>'limit')::numeric OR (p.value->>'status'='active' AND committed+(p.value->>'remaining')::numeric<>(p.value->>'limit')::numeric) THEN RAISE EXCEPTION 'Insurance coverage does not reconcile';END IF;
  IF (p.value->>'remaining')::bigint<>coalesce((s->'balances'->>('policy:'||p.key))::bigint,0) THEN RAISE EXCEPTION 'Insurance backing reserve does not reconcile';END IF;
  expected=CASE WHEN p.value->>'status'='active' AND NOT (p.value->>'premiumEarned')::boolean THEN (p.value->>'premium')::bigint ELSE 0 END;
  IF expected<>coalesce((s->'balances'->>('policy-premium:'||p.key))::bigint,0) THEN RAISE EXCEPTION 'Insurance premium reserve does not reconcile';END IF;
 END LOOP;
 FOR c IN SELECT * FROM jsonb_each(coalesce(s->'insurance'->'claims','{}'::jsonb)) LOOP
  IF jsonb_typeof(c.value->'payout') IS DISTINCT FROM 'number' OR jsonb_typeof(c.value->'status') IS DISTINCT FROM 'string' OR NOT (s->'insurance'->'policies' ? (c.value->>'policy')) THEN RAISE EXCEPTION 'Invalid insurance claim';END IF;
  expected=CASE WHEN c.value->>'status'='approved' THEN (c.value->>'payout')::bigint ELSE 0 END;
  IF expected<0 OR expected<>coalesce((s->'balances'->>('claim:'||c.key))::bigint,0) THEN RAISE EXCEPTION 'Approved claim reserve does not reconcile';END IF;
 END LOOP;
 FOR i IN SELECT * FROM jsonb_each(coalesce(s->'incidents'->'records','{}'::jsonb)) LOOP
  IF jsonb_typeof(i.value->'loss') IS DISTINCT FROM 'number' OR (i.value->>'loss')::numeric<0 OR NOT (s->'citizens' ? (i.value->>'actor')) OR NOT (s->'citizens' ? (i.value->>'owner')) THEN RAISE EXCEPTION 'Invalid incident evidence';END IF;
  IF i.value ? 'invoice' THEN
   receipt=s->'commands'->(i.value->'invoice'->>'command')->'receipt';
   IF receipt IS NULL OR receipt->>'actorId' IS DISTINCT FROM i.value->'invoice'->>'actor' OR receipt->'detail'->'fee' IS DISTINCT FROM i.value->'invoice'->'amount' OR coalesce(receipt->>'type','') NOT IN ('RepairProperty','CompleteVehicleRepair') OR coalesce(receipt->'detail'->>'propertyId',receipt->'detail'->>'vehicleId') IS DISTINCT FROM i.value->>'asset' THEN RAISE EXCEPTION 'Incident invoice does not match immutable receipt';END IF;
  END IF;
  IF i.value IS DISTINCT FROM (SELECT d.data FROM simulator.domain_records d WHERE d.world_id=NEW.id AND d.domain='incident.record' AND d.id=i.key) THEN RAISE EXCEPTION 'Incident records do not match snapshot';END IF;
 END LOOP;
 FOREACH domain_name IN ARRAY ARRAY['provider','policy','claim'] LOOP
  IF EXISTS(SELECT 1 FROM jsonb_each(coalesce(s->'insurance'->CASE domain_name WHEN 'policy' THEN 'policies' ELSE domain_name||'s' END,'{}'::jsonb)) entity WHERE entity.value IS DISTINCT FROM (SELECT d.data FROM simulator.domain_records d WHERE d.world_id=NEW.id AND d.domain='insurance.'||domain_name AND d.id=entity.key)) THEN RAISE EXCEPTION 'Insurance records do not match snapshot';END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER insurance_snapshot_reconciled AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_insurance_snapshot();
REVOKE EXECUTE ON FUNCTION simulator.protect_incident_evidence(),simulator.check_insurance_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.protect_incident_evidence(),simulator.check_insurance_snapshot() TO simulator_server;
