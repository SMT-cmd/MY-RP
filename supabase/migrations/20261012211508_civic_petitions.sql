-- Private receipt-backed signatures. A notice/review grants no policy or spending power.
CREATE FUNCTION simulator.civic_petition_replay(wid text,s jsonb,pid text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE c record; r jsonb; d jsonb; p jsonb; member jsonb; change jsonb; source text; actor text; at_time bigint; last_time bigint:=0; n bigint:=0; supported boolean; signed_count bigint:=0; treasury bigint; cost bigint; outcome text; notice jsonb; review jsonb; v bigint:=0;
BEGIN
 FOR c IN SELECT * FROM simulator.commands WHERE world_id=wid AND receipt->'detail'->>'petitionId'=pid AND receipt->>'type' IN ('CreateCivicPetition','SupportCivicPetition','WithdrawCivicSupport','WithdrawCivicPetition','ReviewCivicPetition') ORDER BY revision LOOP
  r:=c.receipt;d:=r->'detail';actor:=c.actor_id;source:=actor||':'||c.id;at_time:=(r->>'at')::bigint;v:=v+1;
  IF r IS DISTINCT FROM simulator.home_visit_receipt(wid,s,source) OR at_time<last_time OR at_time<0 OR at_time>9007199254740991
   OR d->>'termsVersion' IS DISTINCT FROM 'petitions-1' OR (d->>'petitionVersion')::bigint IS DISTINCT FROM v
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'outbox') e WHERE e=jsonb_build_object('id',source,'type',r->>'type','actorId',actor,'at',at_time,'payload',d))
   OR NOT EXISTS(SELECT 1 FROM simulator.outbox WHERE world_id=wid AND id=source AND type=r->>'type' AND actor_id=actor AND payload=d)
   OR EXISTS(SELECT 1 FROM simulator.journal_lines WHERE world_id=wid AND (journal_id=source OR starts_with(journal_id,source||':')))
  THEN RAISE EXCEPTION 'Invalid civic command evidence'; END IF;
  last_time:=at_time;
  IF v=1 THEN
   IF r->>'type' IS DISTINCT FROM 'CreateCivicPetition' OR d->'consent' IS DISTINCT FROM 'true'::jsonb
    OR pid IS DISTINCT FROM 'petition-'||substr(encode(sha256(convert_to(source,'UTF8')),'hex'),1,24)
    OR d->>'topic' NOT IN ('roads','water','housing','school','clinic')
    OR s->'citizens'->actor->>'state' IS DISTINCT FROM d->>'region' OR s->'citizens'->actor IS NULL OR at_time<(s->'citizens'->actor->>'enrolledAt')::bigint
    OR EXISTS(SELECT 1 FROM simulator.commands prior WHERE prior.world_id=wid AND prior.actor_id=actor AND prior.revision<c.revision AND prior.receipt->>'type'='CreateCivicPetition' AND at_time-(prior.receipt->>'at')::bigint<86400000)
    OR EXISTS(SELECT 1 FROM simulator.commands prior WHERE prior.world_id=wid AND prior.revision<c.revision AND prior.receipt->>'type'='CreateCivicPetition' AND prior.receipt->'detail'->>'region'=d->>'region' AND prior.receipt->'detail'->>'topic'=d->>'topic' AND at_time<(prior.receipt->>'at')::bigint+604800000
     AND NOT EXISTS(SELECT 1 FROM simulator.commands closed WHERE closed.world_id=wid AND closed.revision<c.revision AND closed.receipt->'detail'->>'petitionId'=prior.receipt->'detail'->>'petitionId' AND closed.receipt->>'type' IN ('WithdrawCivicPetition','ReviewCivicPetition')))
   THEN RAISE EXCEPTION 'Invalid civic proposal terms'; END IF;
   p:=jsonb_build_object('id',pid,'author',actor,'region',d->>'region','topic',d->>'topic','createdAt',at_time,'deadline',at_time+604800000,'threshold',10,'termsVersion','petitions-1','sourceKey',source,'version',1,'members','{}'::jsonb,'withdrawn',NULL,'notice',NULL,'review',NULL);
  ELSE
   IF s->'citizens'->actor->>'state' IS DISTINCT FROM p->>'region' OR s->'citizens'->actor IS NULL OR at_time<(s->'citizens'->actor->>'enrolledAt')::bigint OR d->>'region' IS DISTINCT FROM p->>'region' OR d->>'topic' IS DISTINCT FROM p->>'topic' THEN RAISE EXCEPTION 'Invalid civic jurisdiction'; END IF;
  END IF;
  IF r->>'type' IN ('CreateCivicPetition','SupportCivicPetition','WithdrawCivicSupport') THEN
   supported:=r->>'type'<>'WithdrawCivicSupport';member:=coalesce(p->'members'->actor,jsonb_build_object('actor',actor,'changes','[]'::jsonb));n:=jsonb_array_length(member->'changes');
   IF n>=4 OR supported=coalesce((member->'changes'->-1->>'supported')::boolean,false)
    OR supported AND (d->'consent' IS DISTINCT FROM 'true'::jsonb OR p->'withdrawn'<>'null'::jsonb OR p->'review'<>'null'::jsonb OR at_time>=(p->>'deadline')::bigint)
   THEN RAISE EXCEPTION 'Invalid civic support consent or transition'; END IF;
   change:=jsonb_build_object('key',source,'at',at_time,'supported',supported);member:=jsonb_set(member,'{changes}',member->'changes'||jsonb_build_array(change));p:=jsonb_set(p,ARRAY['members',actor],member);signed_count:=signed_count+CASE WHEN supported THEN 1 ELSE -1 END;
   IF p->'notice'='null'::jsonb AND signed_count>=10 THEN p:=jsonb_set(p,'{notice}',jsonb_build_object('id','notice-'||pid,'at',at_time,'key',source)); END IF;
  ELSIF r->>'type'='WithdrawCivicPetition' THEN
   IF actor IS DISTINCT FROM p->>'author' OR p->'withdrawn'<>'null'::jsonb OR p->'review'<>'null'::jsonb THEN RAISE EXCEPTION 'Invalid civic author withdrawal'; END IF;
   p:=jsonb_set(p,'{withdrawn}',jsonb_build_object('at',at_time,'key',source));
  ELSIF r->>'type'='ReviewCivicPetition' THEN
   IF p->'notice'='null'::jsonb OR p->'review'<>'null'::jsonb OR at_time<(p->'notice'->>'at')::bigint+86400000 THEN RAISE EXCEPTION 'Invalid civic consideration timing'; END IF;
   SELECT coalesce(sum(l.amount),0) INTO treasury FROM simulator.journal_lines l JOIN simulator.commands money ON money.world_id=l.world_id AND (l.journal_id=money.actor_id||':'||money.id OR starts_with(l.journal_id,money.actor_id||':'||money.id||':')) WHERE l.world_id=wid AND l.id='treasury:state:'||(p->>'region') AND money.revision<c.revision;
   cost:=CASE p->>'topic' WHEN 'roads' THEN 100000 WHEN 'water' THEN 150000 WHEN 'housing' THEN 100000 WHEN 'school' THEN 75000 ELSE 125000 END;
   outcome:=CASE WHEN p->'withdrawn'<>'null'::jsonb THEN 'withdrawn' WHEN signed_count<10 THEN 'insufficient-support' WHEN treasury<cost THEN 'funding-proposal-required' ELSE 'formal-budget-review-required' END;
   review:=jsonb_build_object('at',at_time,'support',signed_count,'treasury',treasury,'estimatedCost',cost,'outcome',outcome);
   IF d->'consideration' IS DISTINCT FROM review THEN RAISE EXCEPTION 'Invalid civic consideration snapshot'; END IF;
   p:=jsonb_set(p,'{review}',review||jsonb_build_object('key',source));
  ELSE RAISE EXCEPTION 'Invalid civic action'; END IF;
  IF (d->>'supportCount')::bigint IS DISTINCT FROM signed_count THEN RAISE EXCEPTION 'Invalid civic support count'; END IF;
  notice:=p->'notice';
  IF notice->>'key'=source THEN
   IF d->'noticeCreated' IS DISTINCT FROM notice-'key' THEN RAISE EXCEPTION 'Invalid civic threshold notice'; END IF;
  ELSIF d ? 'noticeCreated' THEN RAISE EXCEPTION 'Duplicate civic threshold notice'; END IF;
  IF r->>'type'<>'ReviewCivicPetition' AND d ? 'consideration' THEN RAISE EXCEPTION 'Invalid civic review evidence'; END IF;
  p:=jsonb_set(p,'{version}',to_jsonb(v));
 END LOOP;
 RETURN p;
END $$;
CREATE FUNCTION simulator.civic_petitions_reconcile() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE petitions jsonb:=coalesce(NEW.state->'civic'->'petitions','{}'::jsonb); pid text; p jsonb;
BEGIN
 FOR pid,p IN SELECT key,value FROM jsonb_each(petitions) LOOP
  IF p IS DISTINCT FROM simulator.civic_petition_replay(NEW.id,NEW.state,pid) OR NOT EXISTS(SELECT 1 FROM simulator.domain_records WHERE world_id=NEW.id AND domain='civic.petition' AND id=pid AND data=p) THEN RAISE EXCEPTION 'Civic petition history or mirror mismatch'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM simulator.domain_records WHERE world_id=NEW.id AND domain='civic.petition' AND petitions->id IS DISTINCT FROM data)
  OR EXISTS(SELECT 1 FROM simulator.commands WHERE world_id=NEW.id AND receipt->>'type' IN ('CreateCivicPetition','SupportCivicPetition','WithdrawCivicSupport','WithdrawCivicPetition','ReviewCivicPetition') AND petitions->(receipt->'detail'->>'petitionId') IS NULL)
 THEN RAISE EXCEPTION 'Orphan civic petition evidence'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER civic_petitions_reconcile AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.civic_petitions_reconcile();
CREATE FUNCTION simulator.civic_petition_mirror() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
DECLARE r record;
BEGIN
 IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
 IF r.domain='civic.petition' AND NOT EXISTS(SELECT 1 FROM simulator.worlds WHERE id=r.world_id AND state->'civic'->'petitions'->r.id=r.data) THEN RAISE EXCEPTION 'Civic petition mirror mismatch'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER civic_petition_mirror AFTER INSERT OR UPDATE OR DELETE ON simulator.domain_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.civic_petition_mirror();
CREATE FUNCTION simulator.civic_petition_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,simulator AS $$
BEGIN
 IF OLD.domain<>'civic.petition' THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Civic petition evidence cannot be deleted'; END IF;
 IF OLD.data IS DISTINCT FROM NEW.data AND (OLD.data-ARRAY['members','version','notice','review','withdrawn'] IS DISTINCT FROM NEW.data-ARRAY['members','version','notice','review','withdrawn']
  OR (NEW.data->>'version')::bigint<>(OLD.data->>'version')::bigint+1
  OR OLD.data->'notice'<>'null'::jsonb AND OLD.data->'notice' IS DISTINCT FROM NEW.data->'notice'
  OR OLD.data->'review'<>'null'::jsonb AND OLD.data->'review' IS DISTINCT FROM NEW.data->'review'
  OR OLD.data->'withdrawn'<>'null'::jsonb AND OLD.data->'withdrawn' IS DISTINCT FROM NEW.data->'withdrawn') THEN RAISE EXCEPTION 'Civic petition terms and terminal evidence are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER civic_petition_immutable BEFORE UPDATE OR DELETE ON simulator.domain_records FOR EACH ROW EXECUTE FUNCTION simulator.civic_petition_immutable();
REVOKE ALL ON FUNCTION simulator.civic_petition_replay(text,jsonb,text),simulator.civic_petitions_reconcile(),simulator.civic_petition_mirror(),simulator.civic_petition_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.civic_petition_replay(text,jsonb,text),simulator.civic_petitions_reconcile(),simulator.civic_petition_mirror(),simulator.civic_petition_immutable() TO simulator_server;
