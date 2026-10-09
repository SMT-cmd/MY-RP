-- Presentation use positions are private and share the existing atomic world
-- and command mirrors. Expiry has no money, rewards or scheduled service.
CREATE FUNCTION simulator.furniture_use_reconciles() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE s jsonb:=NEW.state; actor text; p jsonb; a jsonb; item jsonb; receipt jsonb; kind text; capacity integer; claimed text; occupied text[]:=ARRAY[]::text[];
BEGIN
 FOR actor,p IN SELECT key,value FROM jsonb_each(coalesce(s->'world'->'positions','{}'::jsonb)) LOOP
  a:=p->'activity';
  -- Existing legacy poses remain readable. A new use clears legacy/expired
  -- poses in that room before claiming a verified position.
  IF a->>'slot' IS NULL THEN CONTINUE; END IF;
  IF p->>'interior' IS DISTINCT FROM 'shelter' THEN RAISE EXCEPTION 'Furniture use is outside its home'; END IF;
  item:=s->'furnishing'->'items'->(a->>'instanceId');
  kind:=CASE item->>'model' WHEN 'sofa' THEN 'Sit' WHEN 'armchair' THEN 'Sit' WHEN 'dining-chair' THEN 'Sit' WHEN 'desk' THEN 'Read' WHEN 'bookshelf' THEN 'Read' WHEN 'sink' THEN 'Wash' WHEN 'wardrobe' THEN 'Dress' WHEN 'bed' THEN 'Rest' ELSE NULL END;
  capacity:=CASE WHEN item->>'model'='sofa' THEN 3 ELSE 1 END;
  receipt:=simulator.home_visit_receipt(NEW.id,s,a->>'useKey');
  IF item IS NULL OR kind IS NULL OR item->>'homeId' IS DISTINCT FROM p->>'homeId' OR a->>'kind' IS DISTINCT FROM kind
   OR a->>'fixtureId' IS DISTINCT FROM coalesce(item->>'alias',item->>'id')
   OR jsonb_typeof(a->'slot') IS DISTINCT FROM 'number' OR (a->>'slot')::integer NOT BETWEEN 0 AND capacity-1
   OR jsonb_typeof(a->'startedAt') IS DISTINCT FROM 'number'
   OR receipt IS NULL OR receipt->>'type' IS DISTINCT FROM 'InteractHomeFixture' OR receipt->>'actorId' IS DISTINCT FROM actor
   OR receipt->>'at' IS DISTINCT FROM a->>'startedAt' OR receipt->'detail'->>'homeId' IS DISTINCT FROM p->>'homeId'
   OR receipt->'detail'->>'fixtureInstanceId' IS DISTINCT FROM a->>'instanceId'
   OR receipt->'detail'->>'fixtureUseSlot' IS DISTINCT FROM a->>'slot' OR receipt->'detail'->>'activityKind' IS DISTINCT FROM kind
  THEN RAISE EXCEPTION 'Furniture use lacks position or interaction evidence'; END IF;
  claimed:=(p->>'homeId')||':'||(a->>'instanceId')||':'||(a->>'slot');
  IF claimed=ANY(occupied) THEN RAISE EXCEPTION 'Furniture use slot is already occupied'; END IF;occupied:=array_append(occupied,claimed);
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER furniture_use_reconciles AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.furniture_use_reconciles();
REVOKE ALL ON FUNCTION simulator.furniture_use_reconciles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.furniture_use_reconciles() TO simulator_server;
