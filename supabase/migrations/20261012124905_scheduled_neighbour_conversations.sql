-- Clock-derived NPC schedules are not persisted. Only committed conversations
-- have private mirrors, immutable command evidence and a reconciliation guard.
CREATE FUNCTION simulator.neighbour_conversation_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
BEGIN
 IF OLD.domain<>'npc.conversation' THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Neighbour conversation evidence cannot be deleted'; END IF;
 IF OLD.data IS DISTINCT FROM NEW.data AND (
  OLD.data-ARRAY['topic','at','count','key'] IS DISTINCT FROM NEW.data-ARRAY['topic','at','count','key']
  OR (NEW.data->>'count')::bigint<>(OLD.data->>'count')::bigint+1
  OR (NEW.data->>'at')::bigint-(OLD.data->>'at')::bigint<30000
 ) THEN RAISE EXCEPTION 'Invalid neighbour conversation transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER neighbour_conversation_immutable BEFORE UPDATE OR DELETE ON simulator.domain_records FOR EACH ROW EXECUTE FUNCTION simulator.neighbour_conversation_immutable();
CREATE FUNCTION simulator.neighbour_conversations_reconcile() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE records jsonb:=coalesce(NEW.state->'neighbours'->'conversations','{}'::jsonb); rid text; r jsonb; proof jsonb; total bigint;
BEGIN
 FOR rid,r IN SELECT key,value FROM jsonb_each(records) LOOP
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['id','actor','npcId','region','topic','key','version']) f WHERE jsonb_typeof(r->f) IS DISTINCT FROM 'string')
   OR (SELECT count(*) FROM jsonb_object_keys(r))<>9
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['at','count']) f WHERE jsonb_typeof(r->f) IS DISTINCT FROM 'number')
   OR (r->>'count')::bigint<1 OR (r->>'at')::bigint<0 OR (r->>'at')::bigint>9007199254740991
   OR r->>'id' IS DISTINCT FROM rid OR rid IS DISTINCT FROM (r->>'actor')||':'||(r->>'npcId')
   OR r->>'version' IS DISTINCT FROM 'neighbours-1' OR NEW.state->'citizens'->(r->>'actor') IS NULL
   OR r->>'topic' NOT IN ('hello','services','work','travel')
   OR r->>'region' NOT IN ('Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara')
   OR r->>'npcId' !~ ('^npc-'||replace(lower(r->>'region'),' ','-')||'-[0-5]$')
  THEN RAISE EXCEPTION 'Invalid neighbour conversation terms'; END IF;
  proof:=simulator.home_visit_receipt(NEW.id,NEW.state,r->>'key');
  IF proof IS NULL OR proof->>'type' IS DISTINCT FROM 'TalkToNeighbour' OR proof->>'actorId' IS DISTINCT FROM r->>'actor'
   OR proof->>'at' IS DISTINCT FROM r->>'at' OR proof->'detail'->>'npcId' IS DISTINCT FROM r->>'npcId'
   OR proof->'detail'->>'region' IS DISTINCT FROM r->>'region' OR proof->'detail'->>'topic' IS DISTINCT FROM r->>'topic'
   OR proof->'detail'->>'conversationCount' IS DISTINCT FROM r->>'count'
   OR NOT EXISTS(SELECT 1 FROM simulator.domain_records WHERE world_id=NEW.id AND domain='npc.conversation' AND id=rid AND data=r)
  THEN RAISE EXCEPTION 'Neighbour conversation lacks matching evidence'; END IF;
  SELECT count(*) INTO total FROM simulator.commands WHERE world_id=NEW.id AND actor_id=r->>'actor' AND receipt->>'type'='TalkToNeighbour' AND receipt->'detail'->>'npcId'=r->>'npcId';
  IF total<>(r->>'count')::bigint OR EXISTS(SELECT 1 FROM simulator.commands WHERE world_id=NEW.id AND actor_id=r->>'actor' AND receipt->>'type'='TalkToNeighbour' AND receipt->'detail'->>'npcId'=r->>'npcId' AND (receipt->>'at')::bigint>(r->>'at')::bigint) THEN RAISE EXCEPTION 'Neighbour conversation receipt count mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM (
   SELECT receipt, row_number() OVER(ORDER BY (receipt->>'at')::bigint,id) sequence, lag((receipt->>'at')::bigint) OVER(ORDER BY (receipt->>'at')::bigint,id) previous_at
   FROM simulator.commands WHERE world_id=NEW.id AND actor_id=r->>'actor' AND receipt->>'type'='TalkToNeighbour' AND receipt->'detail'->>'npcId'=r->>'npcId'
  ) history WHERE (receipt->'detail'->>'conversationCount')::bigint IS DISTINCT FROM sequence OR (receipt->>'at')::bigint-previous_at<30000) THEN RAISE EXCEPTION 'Invalid neighbour conversation sequence'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM simulator.domain_records WHERE world_id=NEW.id AND domain='npc.conversation' AND records->id IS DISTINCT FROM data)
  OR EXISTS(SELECT 1 FROM simulator.commands WHERE world_id=NEW.id AND receipt->>'type'='TalkToNeighbour' AND records->(actor_id||':'||(receipt->'detail'->>'npcId')) IS NULL)
 THEN RAISE EXCEPTION 'Orphan neighbour conversation evidence'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER neighbour_conversations_reconcile AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.neighbour_conversations_reconcile();
CREATE FUNCTION simulator.neighbour_conversation_mirror_reconcile() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE r record;
BEGIN
 IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
 IF r.domain='npc.conversation' AND NOT EXISTS(SELECT 1 FROM simulator.worlds WHERE id=r.world_id AND state->'neighbours'->'conversations'->r.id=r.data) THEN RAISE EXCEPTION 'Neighbour conversation mirror mismatch'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER neighbour_conversation_mirror_reconcile AFTER INSERT OR UPDATE OR DELETE ON simulator.domain_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.neighbour_conversation_mirror_reconcile();
REVOKE ALL ON FUNCTION simulator.neighbour_conversation_immutable(),simulator.neighbour_conversations_reconcile(),simulator.neighbour_conversation_mirror_reconcile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.neighbour_conversation_immutable(),simulator.neighbour_conversations_reconcile(),simulator.neighbour_conversation_mirror_reconcile() TO simulator_server;
CREATE FUNCTION simulator.neighbour_conversation_command_reconcile() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE r jsonb; total bigint;
BEGIN
 IF NEW.receipt->>'type'<>'TalkToNeighbour' THEN RETURN NULL; END IF;
 SELECT state->'neighbours'->'conversations'->(NEW.actor_id||':'||(NEW.receipt->'detail'->>'npcId')) INTO r FROM simulator.worlds WHERE id=NEW.world_id;
 SELECT count(*) INTO total FROM simulator.commands WHERE world_id=NEW.world_id AND actor_id=NEW.actor_id AND receipt->>'type'='TalkToNeighbour' AND receipt->'detail'->>'npcId'=NEW.receipt->'detail'->>'npcId';
 IF r IS NULL OR (r->>'count')::bigint IS DISTINCT FROM total THEN RAISE EXCEPTION 'Orphan neighbour conversation command'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER neighbour_conversation_command_reconcile AFTER INSERT ON simulator.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.neighbour_conversation_command_reconcile();
REVOKE ALL ON FUNCTION simulator.neighbour_conversation_command_reconcile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.neighbour_conversation_command_reconcile() TO simulator_server;
