-- Preserve original prices and validate new furniture, light receipts and adult frames.
CREATE OR REPLACE FUNCTION simulator.furniture_catalogue() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,simulator AS $$ SELECT '{"bed":[2,2,85000,"Rest",1,false],"pantry":[1,1,32000,"RequestFoodAssistance",0,false],"sofa":[3,1,60000,"Sit",3,false],"desk":[2,1,35000,"Read",1,false],"sink":[1,1,28000,"Wash",1,false],"wardrobe":[1,2,48000,"Dress",1,false],"armchair":[1,1,25000,"Sit",1,false],"dining-table":[2,2,42000,"inspect",0,false],"dining-chair":[1,1,9500,"Sit",1,false],"bookshelf":[1,2,30000,"Read",1,false],"sideboard":[2,1,33000,"inspect",0,false],"plant":[1,1,7000,"inspect",0,false],"coffee-table":[2,1,19000,"inspect",0,false],"fridge":[1,1,68000,"inspect",0,false],"reed-sofa":[3,1,65000,"Sit",3,false],"reed-loveseat":[2,1,44000,"Sit",2,false],"reed-armchair":[1,1,28000,"Sit",1,false],"reed-dining-chair":[1,1,11000,"Sit",1,false],"reed-chaise":[2,1,39000,"Sit",1,false],"reed-ottoman":[1,1,14500,"Sit",1,false],"reed-bench":[2,1,22000,"Sit",2,false],"reed-bed":[2,2,90000,"Rest",1,false],"reed-single-bed":[1,2,55000,"Rest",1,false],"reed-desk":[2,1,38000,"Read",1,false],"reed-dining-table":[2,2,46000,"inspect",0,false],"reed-coffee-table":[2,1,21000,"inspect",0,false],"reed-side-table":[1,1,13000,"inspect",0,false],"reed-bookshelf":[1,2,34000,"Read",1,false],"reed-wardrobe":[1,2,52000,"Dress",1,false],"reed-sideboard":[2,1,37000,"inspect",0,false],"reed-display-case":[1,2,48000,"inspect",0,false],"reed-kitchen-island":[2,1,73000,"inspect",0,false],"reed-vanity":[2,1,58000,"Wash",1,false],"reed-plant":[1,1,9500,"inspect",0,false],"reed-floor-lamp":[1,1,18000,"Light",0,true],"reed-table-lamp":[1,1,16000,"Light",0,true],"reed-studio-light":[1,1,32000,"Light",0,true],"marina-sofa":[3,1,81300,"Sit",3,false],"marina-loveseat":[2,1,55000,"Sit",2,false],"marina-armchair":[1,1,35000,"Sit",1,false],"marina-dining-chair":[1,1,13800,"Sit",1,false],"marina-chaise":[2,1,48800,"Sit",1,false],"marina-ottoman":[1,1,18100,"Sit",1,false],"marina-bench":[2,1,27500,"Sit",2,false],"marina-bed":[2,2,112500,"Rest",1,false],"marina-single-bed":[1,2,68800,"Rest",1,false],"marina-desk":[2,1,47500,"Read",1,false],"marina-dining-table":[2,2,57500,"inspect",0,false],"marina-coffee-table":[2,1,26300,"inspect",0,false],"marina-side-table":[1,1,16300,"inspect",0,false],"marina-bookshelf":[1,2,42500,"Read",1,false],"marina-wardrobe":[1,2,65000,"Dress",1,false],"marina-sideboard":[2,1,46300,"inspect",0,false],"marina-display-case":[1,2,60000,"inspect",0,false],"marina-kitchen-island":[2,1,91300,"inspect",0,false],"marina-vanity":[2,1,72500,"Wash",1,false],"marina-plant":[1,1,11900,"inspect",0,false],"marina-floor-lamp":[1,1,22500,"Light",0,true],"marina-table-lamp":[1,1,20000,"Light",0,true],"marina-studio-light":[1,1,40000,"Light",0,true],"heritage-sofa":[3,1,97500,"Sit",3,false],"heritage-loveseat":[2,1,66000,"Sit",2,false],"heritage-armchair":[1,1,42000,"Sit",1,false],"heritage-dining-chair":[1,1,16500,"Sit",1,false],"heritage-chaise":[2,1,58500,"Sit",1,false],"heritage-ottoman":[1,1,21800,"Sit",1,false],"heritage-bench":[2,1,33000,"Sit",2,false],"heritage-bed":[2,2,135000,"Rest",1,false],"heritage-single-bed":[1,2,82500,"Rest",1,false],"heritage-desk":[2,1,57000,"Read",1,false],"heritage-dining-table":[2,2,69000,"inspect",0,false],"heritage-coffee-table":[2,1,31500,"inspect",0,false],"heritage-side-table":[1,1,19500,"inspect",0,false],"heritage-bookshelf":[1,2,51000,"Read",1,false],"heritage-wardrobe":[1,2,78000,"Dress",1,false],"heritage-sideboard":[2,1,55500,"inspect",0,false],"heritage-display-case":[1,2,72000,"inspect",0,false],"heritage-kitchen-island":[2,1,109500,"inspect",0,false],"heritage-vanity":[2,1,87000,"Wash",1,false],"heritage-plant":[1,1,14300,"inspect",0,false],"heritage-floor-lamp":[1,1,27000,"Light",0,true],"heritage-table-lamp":[1,1,24000,"Light",0,true],"heritage-studio-light":[1,1,48000,"Light",0,true],"atelier-sofa":[3,1,113800,"Sit",3,false],"atelier-loveseat":[2,1,77000,"Sit",2,false],"atelier-armchair":[1,1,49000,"Sit",1,false],"atelier-dining-chair":[1,1,19300,"Sit",1,false],"atelier-chaise":[2,1,68300,"Sit",1,false],"atelier-ottoman":[1,1,25400,"Sit",1,false],"atelier-bench":[2,1,38500,"Sit",2,false],"atelier-bed":[2,2,157500,"Rest",1,false],"atelier-single-bed":[1,2,96300,"Rest",1,false],"atelier-desk":[2,1,66500,"Read",1,false],"atelier-dining-table":[2,2,80500,"inspect",0,false],"atelier-coffee-table":[2,1,36800,"inspect",0,false],"atelier-side-table":[1,1,22800,"inspect",0,false],"atelier-bookshelf":[1,2,59500,"Read",1,false],"atelier-wardrobe":[1,2,91000,"Dress",1,false],"atelier-sideboard":[2,1,64800,"inspect",0,false],"atelier-display-case":[1,2,84000,"inspect",0,false],"atelier-kitchen-island":[2,1,127800,"inspect",0,false],"atelier-vanity":[2,1,101500,"Wash",1,false],"atelier-plant":[1,1,16600,"inspect",0,false],"atelier-floor-lamp":[1,1,31500,"Light",0,true],"atelier-table-lamp":[1,1,28000,"Light",0,true],"atelier-studio-light":[1,1,56000,"Light",0,true],"horizon-sofa":[3,1,130000,"Sit",3,false],"horizon-loveseat":[2,1,88000,"Sit",2,false],"horizon-armchair":[1,1,56000,"Sit",1,false],"horizon-dining-chair":[1,1,22000,"Sit",1,false],"horizon-chaise":[2,1,78000,"Sit",1,false],"horizon-ottoman":[1,1,29000,"Sit",1,false],"horizon-bench":[2,1,44000,"Sit",2,false],"horizon-bed":[2,2,180000,"Rest",1,false],"horizon-single-bed":[1,2,110000,"Rest",1,false],"horizon-desk":[2,1,76000,"Read",1,false],"horizon-dining-table":[2,2,92000,"inspect",0,false],"horizon-coffee-table":[2,1,42000,"inspect",0,false],"horizon-side-table":[1,1,26000,"inspect",0,false],"horizon-bookshelf":[1,2,68000,"Read",1,false],"horizon-wardrobe":[1,2,104000,"Dress",1,false],"horizon-sideboard":[2,1,74000,"inspect",0,false],"horizon-display-case":[1,2,96000,"inspect",0,false],"horizon-kitchen-island":[2,1,146000,"inspect",0,false],"horizon-vanity":[2,1,116000,"Wash",1,false],"horizon-plant":[1,1,19000,"inspect",0,false],"horizon-floor-lamp":[1,1,36000,"Light",0,true],"horizon-table-lamp":[1,1,32000,"Light",0,true],"horizon-studio-light":[1,1,64000,"Light",0,true],"regal-sofa":[3,1,162500,"Sit",3,false],"regal-loveseat":[2,1,110000,"Sit",2,false],"regal-armchair":[1,1,70000,"Sit",1,false],"regal-dining-chair":[1,1,27500,"Sit",1,false],"regal-chaise":[2,1,97500,"Sit",1,false],"regal-ottoman":[1,1,36300,"Sit",1,false],"regal-bench":[2,1,55000,"Sit",2,false],"regal-bed":[2,2,225000,"Rest",1,false],"regal-single-bed":[1,2,137500,"Rest",1,false],"regal-desk":[2,1,95000,"Read",1,false],"regal-dining-table":[2,2,115000,"inspect",0,false],"regal-coffee-table":[2,1,52500,"inspect",0,false],"regal-side-table":[1,1,32500,"inspect",0,false],"regal-bookshelf":[1,2,85000,"Read",1,false],"regal-wardrobe":[1,2,130000,"Dress",1,false],"regal-sideboard":[2,1,92500,"inspect",0,false],"regal-display-case":[1,2,120000,"inspect",0,false],"regal-kitchen-island":[2,1,182500,"inspect",0,false],"regal-vanity":[2,1,145000,"Wash",1,false],"regal-plant":[1,1,23800,"inspect",0,false],"regal-floor-lamp":[1,1,45000,"Light",0,true],"regal-table-lamp":[1,1,40000,"Light",0,true],"regal-studio-light":[1,1,80000,"Light",0,true]}'::jsonb $$;

-- Presentation use positions are private and share the existing atomic world
-- and command mirrors. Expiry has no money, rewards or scheduled service.
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
  IF item IS NULL OR kind IS NULL OR capacity<1 OR item->>'homeId' IS DISTINCT FROM p->>'homeId' OR a->>'kind' IS DISTINCT FROM kind
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

-- Curated cosmetic profiles remain private and are backed by immutable command receipts.
CREATE OR REPLACE FUNCTION simulator.citizen_appearance_reconcile() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE actor text; citizen jsonb; profile jsonb; v bigint;
BEGIN
 FOR actor,citizen IN SELECT key,value FROM jsonb_each(NEW.state->'citizens') LOOP
  IF NOT citizen ? 'appearance' THEN CONTINUE; END IF; -- Existing saves use the default renderer.
  profile:=citizen->'appearance';
  IF jsonb_typeof(profile) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid citizen appearance'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(profile))<>8
   OR jsonb_typeof(profile->'version') IS DISTINCT FROM 'number'
   OR (profile->>'version')::numeric<>trunc((profile->>'version')::numeric)
   OR (profile->>'version')::numeric NOT BETWEEN 1 AND 9007199254740991
   OR COALESCE(profile->>'skin','') NOT IN ('umber','cocoa','bronze','copper','warm','light')
   OR COALESCE(profile->>'frame','') NOT IN ('slender','balanced','broad','curved','curved-broad')
   OR COALESCE(profile->>'hair','') NOT IN ('crop','afro','locs','braids','shaved')
   OR COALESCE(profile->>'hairColour','') NOT IN ('black','brown','silver')
   OR COALESCE(profile->>'outfit','') NOT IN ('tee','linen','tunic','jacket')
   OR COALESCE(profile->>'top','') NOT IN ('teal','ochre','cream','wine','navy','sage')
   OR COALESCE(profile->>'bottom','') NOT IN ('charcoal','sand','olive','denim') THEN RAISE EXCEPTION 'Invalid citizen appearance'; END IF;
  v:=(profile->>'version')::bigint;
  IF NOT EXISTS(SELECT 1 FROM jsonb_each(NEW.state->'commands') c WHERE c.value->'receipt'->>'actorId'=actor AND c.value->'receipt'->'detail'->'appearance'=profile
   AND ((v=1 AND c.value->'receipt'->>'type'='CreateCitizen') OR (v>1 AND c.value->'receipt'->>'type'='ChangeAppearance' AND (c.value->'receipt'->'detail'->>'previousVersion')::bigint=v-1))) THEN RAISE EXCEPTION 'Appearance lacks saved command evidence'; END IF;
 END LOOP;
 RETURN NULL;
END $$;

-- Only saved, owned interaction receipts authorise a light setting.
CREATE FUNCTION simulator.furniture_light_reconciles() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE item jsonb; light jsonb; receipt jsonb; detail jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_each(COALESCE(NEW.state->'furnishing'->'items','{}'::jsonb)) LOOP
  IF NOT item ? 'light' THEN CONTINUE; END IF;
  light:=item->'light';
  IF jsonb_typeof(light) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid furniture light'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(light))<>5
   OR simulator.furniture_catalogue()->(item->>'model')->>5 IS DISTINCT FROM 'true'
   OR jsonb_typeof(light->'enabled') IS DISTINCT FROM 'boolean'
   OR COALESCE(light->>'scene','') NOT IN ('warm','daylight','ocean','sunset','club')
   OR jsonb_typeof(light->'brightness') IS DISTINCT FROM 'number'
   OR (light->>'brightness')::numeric<>trunc((light->>'brightness')::numeric)
   OR (light->>'brightness')::numeric NOT BETWEEN 0 AND 100
   OR jsonb_typeof(light->'version') IS DISTINCT FROM 'number'
   OR (light->>'version')::numeric<>trunc((light->>'version')::numeric)
   OR (light->>'version')::numeric NOT BETWEEN 1 AND 9007199254740991
  THEN RAISE EXCEPTION 'Invalid furniture light'; END IF;
  receipt:=simulator.home_visit_receipt(NEW.id,NEW.state,light->>'commandKey'); detail:=receipt->'detail';
  IF receipt IS NULL OR receipt->>'type' IS DISTINCT FROM 'SetFurnitureLight'
   OR receipt->>'actorId' IS DISTINCT FROM item->>'owner'
   OR detail->>'furnitureId' IS DISTINCT FROM item->>'id'
   OR detail->'previousVersion' IS DISTINCT FROM to_jsonb((light->>'version')::bigint-1)
   OR detail->'light' IS DISTINCT FROM light-'commandKey'
  THEN RAISE EXCEPTION 'Light lacks saved interaction evidence'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER furniture_light_reconciles AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.furniture_light_reconciles();

REVOKE ALL ON FUNCTION simulator.furniture_catalogue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.furniture_catalogue() TO simulator_server;
REVOKE ALL ON FUNCTION simulator.furniture_use_reconciles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.furniture_use_reconciles() TO simulator_server;
REVOKE ALL ON FUNCTION simulator.citizen_appearance_reconcile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.citizen_appearance_reconcile() TO simulator_server;
REVOKE ALL ON FUNCTION simulator.furniture_light_reconciles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.furniture_light_reconciles() TO simulator_server;
