-- Additive private-schema constraints; existing open-plan homes remain compatible.
CREATE FUNCTION simulator.interior_partitions_reconcile() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE s jsonb:=NEW.state; home_id text; home jsonb; edge jsonb; receipt jsonb; w integer; h integer; reached integer; available integer; invalid boolean; labour bigint; material_units integer; consumed bigint; paid bigint;
BEGIN
 FOR home_id,home IN SELECT key,value FROM jsonb_each(COALESCE(s->'furnishing'->'homes','{}'::jsonb)) LOOP
  w:=(home->>'width')::integer;h:=(home->>'height')::integer;
  IF home ? 'partitions' AND jsonb_typeof(home->'partitions')<>'array' THEN RAISE EXCEPTION 'Invalid partition array'; END IF;
  IF jsonb_array_length(COALESCE(home->'partitions','[]'::jsonb))>100 THEN RAISE EXCEPTION 'Partition capacity exceeded'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(home->'partitions','[]'::jsonb)) e GROUP BY e->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate partition edge'; END IF;
  FOR edge IN SELECT value FROM jsonb_array_elements(COALESCE(home->'partitions','[]'::jsonb)) LOOP
   IF edge->>'axis' IS NULL OR edge->>'axis' NOT IN ('h','v') OR jsonb_typeof(edge->'x') IS DISTINCT FROM 'number' OR jsonb_typeof(edge->'y') IS DISTINCT FROM 'number' OR jsonb_typeof(edge->'door') IS DISTINCT FROM 'boolean'
    OR (edge->>'x')::numeric<>trunc((edge->>'x')::numeric) OR (edge->>'y')::numeric<>trunc((edge->>'y')::numeric)
    OR edge->>'id' IS DISTINCT FROM (edge->>'axis')||':'||(edge->>'x')||':'||(edge->>'y')
    OR (edge->>'axis'='v' AND ((edge->>'x')::integer NOT BETWEEN 1 AND w-1 OR (edge->>'y')::integer NOT BETWEEN 0 AND h-1))
    OR (edge->>'axis'='h' AND ((edge->>'x')::integer NOT BETWEEN 0 AND w-1 OR (edge->>'y')::integer NOT BETWEEN 1 AND h-1)) THEN RAISE EXCEPTION 'Invalid partition edge'; END IF;
   receipt:=s->'commands'->(edge->>'purchaseKey')->'receipt';
   IF s->'citizens'->(edge->>'builtBy') IS NULL OR receipt IS NULL OR receipt->>'type' IS DISTINCT FROM 'BuildHomePartition' OR receipt->>'actorId' IS DISTINCT FROM edge->>'builtBy' OR receipt->'detail'->>'homeId' IS DISTINCT FROM home_id OR jsonb_typeof(receipt->'detail'->'partitions') IS DISTINCT FROM 'array' OR NOT receipt->'detail'->'partitions' @> jsonb_build_array(edge) THEN RAISE EXCEPTION 'Partition lacks construction evidence'; END IF;
   labour:=jsonb_array_length(receipt->'detail'->'partitions')*2500 + (SELECT count(*)*1000 FROM jsonb_array_elements(receipt->'detail'->'partitions') p WHERE (p->>'door')::boolean);
   material_units:=ceil(jsonb_array_length(receipt->'detail'->'partitions')::numeric/3)::integer;
   SELECT COALESCE(sum((e->>'quantity')::bigint),0) INTO consumed FROM jsonb_array_elements(COALESCE(s->'commerce'->'stock'->'journals','[]'::jsonb)) j CROSS JOIN LATERAL jsonb_array_elements(j->'entries') e WHERE j->>'goods'='materials' AND left(j->>'id',length('consume:'||(edge->>'purchaseKey')||':partitions:'))='consume:'||(edge->>'purchaseKey')||':partitions:' AND e->>'account'='system:interior-construction';
   SELECT COALESCE(sum((e->>'amount')::bigint),0) INTO paid FROM jsonb_array_elements(s->'journals') j CROSS JOIN LATERAL jsonb_array_elements(j->'entries') e WHERE j->>'id'=edge->>'purchaseKey' AND e->>'account'='system:construction-provider';
   IF (receipt->'detail'->>'labour')::bigint IS DISTINCT FROM labour OR (receipt->'detail'->>'materials')::integer IS DISTINCT FROM material_units OR consumed<>material_units OR paid<>labour THEN RAISE EXCEPTION 'Partition construction inputs do not reconcile'; END IF;
  END LOOP;
  IF jsonb_array_length(COALESCE(home->'partitions','[]'::jsonb))=0 THEN CONTINUE; END IF;
  WITH RECURSIVE edges AS (
   SELECT (e->>'x')::integer x,(e->>'y')::integer y,e->>'axis' axis,(e->>'door')::boolean door FROM jsonb_array_elements(home->'partitions') e
  ), fixtures AS (
   SELECT (i->'placement'->>'x')::integer x,(i->'placement'->>'y')::integer y,
    (simulator.furniture_catalogue()->(i->>'model')->>CASE WHEN (i->'placement'->>'rotation')::integer%180=0 THEN 0 ELSE 1 END)::integer fw,
    (simulator.furniture_catalogue()->(i->>'model')->>CASE WHEN (i->'placement'->>'rotation')::integer%180=0 THEN 1 ELSE 0 END)::integer fh
   FROM jsonb_each(s->'furnishing'->'items') i0 CROSS JOIN LATERAL (SELECT i0.value i) q WHERE i->>'homeId'=home_id
  ), tiles AS (SELECT gx x,gy y FROM generate_series(0,w-1) gx CROSS JOIN generate_series(0,h-1) gy WHERE NOT EXISTS(SELECT 1 FROM fixtures f WHERE gx>=f.x AND gx<f.x+fw AND gy>=f.y AND gy<f.y+fh)),
  reach(x,y) AS (
   SELECT 4,6 UNION SELECT n.x,n.y FROM reach r JOIN tiles n ON abs(n.x-r.x)+abs(n.y-r.y)=1 WHERE NOT EXISTS(SELECT 1 FROM edges e WHERE NOT door AND ((e.axis='v' AND n.x<>r.x AND e.x=greatest(n.x,r.x) AND e.y=r.y) OR (e.axis='h' AND n.y<>r.y AND e.y=greatest(n.y,r.y) AND e.x=r.x)))
  )
  SELECT (SELECT count(*) FROM reach),(SELECT count(*) FROM tiles),
   EXISTS(SELECT 1 FROM edges e JOIN fixtures f ON (e.axis='v' AND f.x<e.x AND e.x<f.x+fw AND e.y>=f.y AND e.y<f.y+fh) OR (e.axis='h' AND f.y<e.y AND e.y<f.y+fh AND e.x>=f.x AND e.x<f.x+fw))
   OR EXISTS(SELECT 1 FROM edges e WHERE door AND (NOT EXISTS(SELECT 1 FROM tiles t WHERE t.x=e.x AND t.y=e.y) OR NOT EXISTS(SELECT 1 FROM tiles t WHERE t.x=e.x-CASE WHEN e.axis='v' THEN 1 ELSE 0 END AND t.y=e.y-CASE WHEN e.axis='h' THEN 1 ELSE 0 END)))
   OR EXISTS(SELECT 1 FROM fixtures f WHERE NOT EXISTS(SELECT 1 FROM reach r WHERE greatest(f.x-r.x,0,r.x-f.x-fw+1)+greatest(f.y-r.y,0,r.y-f.y-fh+1)=1 AND NOT EXISTS(SELECT 1 FROM edges e WHERE NOT door AND ((e.axis='v' AND greatest(f.x,least(r.x,f.x+fw-1))<>r.x AND e.x=greatest(r.x,greatest(f.x,least(r.x,f.x+fw-1))) AND e.y=r.y) OR (e.axis='h' AND greatest(f.y,least(r.y,f.y+fh-1))<>r.y AND e.y=greatest(r.y,greatest(f.y,least(r.y,f.y+fh-1))) AND e.x=r.x))))) INTO reached,available,invalid;
  IF reached<>available OR invalid THEN RAISE EXCEPTION 'Partitions must preserve reachable rooms, fixtures and clear doors'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER interior_partitions_world_reconciles AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.interior_partitions_reconcile();
REVOKE ALL ON FUNCTION simulator.interior_partitions_reconcile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.interior_partitions_reconcile() TO simulator_server;
