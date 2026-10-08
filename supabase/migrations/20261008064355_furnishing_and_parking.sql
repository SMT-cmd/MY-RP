-- No public Data API table or privileged public function is introduced.
CREATE FUNCTION simulator.furniture_catalogue() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,simulator AS $$
 SELECT '{"bed":[2,2,85000],"pantry":[1,1,32000],"sofa":[3,1,60000],"desk":[2,1,35000],"sink":[1,1,28000],"wardrobe":[1,2,48000],"armchair":[1,1,25000],"dining-table":[2,2,42000],"dining-chair":[1,1,9500],"bookshelf":[1,2,30000],"sideboard":[2,1,33000],"plant":[1,1,7000],"coffee-table":[2,1,19000],"fridge":[1,1,68000]}'::jsonb
$$;
CREATE FUNCTION simulator.furniture_item_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
BEGIN
 IF OLD.domain='furnishing.item' AND (OLD.data->>'owner',OLD.data->>'model',OLD.data->>'starter',OLD.data->>'purchaseKey',OLD.data->>'alias') IS DISTINCT FROM (NEW.data->>'owner',NEW.data->>'model',NEW.data->>'starter',NEW.data->>'purchaseKey',NEW.data->>'alias') THEN RAISE EXCEPTION 'Furniture title and acquisition are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER furniture_title_immutable BEFORE UPDATE ON simulator.domain_records FOR EACH ROW EXECUTE FUNCTION simulator.furniture_item_immutable();
CREATE FUNCTION simulator.furnishing_reconciles() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE s jsonb:=NEW.state; m jsonb:=NEW.state->'furnishing'; item jsonb; home jsonb; record jsonb; dims jsonb; receipt jsonb; w integer; h integer; homes_id text; blocked boolean;
BEGIN
 IF m IS NULL THEN RETURN NULL; END IF;
 FOR item IN SELECT value FROM jsonb_each(m->'items') LOOP
  dims:=simulator.furniture_catalogue()->(item->>'model');
  IF dims IS NULL OR s->'citizens'->(item->>'owner') IS NULL OR item->>'finish' NOT IN ('walnut','oak','cream','slate','sage','terracotta','navy') OR (item->>'homeId' IS NOT NULL AND m->'homes'->(item->>'homeId') IS NULL) OR (item->>'homeId' IS NULL) IS DISTINCT FROM (item->>'placement' IS NULL) THEN RAISE EXCEPTION 'Furniture title or placement mismatch'; END IF;
  IF NOT (item->>'starter')::boolean THEN
   receipt:=s->'commands'->(item->>'purchaseKey')->'receipt';
   IF receipt IS NULL OR receipt->>'type'<>'BuyFurniture' OR receipt->>'actorId'<>item->>'owner' OR receipt->'detail'->>'furnitureId'<>item->>'id' OR (receipt->'detail'->>'amount')::bigint<>(dims->>2)::bigint THEN RAISE EXCEPTION 'Furniture lacks recorded purchase evidence'; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM simulator.domain_records r WHERE r.world_id=NEW.id AND r.domain='furnishing.item' AND r.id=item->>'id' AND r.data=item) THEN RAISE EXCEPTION 'Furniture snapshot mirror mismatch'; END IF;
 END LOOP;
 FOR homes_id,home IN SELECT key,value FROM jsonb_each(m->'homes') LOOP
  w:=(home->>'width')::integer;h:=(home->>'height')::integer;
  IF w NOT BETWEEN 8 AND 20 OR h NOT BETWEEN 8 AND 20 OR (home->>'parkingSpaces')::integer NOT BETWEEN 1 AND 2 OR home->>'wall' NOT IN ('walnut','oak','cream','slate','sage','terracotta','navy') OR home->>'floor' NOT IN ('walnut','oak','cream','slate','sage','terracotta','navy') THEN RAISE EXCEPTION 'Invalid home dimensions or finish'; END IF;
  WITH fixtures AS (
   SELECT (value->'placement'->>'x')::integer x,(value->'placement'->>'y')::integer y,
    (simulator.furniture_catalogue()->(value->>'model')->>CASE WHEN (value->'placement'->>'rotation')::integer%180=0 THEN 0 ELSE 1 END)::integer fw,
    (simulator.furniture_catalogue()->(value->>'model')->>CASE WHEN (value->'placement'->>'rotation')::integer%180=0 THEN 1 ELSE 0 END)::integer fh,
    (value->'placement'->>'rotation')::integer rotation
   FROM jsonb_each(m->'items') WHERE value->>'homeId'=homes_id
  ), tiles AS (SELECT x+dx tx,y+dy ty FROM fixtures CROSS JOIN LATERAL generate_series(0,fw-1) dx CROSS JOIN LATERAL generate_series(0,fh-1) dy)
  SELECT EXISTS(SELECT 1 FROM fixtures WHERE x<0 OR y<0 OR x+fw>w OR y+fh>h OR rotation NOT IN (0,90,180,270)) OR EXISTS(SELECT 1 FROM tiles WHERE tx=4 AND ty IN (6,7)) OR EXISTS(SELECT 1 FROM tiles GROUP BY tx,ty HAVING count(*)>1) INTO blocked;
  IF blocked THEN RAISE EXCEPTION 'Furniture footprint collision'; END IF;
  IF NOT EXISTS(SELECT 1 FROM simulator.domain_records r WHERE r.world_id=NEW.id AND r.domain='furnishing.home' AND r.id=homes_id AND r.data=home) THEN RAISE EXCEPTION 'Home snapshot mirror mismatch'; END IF;
 END LOOP;
 FOR record IN SELECT value FROM jsonb_each(m->'parking') WHERE value->>'status'='parked' LOOP
  home:=m->'homes'->(record->>'homeId');item:=s->'mobility'->'vehicles'->(record->>'vehicleId');
  IF home IS NULL OR item IS NULL OR item->>'owner'<>record->>'actor' OR item->>'status'<>'parked' OR item->>'region'<>home->>'region' OR (record->>'slot')::integer NOT BETWEEN 1 AND (home->>'parkingSpaces')::integer THEN RAISE EXCEPTION 'Parking title location or capacity mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM simulator.domain_records r WHERE r.world_id=NEW.id AND r.domain='furnishing.parking' AND r.id=record->>'id' AND r.data=record) THEN RAISE EXCEPTION 'Parking snapshot mirror mismatch'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_each(m->'parking') WHERE value->>'status'='parked' GROUP BY value->>'vehicleId' HAVING count(*)>1) OR EXISTS(SELECT 1 FROM jsonb_each(m->'parking') WHERE value->>'status'='parked' GROUP BY value->>'homeId',value->>'slot' HAVING count(*)>1) THEN RAISE EXCEPTION 'Parking space is already occupied'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER furnishing_world_reconciles AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.furnishing_reconciles();
REVOKE ALL ON FUNCTION simulator.furniture_catalogue(),simulator.furniture_item_immutable(),simulator.furnishing_reconciles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.furniture_catalogue(),simulator.furniture_item_immutable(),simulator.furnishing_reconciles() TO simulator_server;
