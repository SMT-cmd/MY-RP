-- Additive local migration: timed home care, navigation, physical work/orders.
-- Not applied to hosted data during implementation. Existing acquisition stays immutable.
CREATE OR REPLACE FUNCTION simulator.furniture_catalogue() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,simulator AS $$ SELECT '{"bed":[2,2,85000,"Rest",1,false],"pantry":[1,1,32000,"RequestFoodAssistance",0,false],"sofa":[3,1,60000,"Sit",3,false],"desk":[2,1,35000,"Read",1,false],"sink":[1,1,28000,"Wash",1,false],"wardrobe":[1,2,48000,"Dress",1,false],"armchair":[1,1,25000,"Sit",1,false],"dining-table":[2,2,42000,"inspect",0,false],"dining-chair":[1,1,9500,"Sit",1,false],"bookshelf":[1,2,30000,"Read",1,false],"sideboard":[2,1,33000,"inspect",0,false],"plant":[1,1,7000,"inspect",0,false],"coffee-table":[2,1,19000,"inspect",0,false],"fridge":[1,1,68000,"inspect",0,false],"reed-sofa":[3,1,65000,"Sit",3,false],"reed-loveseat":[2,1,44000,"Sit",2,false],"reed-armchair":[1,1,28000,"Sit",1,false],"reed-dining-chair":[1,1,11000,"Sit",1,false],"reed-chaise":[2,1,39000,"Sit",1,false],"reed-ottoman":[1,1,14500,"Sit",1,false],"reed-bench":[2,1,22000,"Sit",2,false],"reed-bed":[2,2,90000,"Rest",1,false],"reed-single-bed":[1,2,55000,"Rest",1,false],"reed-desk":[2,1,38000,"Read",1,false],"reed-dining-table":[2,2,46000,"inspect",0,false],"reed-coffee-table":[2,1,21000,"inspect",0,false],"reed-side-table":[1,1,13000,"inspect",0,false],"reed-bookshelf":[1,2,34000,"Read",1,false],"reed-wardrobe":[1,2,52000,"Dress",1,false],"reed-sideboard":[2,1,37000,"inspect",0,false],"reed-display-case":[1,2,48000,"inspect",0,false],"reed-kitchen-island":[2,1,73000,"inspect",0,false],"reed-vanity":[2,1,58000,"Wash",1,false],"reed-plant":[1,1,9500,"inspect",0,false],"reed-floor-lamp":[1,1,18000,"Light",0,true],"reed-table-lamp":[1,1,16000,"Light",0,true],"reed-studio-light":[1,1,32000,"Light",0,true],"marina-sofa":[3,1,81300,"Sit",3,false],"marina-loveseat":[2,1,55000,"Sit",2,false],"marina-armchair":[1,1,35000,"Sit",1,false],"marina-dining-chair":[1,1,13800,"Sit",1,false],"marina-chaise":[2,1,48800,"Sit",1,false],"marina-ottoman":[1,1,18100,"Sit",1,false],"marina-bench":[2,1,27500,"Sit",2,false],"marina-bed":[2,2,112500,"Rest",1,false],"marina-single-bed":[1,2,68800,"Rest",1,false],"marina-desk":[2,1,47500,"Read",1,false],"marina-dining-table":[2,2,57500,"inspect",0,false],"marina-coffee-table":[2,1,26300,"inspect",0,false],"marina-side-table":[1,1,16300,"inspect",0,false],"marina-bookshelf":[1,2,42500,"Read",1,false],"marina-wardrobe":[1,2,65000,"Dress",1,false],"marina-sideboard":[2,1,46300,"inspect",0,false],"marina-display-case":[1,2,60000,"inspect",0,false],"marina-kitchen-island":[2,1,91300,"inspect",0,false],"marina-vanity":[2,1,72500,"Wash",1,false],"marina-plant":[1,1,11900,"inspect",0,false],"marina-floor-lamp":[1,1,22500,"Light",0,true],"marina-table-lamp":[1,1,20000,"Light",0,true],"marina-studio-light":[1,1,40000,"Light",0,true],"heritage-sofa":[3,1,97500,"Sit",3,false],"heritage-loveseat":[2,1,66000,"Sit",2,false],"heritage-armchair":[1,1,42000,"Sit",1,false],"heritage-dining-chair":[1,1,16500,"Sit",1,false],"heritage-chaise":[2,1,58500,"Sit",1,false],"heritage-ottoman":[1,1,21800,"Sit",1,false],"heritage-bench":[2,1,33000,"Sit",2,false],"heritage-bed":[2,2,135000,"Rest",1,false],"heritage-single-bed":[1,2,82500,"Rest",1,false],"heritage-desk":[2,1,57000,"Read",1,false],"heritage-dining-table":[2,2,69000,"inspect",0,false],"heritage-coffee-table":[2,1,31500,"inspect",0,false],"heritage-side-table":[1,1,19500,"inspect",0,false],"heritage-bookshelf":[1,2,51000,"Read",1,false],"heritage-wardrobe":[1,2,78000,"Dress",1,false],"heritage-sideboard":[2,1,55500,"inspect",0,false],"heritage-display-case":[1,2,72000,"inspect",0,false],"heritage-kitchen-island":[2,1,109500,"inspect",0,false],"heritage-vanity":[2,1,87000,"Wash",1,false],"heritage-plant":[1,1,14300,"inspect",0,false],"heritage-floor-lamp":[1,1,27000,"Light",0,true],"heritage-table-lamp":[1,1,24000,"Light",0,true],"heritage-studio-light":[1,1,48000,"Light",0,true],"atelier-sofa":[3,1,113800,"Sit",3,false],"atelier-loveseat":[2,1,77000,"Sit",2,false],"atelier-armchair":[1,1,49000,"Sit",1,false],"atelier-dining-chair":[1,1,19300,"Sit",1,false],"atelier-chaise":[2,1,68300,"Sit",1,false],"atelier-ottoman":[1,1,25400,"Sit",1,false],"atelier-bench":[2,1,38500,"Sit",2,false],"atelier-bed":[2,2,157500,"Rest",1,false],"atelier-single-bed":[1,2,96300,"Rest",1,false],"atelier-desk":[2,1,66500,"Read",1,false],"atelier-dining-table":[2,2,80500,"inspect",0,false],"atelier-coffee-table":[2,1,36800,"inspect",0,false],"atelier-side-table":[1,1,22800,"inspect",0,false],"atelier-bookshelf":[1,2,59500,"Read",1,false],"atelier-wardrobe":[1,2,91000,"Dress",1,false],"atelier-sideboard":[2,1,64800,"inspect",0,false],"atelier-display-case":[1,2,84000,"inspect",0,false],"atelier-kitchen-island":[2,1,127800,"inspect",0,false],"atelier-vanity":[2,1,101500,"Wash",1,false],"atelier-plant":[1,1,16600,"inspect",0,false],"atelier-floor-lamp":[1,1,31500,"Light",0,true],"atelier-table-lamp":[1,1,28000,"Light",0,true],"atelier-studio-light":[1,1,56000,"Light",0,true],"horizon-sofa":[3,1,130000,"Sit",3,false],"horizon-loveseat":[2,1,88000,"Sit",2,false],"horizon-armchair":[1,1,56000,"Sit",1,false],"horizon-dining-chair":[1,1,22000,"Sit",1,false],"horizon-chaise":[2,1,78000,"Sit",1,false],"horizon-ottoman":[1,1,29000,"Sit",1,false],"horizon-bench":[2,1,44000,"Sit",2,false],"horizon-bed":[2,2,180000,"Rest",1,false],"horizon-single-bed":[1,2,110000,"Rest",1,false],"horizon-desk":[2,1,76000,"Read",1,false],"horizon-dining-table":[2,2,92000,"inspect",0,false],"horizon-coffee-table":[2,1,42000,"inspect",0,false],"horizon-side-table":[1,1,26000,"inspect",0,false],"horizon-bookshelf":[1,2,68000,"Read",1,false],"horizon-wardrobe":[1,2,104000,"Dress",1,false],"horizon-sideboard":[2,1,74000,"inspect",0,false],"horizon-display-case":[1,2,96000,"inspect",0,false],"horizon-kitchen-island":[2,1,146000,"inspect",0,false],"horizon-vanity":[2,1,116000,"Wash",1,false],"horizon-plant":[1,1,19000,"inspect",0,false],"horizon-floor-lamp":[1,1,36000,"Light",0,true],"horizon-table-lamp":[1,1,32000,"Light",0,true],"horizon-studio-light":[1,1,64000,"Light",0,true],"regal-sofa":[3,1,162500,"Sit",3,false],"regal-loveseat":[2,1,110000,"Sit",2,false],"regal-armchair":[1,1,70000,"Sit",1,false],"regal-dining-chair":[1,1,27500,"Sit",1,false],"regal-chaise":[2,1,97500,"Sit",1,false],"regal-ottoman":[1,1,36300,"Sit",1,false],"regal-bench":[2,1,55000,"Sit",2,false],"regal-bed":[2,2,225000,"Rest",1,false],"regal-single-bed":[1,2,137500,"Rest",1,false],"regal-desk":[2,1,95000,"Read",1,false],"regal-dining-table":[2,2,115000,"inspect",0,false],"regal-coffee-table":[2,1,52500,"inspect",0,false],"regal-side-table":[1,1,32500,"inspect",0,false],"regal-bookshelf":[1,2,85000,"Read",1,false],"regal-wardrobe":[1,2,130000,"Dress",1,false],"regal-sideboard":[2,1,92500,"inspect",0,false],"regal-display-case":[1,2,120000,"inspect",0,false],"regal-kitchen-island":[2,1,182500,"inspect",0,false],"regal-vanity":[2,1,145000,"Wash",1,false],"regal-plant":[1,1,23800,"inspect",0,false],"regal-floor-lamp":[1,1,45000,"Light",0,true],"regal-table-lamp":[1,1,40000,"Light",0,true],"regal-studio-light":[1,1,80000,"Light",0,true],"television":[2,1,75000,"Watch",0,false],"toilet":[1,1,28000,"Toilet",1,false],"shower":[1,1,50000,"Shower",1,false]}'::jsonb $$;

CREATE OR REPLACE FUNCTION simulator.furnishing_reconciles() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE s jsonb:=NEW.state; m jsonb:=NEW.state->'furnishing'; item jsonb; home jsonb; record jsonb; dims jsonb; receipt jsonb; w integer; h integer; homes_id text; blocked boolean;
BEGIN
 IF m IS NULL THEN RETURN NULL; END IF;
 FOR item IN SELECT value FROM jsonb_each(m->'items') LOOP
  dims:=simulator.furniture_catalogue()->(item->>'model');
  IF dims IS NULL OR s->'citizens'->(item->>'owner') IS NULL OR item->>'finish' NOT IN ('walnut','oak','cream','slate','sage','terracotta','navy') OR (item->>'homeId' IS NOT NULL AND m->'homes'->(item->>'homeId') IS NULL) OR (item->>'homeId' IS NULL) IS DISTINCT FROM (item->>'placement' IS NULL) THEN RAISE EXCEPTION 'Furniture title or placement mismatch'; END IF;
  IF NOT (item->>'starter')::boolean THEN
   receipt:=s->'commands'->(item->>'purchaseKey')->'receipt';
   IF receipt IS NULL OR receipt->>'type' NOT IN ('BuyFurniture','BuyShowroomFurniture') OR receipt->>'actorId'<>item->>'owner' OR receipt->'detail'->>'furnitureId'<>item->>'id' OR (receipt->'detail'->>'amount')::bigint<>(dims->>2)::bigint THEN RAISE EXCEPTION 'Furniture lacks recorded purchase evidence'; END IF;
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

CREATE OR REPLACE FUNCTION simulator.furniture_use_reconciles() RETURNS trigger
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
  kind:=simulator.furniture_catalogue()->(item->>'model')->>3;
  capacity:=COALESCE((simulator.furniture_catalogue()->(item->>'model')->>4)::integer,0);
  receipt:=simulator.home_visit_receipt(NEW.id,s,a->>'useKey');
  IF item IS NULL OR kind IS NULL OR capacity<1 OR item->>'homeId' IS DISTINCT FROM p->>'homeId' OR (a->>'kind' IS DISTINCT FROM kind AND NOT(a->>'kind'='Clean' AND (kind IN ('Wash','Toilet','Shower'))))
   OR a->>'fixtureId' IS DISTINCT FROM coalesce(item->>'alias',item->>'id')
   OR jsonb_typeof(a->'slot') IS DISTINCT FROM 'number' OR (a->>'slot')::integer NOT BETWEEN 0 AND capacity-1
   OR jsonb_typeof(a->'startedAt') IS DISTINCT FROM 'number'
   OR receipt IS NULL OR receipt->>'type' IS DISTINCT FROM 'InteractHomeFixture' OR receipt->>'actorId' IS DISTINCT FROM actor
   OR receipt->>'at' IS DISTINCT FROM a->>'startedAt' OR receipt->'detail'->>'homeId' IS DISTINCT FROM p->>'homeId'
   OR receipt->'detail'->>'fixtureInstanceId' IS DISTINCT FROM a->>'instanceId'
   OR receipt->'detail'->>'fixtureUseSlot' IS DISTINCT FROM a->>'slot' OR receipt->'detail'->>'activityKind' IS DISTINCT FROM a->>'kind'
  THEN RAISE EXCEPTION 'Furniture use lacks position or interaction evidence'; END IF;
  claimed:=(p->>'homeId')||':'||(a->>'instanceId')||':'||(a->>'slot');
  IF claimed=ANY(occupied) THEN RAISE EXCEPTION 'Furniture use slot is already occupied'; END IF;occupied:=array_append(occupied,claimed);
 END LOOP;
 RETURN NULL;
END $$;

CREATE FUNCTION simulator.physical_records(s jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,simulator AS $$
 SELECT jsonb_build_object('physical.activity',coalesce(s#>'{furnishing,care,sessions}','{}'), 'physical.order',coalesce(s#>'{venues,orders}','{}'), 'physical.work',coalesce(s#>'{venues,work}','{}'), 'physical.driver',coalesce(s#>'{driving,drivers}','{}'), 'physical.vehicle-location',coalesce(s#>'{driving,locations}','{}'))
$$;
CREATE FUNCTION simulator.physical_gameplay_reconciles() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE s jsonb:=NEW.state; groups jsonb; group_name text; items jsonb; rid text; r jsonb; receipt jsonb; finish jsonb; p jsonb; a jsonb; nav jsonb; point jsonb; prior jsonb; actor text; duration bigint; n integer; xp bigint; kind text;
BEGIN
 groups:=simulator.physical_records(s);
 FOR group_name,items IN SELECT key,value FROM jsonb_each(groups) LOOP
  FOR rid,r IN SELECT key,value FROM jsonb_each(items) LOOP
   IF NOT EXISTS(SELECT 1 FROM simulator.domain_records d WHERE d.world_id=NEW.id AND d.domain=group_name AND d.id=rid AND d.data=r) THEN RAISE EXCEPTION 'Physical gameplay snapshot mirror mismatch'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM simulator.domain_records d WHERE d.world_id=NEW.id AND d.domain=group_name AND items->d.id IS DISTINCT FROM d.data) THEN RAISE EXCEPTION 'Orphan physical gameplay mirror'; END IF;
 END LOOP;
 FOR rid,r IN SELECT key,value FROM jsonb_each(groups->'physical.activity') LOOP
  actor:=r->>'actor';receipt:=s->'commands'->(r->>'useKey')->'receipt';kind:=r->>'kind';
  duration:=CASE kind WHEN 'Toilet' THEN 14000 WHEN 'Shower' THEN 18000 WHEN 'Clean' THEN 12000 WHEN 'Sit' THEN 10000 WHEN 'Read' THEN 10000 WHEN 'Dress' THEN 10000 WHEN 'Rest' THEN 10000 WHEN 'Wash' THEN 10000 ELSE NULL END;
  IF duration IS NULL OR s->'citizens'->actor IS NULL OR rid IS DISTINCT FROM r->>'id' OR receipt->>'type' IS DISTINCT FROM 'InteractHomeFixture' OR receipt->>'actorId' IS DISTINCT FROM actor OR receipt->>'at' IS DISTINCT FROM r->>'startedAt' OR (r->>'endsAt')::bigint IS DISTINCT FROM (r->>'startedAt')::bigint+duration
   OR receipt->'detail'->>'activitySessionId' IS DISTINCT FROM rid OR receipt->'detail'->>'activityEndsAt' IS DISTINCT FROM r->>'endsAt' OR receipt->'detail'->>'activityKind' IS DISTINCT FROM kind OR receipt->'detail'->>'fixtureInstanceId' IS DISTINCT FROM r->>'instanceId' OR receipt->'detail'->>'homeId' IS DISTINCT FROM r->>'homeId' OR receipt->'detail'->'activityOrigin' IS DISTINCT FROM r->'origin' OR receipt->'detail'->>'activityLeaseVersion' IS DISTINCT FROM r->>'leaseVersion' OR receipt->'detail'->>'activityHomeVersion' IS DISTINCT FROM r->>'homeVersion' OR receipt->'detail'->>'activityFixtureVersion' IS DISTINCT FROM r->>'fixtureVersion'
  THEN RAISE EXCEPTION 'Home activity lacks timed start evidence'; END IF;
  IF r ? 'completedAt' THEN
   finish:=s->'commands'->(r->>'completionKey')->'receipt';
   IF finish->>'type' IS DISTINCT FROM 'FinishHomeActivity' OR finish->>'actorId' IS DISTINCT FROM actor OR finish->'detail'->>'activitySessionId' IS DISTINCT FROM rid OR finish->>'at' IS DISTINCT FROM r->>'completedAt' OR finish->'detail'->>'completedAt' IS DISTINCT FROM r->>'completedAt' OR finish->'detail'->>'activityKind' IS DISTINCT FROM kind OR (r->>'completedAt')::bigint NOT BETWEEN (r->>'endsAt')::bigint AND (r->>'endsAt')::bigint+120000 THEN RAISE EXCEPTION 'Home activity lacks timed completion evidence'; END IF;
  END IF;
 END LOOP;
 FOR actor,a IN SELECT key,value FROM jsonb_each(coalesce(s#>'{furnishing,care,active}','{}')) LOOP
  r:=groups->'physical.activity'->(a#>>'{}');p:=s#>ARRAY['world','positions',actor];
  IF r->>'actor' IS DISTINCT FROM actor OR r ? 'completedAt' OR p->'activity'->>'useKey' IS DISTINCT FROM r->>'useKey' OR p->>'homeId' IS DISTINCT FROM r->>'homeId' OR p->>'leaseVersion' IS DISTINCT FROM r->>'leaseVersion' THEN RAISE EXCEPTION 'Active home activity lacks position evidence'; END IF;
 END LOOP;
 FOR actor,p IN SELECT key,value FROM jsonb_each(coalesce(s#>'{world,positions}','{}')) LOOP
  nav:=p->'navigation';IF nav IS NULL THEN CONTINUE; END IF;receipt:=s->'commands'->(nav->>'id')->'receipt';
  IF receipt->>'actorId' IS DISTINCT FROM actor OR receipt->>'type' NOT IN ('NavigateCitizen','BeginShowroomShuttle') OR receipt->>'at' IS DISTINCT FROM nav->>'startedAt' OR receipt->'detail'->'navigation' IS DISTINCT FROM nav OR nav->>'leaseVersion' IS DISTINCT FROM p->>'leaseVersion' OR (nav->>'stepMs')::integer IS DISTINCT FROM (CASE nav->>'mode' WHEN 'walk' THEN 300 WHEN 'drive' THEN 150 ELSE NULL END) OR jsonb_array_length(nav->'points') NOT BETWEEN 2 AND 513 THEN RAISE EXCEPTION 'Navigation receipt or speed mismatch'; END IF;
  prior:=NULL;n:=0;FOR point IN SELECT value FROM jsonb_array_elements(nav->'points') LOOP
   IF jsonb_typeof(point->'x') IS DISTINCT FROM 'number' OR jsonb_typeof(point->'y') IS DISTINCT FROM 'number' OR prior IS NOT NULL AND abs((point->>'x')::integer-(prior->>'x')::integer)+abs((point->>'y')::integer-(prior->>'y')::integer)<>1 THEN RAISE EXCEPTION 'Invalid physical navigation path'; END IF;prior:=point;n:=n+1;
  END LOOP;
 END LOOP;
 FOR rid,r IN SELECT key,value FROM jsonb_each(groups->'physical.order') LOOP
  receipt:=s->'commands'->(r->>'purchaseKey')->'receipt';actor:=r->>'actor';
  IF s->'citizens'->actor IS NULL OR receipt->>'type' IS DISTINCT FROM 'BuyShowroomFurniture' OR receipt->>'actorId' IS DISTINCT FROM actor OR receipt->'detail'->>'orderId' IS DISTINCT FROM rid OR receipt->'detail'->>'furnitureId' IS DISTINCT FROM r->>'furnitureId' OR receipt->'detail'->>'modelId' IS DISTINCT FROM r->>'modelId' OR receipt->>'at' IS DISTINCT FROM r->>'purchasedAt' THEN RAISE EXCEPTION 'Showroom order lacks purchase evidence'; END IF;
  IF r->>'collectedAt' IS NOT NULL THEN receipt:=s->'commands'->(r->>'collectKey')->'receipt';IF receipt->>'type' IS DISTINCT FROM 'CollectShowroomFurniture' OR receipt->>'actorId' IS DISTINCT FROM actor OR receipt->'detail'->>'orderId' IS DISTINCT FROM rid OR receipt->>'at' IS DISTINCT FROM r->>'collectedAt' THEN RAISE EXCEPTION 'Showroom order lacks collection evidence'; END IF; END IF;
  IF r->>'placedAt' IS NOT NULL THEN receipt:=s->'commands'->(r->>'placeKey')->'receipt';IF receipt->>'type' IS DISTINCT FROM 'PlaceFurniture' OR receipt->>'actorId' IS DISTINCT FROM actor OR receipt->'detail'->>'orderId' IS DISTINCT FROM rid OR receipt->>'at' IS DISTINCT FROM r->>'placedAt' OR r->>'collectedAt' IS NULL OR (r->>'xp')::integer<>25 OR receipt->'detail'->>'homeId' IS DISTINCT FROM r->>'homeId' THEN RAISE EXCEPTION 'Showroom order lacks placement evidence'; END IF;ELSIF (r->>'xp')::integer<>0 THEN RAISE EXCEPTION 'Unplaced showroom XP'; END IF;
 END LOOP;
 FOR actor,r IN SELECT key,value FROM jsonb_each(coalesce(s#>'{venues,designXp}','{}')) LOOP
  SELECT coalesce(sum((value->>'xp')::bigint),0) INTO xp FROM jsonb_each(groups->'physical.order') WHERE value->>'actor'=actor;
  IF (r#>>'{}')::bigint<>xp OR coalesce((s#>>ARRAY['citizens',actor,'life','skills','home-design'])::bigint,0)<>xp THEN RAISE EXCEPTION 'Home design XP mismatch'; END IF;
 END LOOP;
 FOR actor,r IN SELECT key,value FROM jsonb_each(groups->'physical.work') LOOP
  receipt:=s->'commands'->(r->>'beginKey')->'receipt';a:=s#>ARRAY['life','work','shifts',r->>'shiftId'];
  IF receipt->>'type' IS DISTINCT FROM 'BeginVenueWork' OR receipt->>'actorId' IS DISTINCT FROM actor OR receipt->'detail'->>'shiftId' IS DISTINCT FROM r->>'shiftId' OR receipt->'detail'->>'venueId' IS DISTINCT FROM r->>'venueId' OR a->>'status' IS DISTINCT FROM 'active' OR a->>'actorId' IS DISTINCT FROM actor OR a->>'steps' IS DISTINCT FROM r->>'completedTasks' OR (r->>'completedTasks')::integer NOT BETWEEN 0 AND 3 THEN RAISE EXCEPTION 'Physical work lacks reserved shift evidence';END IF;
  SELECT count(*) INTO n FROM jsonb_each(s->'commands') WHERE value->'receipt'->>'type'='CompleteVenueTask' AND value->'receipt'->>'actorId'=actor AND value->'receipt'->'detail'->>'shiftId'=r->>'shiftId';IF n<>(r->>'completedTasks')::integer THEN RAISE EXCEPTION 'Physical work lacks completed station receipts';END IF;
  a:=r->'task';IF a IS NOT NULL AND a<>'null'::jsonb THEN receipt:=s->'commands'->(a->>'commandKey')->'receipt';IF receipt->>'type' IS DISTINCT FROM 'BeginVenueTask' OR receipt->>'actorId' IS DISTINCT FROM actor OR receipt->'detail'->>'taskId' IS DISTINCT FROM a->>'id' OR receipt->>'at' IS DISTINCT FROM a->>'startedAt' OR (a->>'readyAt')::bigint IS DISTINCT FROM (a->>'startedAt')::bigint+5000 OR a->>'step' IS DISTINCT FROM r->>'completedTasks' THEN RAISE EXCEPTION 'Physical work lacks timed station evidence';END IF;END IF;
 END LOOP;
 FOR actor,r IN SELECT key,value FROM jsonb_each(groups->'physical.driver') LOOP
  p:=s#>ARRAY['world','positions',actor];receipt:=s->'commands'->(r->>'commandKey')->'receipt';
  IF p->>'interior' IS NOT NULL OR p->>'region' IS DISTINCT FROM r->>'region' OR p->>'x' IS DISTINCT FROM r->>'x' OR p->>'y' IS DISTINCT FROM r->>'y' OR receipt->>'actorId' IS DISTINCT FROM actor OR receipt->>'type' IS DISTINCT FROM (CASE WHEN (r->>'shuttle')::boolean THEN 'BeginShowroomShuttle' ELSE 'EnterVehicle' END) OR receipt->'detail'->>'leaseVersion' IS DISTINCT FROM p->>'leaseVersion' THEN RAISE EXCEPTION 'Local driver lacks entry or location evidence'; END IF;
  a:=r->'route';IF a IS NOT NULL AND a<>'null'::jsonb THEN
   receipt:=s->'commands'->(a->>'commandKey')->'receipt';nav:=p->'navigation';n:=CASE WHEN r->>'model'='van' THEN 50 ELSE 80 END;
   IF receipt->>'actorId' IS DISTINCT FROM actor OR receipt->'detail'->'navigation'->'points' IS DISTINCT FROM a->'points' OR nav->>'id' IS DISTINCT FROM a->>'commandKey' OR nav->'points' IS DISTINCT FROM a->'points' OR nav->>'mode' IS DISTINCT FROM 'drive' OR a->>'startedAt' IS DISTINCT FROM receipt->>'at' OR (a->>'stepMs')::integer<>150 OR (a->>'lastIndex')::integer NOT BETWEEN 0 AND jsonb_array_length(a->'points')-1 OR (a->>'tilesPerLitre')::integer<>n OR (a->>'reserved')::integer IS DISTINCT FROM (CASE WHEN (r->>'shuttle')::boolean THEN 0 ELSE ceil((jsonb_array_length(a->'points')-1)::numeric/n)::integer END) OR (a->>'consumed')::integer IS DISTINCT FROM (CASE WHEN (r->>'shuttle')::boolean THEN 0 ELSE ceil((a->>'lastIndex')::numeric/n)::integer END) OR coalesce((s#>>ARRAY['commerce','stock','balances','fuel:drive-fuel:'||(a->>'id')])::bigint,0)<>(a->>'reserved')::bigint-(a->>'consumed')::bigint THEN RAISE EXCEPTION 'Local drive route fuel or receipt mismatch';END IF;
  END IF;

 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER physical_gameplay_reconciles AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.physical_gameplay_reconciles();
CREATE FUNCTION simulator.physical_mirror_reconciles() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE r record;s jsonb;BEGIN
 IF TG_OP='DELETE' THEN r:=OLD;ELSE r:=NEW;END IF;
 IF r.domain LIKE 'physical.%' THEN SELECT state INTO s FROM simulator.worlds WHERE id=r.world_id;IF TG_OP='DELETE' THEN IF simulator.physical_records(s)->r.domain ? r.id THEN RAISE EXCEPTION 'Physical gameplay mirror removed while live';END IF;ELSIF simulator.physical_records(s)->r.domain->r.id IS DISTINCT FROM r.data THEN RAISE EXCEPTION 'Physical gameplay mirror mismatch';END IF;END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER physical_mirror_reconciles AFTER INSERT OR UPDATE OR DELETE ON simulator.domain_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.physical_mirror_reconciles();
REVOKE ALL ON FUNCTION simulator.physical_records(jsonb),simulator.physical_gameplay_reconciles(),simulator.physical_mirror_reconciles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.physical_records(jsonb),simulator.physical_gameplay_reconciles(),simulator.physical_mirror_reconciles() TO simulator_server;
-- Only ephemeral active-driver/work claims may be removed, by their actor in
-- the selected world. Historical receipts, orders and care records stay retained.
GRANT DELETE ON simulator.domain_records TO simulator_server;
CREATE POLICY physical_active_claim_delete ON simulator.domain_records AS RESTRICTIVE FOR DELETE TO simulator_server USING (
 domain IN ('physical.driver','physical.work') AND world_id=current_setting('simulator.world_id',true) AND id=current_setting('simulator.actor_id',true)
);
CREATE FUNCTION simulator.television_reconciles() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE item jsonb;r jsonb;a jsonb;BEGIN
 FOR item IN SELECT value FROM jsonb_each(coalesce(NEW.state#>'{furnishing,items}','{}')) LOOP
  a:=item->'screen';IF a IS NULL THEN CONTINUE;END IF;r:=NEW.state->'commands'->(a->>'commandKey')->'receipt';
  IF item->>'model'<>'television' OR jsonb_typeof(a->'enabled') IS DISTINCT FROM 'boolean' OR a->>'channel' NOT IN ('city','nature','learning') OR (a->>'version')::bigint<1 OR r->>'type' IS DISTINCT FROM 'SetHomeTelevision' OR r->>'actorId' IS DISTINCT FROM item->>'owner' OR r->'detail'->>'furnitureId' IS DISTINCT FROM item->>'id' OR (r->'detail'->>'previousVersion')::bigint IS DISTINCT FROM (a->>'version')::bigint-1 OR r->'detail'->'screen' IS DISTINCT FROM a-'commandKey' THEN RAISE EXCEPTION 'Television lacks saved settings evidence';END IF;
 END LOOP;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER television_reconciles AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.television_reconciles();
REVOKE ALL ON FUNCTION simulator.television_reconciles() FROM PUBLIC;GRANT EXECUTE ON FUNCTION simulator.television_reconciles() TO simulator_server;
