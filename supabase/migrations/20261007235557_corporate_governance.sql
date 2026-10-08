CREATE FUNCTION simulator.protect_corporate_terms() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.domain='governance.action' THEN
  IF (OLD.data-'votes'-'consents'-'buyerAccepted'-'status'-'version'-'settledCommand') IS DISTINCT FROM (NEW.data-'votes'-'consents'-'buyerAccepted'-'status'-'version'-'settledCommand') THEN RAISE EXCEPTION 'Corporate terms are immutable';END IF;
  IF OLD.data->>'status' IN ('executed','cancelled','expired') AND OLD.data IS DISTINCT FROM NEW.data THEN RAISE EXCEPTION 'Finished corporate action is immutable';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER corporate_terms_immutable BEFORE UPDATE ON simulator.domain_records FOR EACH ROW EXECUTE FUNCTION simulator.protect_corporate_terms();

CREATE FUNCTION simulator.check_corporate_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s jsonb;c record;a record;holder record;issued numeric;total numeric;expected bigint;reserved numeric;receipt jsonb;founder text;expected_units numeric;approvals integer;
BEGIN
 SELECT state INTO s FROM simulator.worlds WHERE id=NEW.id;
 FOR c IN SELECT * FROM jsonb_each(coalesce(s->'commerce'->'companies','{}'::jsonb)) LOOP
  issued=coalesce((c.value->>'issuedShares')::numeric,100000);
  IF issued<1 OR issued>10000000 OR issued<>trunc(issued) OR jsonb_typeof(c.value->'shares') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid company issued shares';END IF;
  SELECT coalesce(sum(value::numeric),0) INTO total FROM jsonb_each_text(c.value->'shares');
  IF total<>issued THEN RAISE EXCEPTION 'Company cap table does not reconcile';END IF;
  SELECT entry.value->'receipt'->>'actorId' INTO founder FROM jsonb_each(coalesce(s->'commands','{}'::jsonb)) entry WHERE entry.value->'receipt'->>'type'='RegisterCompany' AND entry.value->'receipt'->'detail'->>'companyId'=c.key LIMIT 1;
  IF founder IS NULL THEN RAISE EXCEPTION 'Company registration proof missing';END IF;
  SELECT 100000+coalesce(sum(CASE proposal.value->>'kind' WHEN 'issue' THEN (proposal.value->>'units')::numeric WHEN 'buyback' THEN -(proposal.value->>'units')::numeric ELSE 0 END),0) INTO expected_units FROM jsonb_each(coalesce(s->'governance'->'actions','{}'::jsonb)) proposal WHERE proposal.value->>'company'=c.key AND proposal.value->>'status'='executed';
  IF expected_units<>issued THEN RAISE EXCEPTION 'Issued shares lack settlement evidence';END IF;
  FOR holder IN SELECT citizen.key FROM jsonb_each(coalesce(s->'citizens','{}'::jsonb)) citizen LOOP
   SELECT (CASE WHEN holder.key=founder THEN 100000 ELSE 0 END)+coalesce(sum((CASE WHEN proposal.value->>'buyer'=holder.key AND proposal.value->>'kind' IN ('transfer','issue') THEN (proposal.value->>'units')::numeric ELSE 0 END)-(CASE WHEN proposal.value->>'holder'=holder.key AND proposal.value->>'kind' IN ('transfer','buyback') THEN (proposal.value->>'units')::numeric ELSE 0 END)),0) INTO expected_units FROM jsonb_each(coalesce(s->'governance'->'actions','{}'::jsonb)) proposal WHERE proposal.value->>'company'=c.key AND proposal.value->>'status'='executed';
   IF expected_units<>coalesce((c.value->'shares'->>holder.key)::numeric,0) THEN RAISE EXCEPTION 'Company ownership lacks settled transfer evidence';END IF;
  END LOOP;
  FOR holder IN SELECT * FROM jsonb_each_text(c.value->'shares') LOOP
   IF holder.value::numeric<1 OR holder.value::numeric<>trunc(holder.value::numeric) OR NOT (s->'citizens' ? holder.key) THEN RAISE EXCEPTION 'Invalid company shareholder';END IF;
   SELECT coalesce(sum((proposal.value->>'units')::numeric),0) INTO reserved FROM jsonb_each(coalesce(s->'governance'->'actions','{}'::jsonb)) proposal WHERE proposal.value->>'company'=c.key AND proposal.value->>'holder'=holder.key AND proposal.value->>'kind' IN ('transfer','buyback') AND proposal.value->>'status' IN ('pending','ready');
   IF reserved>holder.value::numeric THEN RAISE EXCEPTION 'Share reservations exceed ownership';END IF;
  END LOOP;
  IF c.value IS DISTINCT FROM (SELECT data FROM simulator.domain_records WHERE world_id=NEW.id AND domain='commerce.company' AND id=c.key) THEN RAISE EXCEPTION 'Company records do not match snapshot';END IF;
 END LOOP;
 FOR a IN SELECT * FROM jsonb_each(coalesce(s->'governance'->'actions','{}'::jsonb)) LOOP
  IF NOT (s->'commerce'->'companies' ? (a.value->>'company')) OR NOT (s->'citizens' ? (a.value->>'maker')) OR a.value->>'kind' NOT IN ('dividend','transfer','issue','buyback','restructure','resume','liquidate') OR a.value->>'status' NOT IN ('pending','ready','executed','cancelled','expired') OR jsonb_typeof(a.value->'amount') IS DISTINCT FROM 'number' OR (a.value->>'amount')::numeric<0 OR (a.value->>'amount')::numeric<>trunc((a.value->>'amount')::numeric) THEN RAISE EXCEPTION 'Invalid corporate proposal';END IF;
  expected=CASE WHEN a.value->>'status' IN ('pending','ready') AND a.value->>'kind' IN ('dividend','buyback','liquidate') THEN (a.value->>'amount')::bigint ELSE 0 END;
  IF expected<>coalesce((s->'balances'->>('corporate:'||a.key))::bigint,0) THEN RAISE EXCEPTION 'Corporate reservation does not reconcile';END IF;
  expected=CASE WHEN a.value->>'status' IN ('pending','ready') AND (a.value->>'buyerAccepted')::boolean AND a.value->>'kind' IN ('transfer','issue') THEN (a.value->>'amount')::bigint ELSE 0 END;
  IF expected<>coalesce((s->'balances'->>('share-purchase:'||a.key))::bigint,0) THEN RAISE EXCEPTION 'Share purchase reservation does not reconcile';END IF;
  IF a.value->>'status'='executed' THEN
   IF (a.value->>'required')::integer<>least(2,jsonb_array_length(a.value->'controllers')) OR (a.value->>'required')::integer<1 THEN RAISE EXCEPTION 'Invalid corporate approval threshold';END IF;
   SELECT count(DISTINCT controller.value) INTO approvals FROM jsonb_array_elements_text(a.value->'controllers') controller WHERE a.value->'votes'->controller.value='true'::jsonb;
   IF approvals<(a.value->>'required')::integer OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(a.value->'owners') owner WHERE a.value->'consents'->owner.value IS DISTINCT FROM 'true'::jsonb) OR (a.value->>'buyer' IS NOT NULL AND a.value->'buyerAccepted' IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'Corporate settlement approvals incomplete';END IF;
   receipt=s->'commands'->(a.value->>'settledCommand')->'receipt';
   IF receipt->>'type' IS DISTINCT FROM 'ExecuteCorporateAction' OR receipt->'detail'->>'proposalId' IS DISTINCT FROM a.key OR receipt->'detail'->'amount' IS DISTINCT FROM a.value->'amount' OR receipt->'detail'->'units' IS DISTINCT FROM a.value->'units' OR receipt->'detail'->'kind' IS DISTINCT FROM a.value->'kind' THEN RAISE EXCEPTION 'Corporate settlement has no immutable receipt';END IF;
  END IF;
  IF a.value IS DISTINCT FROM (SELECT data FROM simulator.domain_records WHERE world_id=NEW.id AND domain='governance.action' AND id=a.key) THEN RAISE EXCEPTION 'Corporate records do not match snapshot';END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER corporate_snapshot_reconciled AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_corporate_snapshot();
REVOKE EXECUTE ON FUNCTION simulator.protect_corporate_terms(),simulator.check_corporate_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.protect_corporate_terms(),simulator.check_corporate_snapshot() TO simulator_server;
