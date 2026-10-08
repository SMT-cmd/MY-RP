-- Private mutual consent. Uses the immutable command verifier from the local
-- home-visit migration; no public table or SECURITY DEFINER function.
CREATE FUNCTION simulator.relationship_core(r jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,simulator AS $$
 SELECT r-ARRAY['status','version','acceptedKey','closedKey','closedAt','closeReason']
$$;
CREATE FUNCTION simulator.relationship_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
BEGIN
 IF OLD.domain<>'social.relationship' THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Relationship evidence cannot be deleted'; END IF;
 IF OLD.data->>'status'='ended' AND OLD.data IS DISTINCT FROM NEW.data THEN RAISE EXCEPTION 'Finished relationship is immutable'; END IF;
 IF OLD.data IS DISTINCT FROM NEW.data AND (
  simulator.relationship_core(OLD.data) IS DISTINCT FROM simulator.relationship_core(NEW.data)
  OR (NEW.data->>'version')::integer<>(OLD.data->>'version')::integer+1
  OR NOT ((OLD.data->>'status'='invited' AND NEW.data->>'status' IN ('active','ended')) OR (OLD.data->>'status'='active' AND NEW.data->>'status'='ended'))
  OR (OLD.data->>'acceptedKey' IS NOT NULL AND OLD.data->>'acceptedKey' IS DISTINCT FROM NEW.data->>'acceptedKey')
 ) THEN RAISE EXCEPTION 'Relationship terms and consent are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER relationship_immutable BEFORE UPDATE OR DELETE ON simulator.domain_records FOR EACH ROW EXECUTE FUNCTION simulator.relationship_immutable();
CREATE FUNCTION simulator.relationships_reconcile() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE s jsonb:=NEW.state; rels jsonb:=coalesce(s->'relationships'->'records','{}'::jsonb); rid text; r jsonb; terms jsonb; source jsonb; consent jsonb; ending jsonb; blocked boolean; peer text;
BEGIN
 FOR rid,r IN SELECT key,value FROM jsonb_each(rels) LOOP
  terms:=simulator.relationship_core(r);
  IF r->>'id' IS DISTINCT FROM rid OR s->'citizens'->(r->>'sender') IS NULL OR s->'citizens'->(r->>'recipient') IS NULL OR r->>'sender'=r->>'recipient'
   OR r->>'kind' NOT IN ('friend','partner') OR r->>'termsVersion' IS DISTINCT FROM 'relationships-v1'
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['id','sender','recipient','kind','termsVersion','sourceKey','status']) f WHERE jsonb_typeof(r->f) IS DISTINCT FROM 'string')
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['createdAt','expiresAt','version']) f WHERE jsonb_typeof(r->f) IS DISTINCT FROM 'number')
   OR (r->>'createdAt')::bigint<0 OR (r->>'expiresAt')::bigint>9007199254740991 OR (r->>'expiresAt')::bigint-(r->>'createdAt')::bigint<>604800000
   OR EXISTS(SELECT 1 FROM jsonb_each(r) WHERE jsonb_typeof(value) NOT IN ('string','number'))
  THEN RAISE EXCEPTION 'Invalid relationship terms'; END IF;
  source:=simulator.home_visit_receipt(NEW.id,s,r->>'sourceKey');
  IF source IS NULL OR source->>'type' IS DISTINCT FROM 'InviteRelationship' OR source->>'actorId' IS DISTINCT FROM r->>'sender' OR source->>'at' IS DISTINCT FROM r->>'createdAt'
   OR source->'detail'->'relationship' IS DISTINCT FROM terms||'{"status":"invited","version":1}'::jsonb
  THEN RAISE EXCEPTION 'Relationship lacks invitation evidence'; END IF;
  IF r->>'acceptedKey' IS NOT NULL THEN
   consent:=simulator.home_visit_receipt(NEW.id,s,r->>'acceptedKey');
   IF consent IS NULL OR consent->>'type' IS DISTINCT FROM 'AcceptRelationship' OR consent->>'actorId' IS DISTINCT FROM r->>'recipient'
    OR (consent->>'at')::bigint<(r->>'createdAt')::bigint OR (consent->>'at')::bigint>=(r->>'expiresAt')::bigint
    OR consent->'detail'->'relationship' IS DISTINCT FROM terms||jsonb_build_object('status','active','version',2,'acceptedKey',r->>'acceptedKey')
   THEN RAISE EXCEPTION 'Relationship lacks mutual consent evidence'; END IF;
  END IF;
  blocked:=coalesce(s->'life'->'blocks'->(r->>'sender') ? (r->>'recipient'),false) OR coalesce(s->'life'->'blocks'->(r->>'recipient') ? (r->>'sender'),false);
  IF r->>'status' IN ('invited','active') THEN
   IF blocked OR r ?| ARRAY['closedKey','closedAt','closeReason']
    OR (r->>'status'='invited' AND ((r->>'version')::integer<>1 OR r ? 'acceptedKey' OR s->'citizens'->(r->>'recipient')->'life'->'privacy'->>'relationships' IS DISTINCT FROM 'true'))
    OR (r->>'status'='active' AND ((r->>'version')::integer<>2 OR r->>'acceptedKey' IS NULL))
   THEN RAISE EXCEPTION 'Relationship lacks current permission'; END IF;
  ELSE
   ending:=simulator.home_visit_receipt(NEW.id,s,r->>'closedKey');
   IF r->>'status' IS DISTINCT FROM 'ended' OR (r->>'version')::integer<>(CASE WHEN r ? 'acceptedKey' THEN 3 ELSE 2 END)
    OR jsonb_typeof(r->'closedAt') IS DISTINCT FROM 'number' OR (r->>'closedAt')::bigint<(r->>'createdAt')::bigint
    OR ending IS NULL OR ending->>'at' IS DISTINCT FROM r->>'closedAt'
    OR NOT (ending->'detail'->'relationship' IS NOT DISTINCT FROM r OR coalesce(ending->'detail'->'relationshipClosureProofs' ? simulator.home_visit_hash(r),false))
    OR r->>'closeReason' IS NULL OR r->>'closeReason' NOT IN ('declined','withdrawn','left','blocked','expired','privacy')
    OR (r->>'closeReason'='left' AND (r->>'acceptedKey' IS NULL OR ending->>'type' IS DISTINCT FROM 'EndRelationship' OR ending->>'actorId' NOT IN (r->>'sender',r->>'recipient')))
    OR (r->>'closeReason'='declined' AND (r ? 'acceptedKey' OR ending->>'type' IS DISTINCT FROM 'DeclineRelationship' OR ending->>'actorId' IS DISTINCT FROM r->>'recipient'))
    OR (r->>'closeReason'='withdrawn' AND (r ? 'acceptedKey' OR ending->>'type' IS DISTINCT FROM 'WithdrawRelationship' OR ending->>'actorId' IS DISTINCT FROM r->>'sender'))
    OR (r->>'closeReason'='expired' AND (r ? 'acceptedKey' OR (r->>'closedAt')::bigint<(r->>'expiresAt')::bigint))
    OR (r->>'closeReason'='privacy' AND (r ? 'acceptedKey' OR ending->>'type' IS DISTINCT FROM 'SetPrivacy' OR ending->>'actorId' IS DISTINCT FROM r->>'recipient' OR ending->'detail'->'privacy'->>'relationships' IS DISTINCT FROM 'false'))
   THEN RAISE EXCEPTION 'Relationship lacks closure evidence'; END IF;
   IF r->>'closeReason'='blocked' THEN
    peer:=CASE WHEN ending->>'actorId'=r->>'sender' THEN r->>'recipient' ELSE r->>'sender' END;
    IF ending->>'type' IS DISTINCT FROM 'BlockCitizen' OR ending->>'actorId' NOT IN (r->>'sender',r->>'recipient') OR ending->'detail'->>'citizenId' IS DISTINCT FROM s->'citizens'->peer->>'id' THEN RAISE EXCEPTION 'Relationship lacks block evidence'; END IF;
   END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM simulator.domain_records WHERE world_id=NEW.id AND domain='social.relationship' AND id=rid AND data=r) THEN RAISE EXCEPTION 'Relationship mirror mismatch'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM simulator.domain_records WHERE world_id=NEW.id AND domain='social.relationship' AND rels->id IS DISTINCT FROM data) THEN RAISE EXCEPTION 'Orphan relationship mirror'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(rels) WHERE value->>'status' IN ('invited','active') GROUP BY least(value->>'sender',value->>'recipient'),greatest(value->>'sender',value->>'recipient'),value->>'kind' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate relationship'; END IF;
 IF EXISTS(SELECT 1 FROM (SELECT value->>'sender' person,value->>'status' status FROM jsonb_each(rels) UNION ALL SELECT value->>'recipient',value->>'status' FROM jsonb_each(rels)) counts WHERE status IN ('invited','active') GROUP BY person,status HAVING count(*)>CASE WHEN status='invited' THEN 20 ELSE 100 END) THEN RAISE EXCEPTION 'Relationship capacity mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(rels) a WHERE (SELECT count(*) FROM jsonb_each(rels) b WHERE b.value->>'sender'=a.value->>'sender' AND (b.value->>'createdAt')::bigint<=(a.value->>'createdAt')::bigint AND (b.value->>'createdAt')::bigint>(a.value->>'createdAt')::bigint-86400000)>20) THEN RAISE EXCEPTION 'Relationship request rate mismatch'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER relationships_reconcile AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.relationships_reconcile();
CREATE FUNCTION simulator.relationship_mirror_reconcile() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE rec record;
BEGIN
 IF TG_OP='DELETE' THEN rec:=OLD; ELSE rec:=NEW; END IF;
 IF rec.domain='social.relationship' AND NOT EXISTS(SELECT 1 FROM simulator.worlds WHERE id=rec.world_id AND state->'relationships'->'records'->rec.id=rec.data) THEN RAISE EXCEPTION 'Relationship mirror mismatch'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER relationship_mirror_reconcile AFTER INSERT OR UPDATE OR DELETE ON simulator.domain_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.relationship_mirror_reconcile();
REVOKE ALL ON FUNCTION simulator.relationship_core(jsonb),simulator.relationship_immutable(),simulator.relationships_reconcile(),simulator.relationship_mirror_reconcile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.relationship_core(jsonb),simulator.relationship_immutable(),simulator.relationships_reconcile(),simulator.relationship_mirror_reconcile() TO simulator_server;
