-- Private consent records use existing world-scoped RLS. No public API or
-- SECURITY DEFINER function is introduced. This migration is local until reviewed.
CREATE FUNCTION simulator.home_resident(s jsonb, actor text, home_id text) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,simulator AS $$
DECLARE home jsonb:=s->'furnishing'->'homes'->home_id; citizen jsonb:=s->'citizens'->actor; asset jsonb; lease jsonb; expected text;
BEGIN
 IF home IS NULL OR citizen IS NULL OR s->'world'->'positions'->actor IS NULL THEN RETURN false; END IF;
 asset:=s->'property'->'assets'->(citizen->>'housing');
 SELECT value INTO lease FROM jsonb_each(coalesce(s->'property'->'tenancies','{}'::jsonb)) WHERE value->>'property'=citizen->>'housing' AND value->>'status'<>'ended' LIMIT 1;
 IF asset->>'kind'='home' AND asset->>'status'='ready' AND asset->>'region'=home->>'region' AND (CASE WHEN lease IS NOT NULL THEN lease->>'tenant'=actor ELSE asset->>'owner'=actor END) THEN expected:=asset->>'id';
 ELSE expected:='starter_'||substring(encode(sha256(convert_to(actor||':'||(home->>'region'),'UTF8')),'hex'),1,24); END IF;
 RETURN home_id=expected;
END $$;
CREATE FUNCTION simulator.home_visit_core(v jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,simulator AS $$
 SELECT v-ARRAY['version','status','acceptedKey','closedKey','closedAt','closeReason']
$$;
-- Visit records contain scalar fields only; match the application's canonical
-- JSON hash without attaching anyone else's invitation details to a receipt.
CREATE FUNCTION simulator.home_visit_hash(v jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,simulator AS $$
 SELECT encode(sha256(convert_to('{'||string_agg(to_jsonb(key)::text||':'||value::text,',' ORDER BY key COLLATE "C")||'}','UTF8')),'hex') FROM jsonb_each(v)
$$;
CREATE FUNCTION simulator.home_visit_receipt(wid text, s jsonb, command_key text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,simulator AS $$
 SELECT receipt FROM simulator.commands WHERE world_id=wid AND actor_id=split_part(command_key,':',1) AND id=split_part(command_key,':',2) AND receipt=s->'commands'->command_key->'receipt'
$$;
CREATE FUNCTION simulator.home_visit_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
BEGIN
 IF OLD.domain<>'furnishing.visit' THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Home visit evidence cannot be deleted'; END IF;
 IF OLD.data->>'status' IN ('ended','declined') AND OLD.data IS DISTINCT FROM NEW.data THEN RAISE EXCEPTION 'Finished home visit is immutable'; END IF;
 IF OLD.data IS DISTINCT FROM NEW.data THEN
  IF simulator.home_visit_core(OLD.data) IS DISTINCT FROM simulator.home_visit_core(NEW.data)
   OR (NEW.data->>'version')::bigint<>(OLD.data->>'version')::bigint+1
   OR NOT ((OLD.data->>'status'='invited' AND NEW.data->>'status' IN ('accepted','declined','ended')) OR (OLD.data->>'status'='accepted' AND NEW.data->>'status'='ended'))
   OR (OLD.data->>'acceptedKey' IS NOT NULL AND OLD.data->>'acceptedKey' IS DISTINCT FROM NEW.data->>'acceptedKey')
  THEN RAISE EXCEPTION 'Home visit terms or transition are immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER home_visit_immutable BEFORE UPDATE OR DELETE ON simulator.domain_records FOR EACH ROW EXECUTE FUNCTION simulator.home_visit_immutable();

CREATE FUNCTION simulator.home_visit_mirror() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE s jsonb; expected jsonb; actual jsonb;
BEGIN
 IF NEW.domain NOT IN ('furnishing.visit','world.position') THEN RETURN NULL; END IF;
 SELECT state INTO s FROM simulator.worlds WHERE id=NEW.world_id;
 IF NEW.domain='furnishing.visit' THEN expected:=s->'furnishing'->'visits'->NEW.id; ELSE expected:=s->'world'->'positions'->NEW.id; END IF;
 SELECT data INTO actual FROM simulator.domain_records WHERE world_id=NEW.world_id AND domain=NEW.domain AND id=NEW.id;
 IF expected IS NULL OR expected IS DISTINCT FROM actual THEN RAISE EXCEPTION 'Home visit or position mirror mismatch'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER home_visit_mirror AFTER INSERT OR UPDATE ON simulator.domain_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.home_visit_mirror();

CREATE FUNCTION simulator.home_visits_reconcile() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE s jsonb:=NEW.state; visits jsonb:=coalesce(NEW.state->'furnishing'->'visits','{}'::jsonb); vid text; v jsonb; core jsonb; source jsonb; consent jsonb; ending jsonb; p jsonb; actor text; host_home jsonb; pair_blocked boolean;
BEGIN
 IF (SELECT count(*) FROM simulator.domain_records WHERE world_id=NEW.id AND domain='furnishing.visit')<>(SELECT count(*) FROM jsonb_each(visits)) THEN RAISE EXCEPTION 'Home invitation mirror count mismatch'; END IF;
 FOR vid,v IN SELECT key,value FROM jsonb_each(visits) LOOP
  core:=simulator.home_visit_core(v);host_home:=s->'furnishing'->'homes'->(v->>'homeId');
  IF v->>'id' IS DISTINCT FROM vid OR host_home IS NULL OR s->'citizens'->(v->>'host') IS NULL OR s->'citizens'->(v->>'guest') IS NULL OR v->>'host'=v->>'guest'
   OR v->>'hostResidence' IS NULL OR v->>'termsVersion' IS DISTINCT FROM 'home-visits-v1' OR (v->>'createdAt')::bigint<0
   OR (v->>'expiresAt')::bigint-(v->>'createdAt')::bigint NOT IN (900000,1800000,3600000)
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['id','homeId','host','hostResidence','guest','termsVersion','status','sourceKey']) field WHERE jsonb_typeof(v->field) IS DISTINCT FROM 'string')
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['createdAt','expiresAt','version']) field WHERE jsonb_typeof(v->field) IS DISTINCT FROM 'number')
   OR (v->>'expiresAt')::bigint>9007199254740991 OR (v->>'version')::integer NOT IN (1,2,3)
   OR EXISTS(SELECT 1 FROM jsonb_each(v) WHERE jsonb_typeof(value) NOT IN ('string','number'))
  THEN RAISE EXCEPTION 'Invalid home visit terms'; END IF;
  source:=simulator.home_visit_receipt(NEW.id,s,v->>'sourceKey');
  IF source IS NULL OR source->>'type' IS DISTINCT FROM 'InviteHomeVisit' OR source->>'actorId' IS DISTINCT FROM v->>'host'
   OR source->>'at' IS DISTINCT FROM v->>'createdAt' OR source->'detail'->'visit' IS DISTINCT FROM core||'{"status":"invited","version":1}'::jsonb
  THEN RAISE EXCEPTION 'Home invitation lacks resident terms evidence'; END IF;
  IF v->>'acceptedKey' IS NOT NULL THEN
   consent:=simulator.home_visit_receipt(NEW.id,s,v->>'acceptedKey');
   IF consent IS NULL OR consent->>'type' IS DISTINCT FROM 'AcceptHomeVisit' OR consent->>'actorId' IS DISTINCT FROM v->>'guest'
    OR (consent->>'at')::bigint<(v->>'createdAt')::bigint OR (consent->>'at')::bigint>=(v->>'expiresAt')::bigint
    OR consent->'detail'->'visit' IS DISTINCT FROM core||jsonb_build_object('status','accepted','version',2,'acceptedKey',v->>'acceptedKey')
   THEN RAISE EXCEPTION 'Home visit lacks guest consent evidence'; END IF;
  END IF;
  pair_blocked:=coalesce(s->'life'->'blocks'->(v->>'host') ? (v->>'guest'),false) OR coalesce(s->'life'->'blocks'->(v->>'guest') ? (v->>'host'),false);
  IF v->>'status' IN ('invited','accepted') THEN
   IF NOT simulator.home_resident(s,v->>'host',v->>'homeId') OR s->'citizens'->(v->>'host')->>'housing' IS DISTINCT FROM v->>'hostResidence' OR pair_blocked
    OR v ?| ARRAY['closedKey','closedAt','closeReason']
    OR (v->>'status'='invited' AND ((v->>'version')::integer<>1 OR v ? 'acceptedKey'))
    OR (v->>'status'='accepted' AND ((v->>'version')::integer<>2 OR v->>'acceptedKey' IS NULL))
   THEN RAISE EXCEPTION 'Home visit lacks current permission'; END IF;
  ELSIF v->>'status' IN ('declined','ended') THEN
   ending:=simulator.home_visit_receipt(NEW.id,s,v->>'closedKey');
   IF ending IS NULL OR ending->>'at' IS DISTINCT FROM v->>'closedAt' OR (v->>'closedAt')::bigint<(v->>'createdAt')::bigint
    OR (v->>'version')::integer<>(CASE WHEN v ? 'acceptedKey' THEN 3 ELSE 2 END)
    OR v->>'closeReason' IS NULL OR v->>'closeReason' NOT IN ('declined','withdrawn','guest-ended','expired','residence-changed','blocked')
    OR NOT (coalesce(ending->'detail'->'visit'=v,false) OR coalesce(ending->'detail'->'homeVisitClosureProofs' ? simulator.home_visit_hash(v),false))
    OR (v->>'status'='declined' AND (v ? 'acceptedKey' OR v->>'closeReason'<>'declined'))
    OR (v->>'closeReason'='expired' AND (v->>'closedAt')::bigint<(v->>'expiresAt')::bigint)
    OR (v->>'closeReason'='declined' AND (ending->>'type'<>'DeclineHomeVisit' OR ending->>'actorId'<>v->>'guest'))
    OR (v->>'closeReason'='withdrawn' AND (ending->>'type'<>'WithdrawHomeVisit' OR ending->>'actorId'<>v->>'host'))
    OR (v->>'closeReason'='guest-ended' AND (ending->>'type'<>'EndHomeVisit' OR ending->>'actorId'<>v->>'guest'))
   THEN RAISE EXCEPTION 'Home visit lacks closure evidence'; END IF;
  ELSE RAISE EXCEPTION 'Invalid home visit status'; END IF;
  IF NOT EXISTS(SELECT 1 FROM simulator.domain_records r WHERE r.world_id=NEW.id AND r.domain='furnishing.visit' AND r.id=vid AND r.data=v) THEN RAISE EXCEPTION 'Home visit snapshot mirror mismatch'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_each(visits) WHERE value->>'status' IN ('invited','accepted') GROUP BY value->>'homeId' HAVING count(*)>8)
  OR EXISTS(SELECT 1 FROM jsonb_each(visits) WHERE value->>'status' IN ('invited','accepted') GROUP BY value->>'homeId',value->>'guest' HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Home visit capacity mismatch'; END IF;
 FOR actor,p IN SELECT key,value FROM jsonb_each(coalesce(s->'world'->'positions','{}'::jsonb)) LOOP
  IF p->>'visitId' IS NOT NULL THEN
   v:=visits->(p->>'visitId');
   IF v IS NULL OR v->>'status'<>'accepted' OR v->>'acceptedKey' IS NULL OR v->>'guest'<>actor OR p->>'homeId' IS DISTINCT FROM v->>'homeId'
    OR p->>'interior' IS DISTINCT FROM 'shelter' OR p->>'region' IS DISTINCT FROM s->'furnishing'->'homes'->(v->>'homeId')->>'region'
    OR (p->'activity' IS NOT NULL AND p->'activity'->>'kind' NOT IN ('Sit','Read','Wash'))
   THEN RAISE EXCEPTION 'Home guest position lacks consent or current permission'; END IF;
  ELSIF p->>'interior'='shelter' AND p->>'homeId' IS NOT NULL THEN
   IF NOT simulator.home_resident(s,actor,p->>'homeId') OR p->>'region' IS DISTINCT FROM s->'furnishing'->'homes'->(p->>'homeId')->>'region' THEN RAISE EXCEPTION 'Home position lacks current residence permission'; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM simulator.domain_records r WHERE r.world_id=NEW.id AND r.domain='world.position' AND r.id=actor AND r.data=p) THEN RAISE EXCEPTION 'Home position snapshot mirror mismatch'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER home_visits_reconcile AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.home_visits_reconcile();
REVOKE ALL ON FUNCTION simulator.home_resident(jsonb,text,text),simulator.home_visit_core(jsonb),simulator.home_visit_hash(jsonb),simulator.home_visit_receipt(text,jsonb,text),simulator.home_visit_immutable(),simulator.home_visit_mirror(),simulator.home_visits_reconcile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.home_resident(jsonb,text,text),simulator.home_visit_core(jsonb),simulator.home_visit_hash(jsonb),simulator.home_visit_receipt(text,jsonb,text),simulator.home_visit_immutable(),simulator.home_visit_mirror(),simulator.home_visits_reconcile() TO simulator_server;
