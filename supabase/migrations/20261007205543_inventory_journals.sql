CREATE TABLE simulator.stock_accounts (
 world_id text NOT NULL REFERENCES simulator.worlds(id),goods text NOT NULL,id text NOT NULL,
 quantity bigint NOT NULL CHECK(abs(quantity::numeric)<=9007199254740991),
 PRIMARY KEY(world_id,goods,id),CHECK(id LIKE 'system:%' OR quantity>=0)
);
CREATE TABLE simulator.stock_journals (
 world_id text NOT NULL REFERENCES simulator.worlds(id),id text NOT NULL,goods text NOT NULL,
 occurred_at timestamptz NOT NULL,reason text NOT NULL,entries jsonb NOT NULL CHECK(jsonb_typeof(entries)='array'),
 PRIMARY KEY(world_id,id)
);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['stock_accounts','stock_journals'] LOOP
  EXECUTE format('ALTER TABLE simulator.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY world_scope ON simulator.%I TO simulator_server USING(world_id=current_setting(''simulator.world_id'',true)) WITH CHECK(world_id=current_setting(''simulator.world_id'',true))',tab);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON simulator.stock_accounts TO simulator_server;
GRANT SELECT,INSERT ON simulator.stock_journals TO simulator_server;
CREATE TRIGGER stock_immutable BEFORE UPDATE OR DELETE ON simulator.stock_journals FOR EACH ROW EXECUTE FUNCTION simulator.immutable_record();
CREATE FUNCTION simulator.assert_stock_account(w text,g text,a text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actual bigint;total numeric;
BEGIN
 SELECT quantity INTO actual FROM simulator.stock_accounts WHERE world_id=w AND goods=g AND id=a;
 SELECT coalesce(sum((e.value->>'quantity')::numeric),0) INTO total FROM simulator.stock_journals j CROSS JOIN LATERAL jsonb_array_elements(j.entries) e WHERE j.world_id=w AND j.goods=g AND e.value->>'account'=a;
 IF actual IS NULL OR actual<>total THEN RAISE EXCEPTION 'Stock account does not match its immutable journal' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION simulator.check_stock_account() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN PERFORM simulator.assert_stock_account(NEW.world_id,NEW.goods,NEW.id);RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER stock_account_reconciled AFTER INSERT OR UPDATE ON simulator.stock_accounts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_stock_account();
CREATE FUNCTION simulator.check_stock_journal() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE total numeric;entry jsonb;units bigint;
BEGIN
 IF jsonb_array_length(NEW.entries)<2 THEN RAISE EXCEPTION 'Stock journal requires two lines';END IF;
 SELECT sum((value->>'quantity')::numeric) INTO total FROM jsonb_array_elements(NEW.entries);
 IF total IS NULL OR total<>0 THEN RAISE EXCEPTION 'Stock journal must balance';END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(NEW.entries) LOOP
  IF jsonb_typeof(entry->'account') IS DISTINCT FROM 'string' OR jsonb_typeof(entry->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid stock entry';END IF;
  units=(entry->>'quantity')::bigint;
  IF units=0 OR abs(units::numeric)>9007199254740991 THEN RAISE EXCEPTION 'Invalid stock amount';END IF;
  PERFORM simulator.assert_stock_account(NEW.world_id,NEW.goods,entry->>'account');
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER stock_journal_balanced AFTER INSERT ON simulator.stock_journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_stock_journal();
CREATE FUNCTION simulator.check_stock_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s jsonb;balances jsonb;b record;l record;o record;expected bigint;
BEGIN
 SELECT state INTO s FROM simulator.worlds WHERE id=NEW.id;balances=coalesce(s->'commerce'->'stock'->'balances','{}'::jsonb);
 IF EXISTS(SELECT 1 FROM simulator.stock_accounts a WHERE a.world_id=NEW.id AND coalesce((balances->>(a.goods||':'||a.id))::bigint,0)<>a.quantity)
 OR EXISTS(SELECT 1 FROM jsonb_each_text(balances) balance_entry WHERE balance_entry.value::bigint<>coalesce((SELECT a.quantity FROM simulator.stock_accounts a WHERE a.world_id=NEW.id AND a.goods||':'||a.id=balance_entry.key),0)) THEN RAISE EXCEPTION 'Stock snapshot does not match quantities';END IF;
 FOR b IN SELECT * FROM jsonb_each(coalesce(s->'commerce'->'batches','{}'::jsonb)) LOOP
  IF jsonb_typeof(b.value->'quantity') IS DISTINCT FROM 'number' OR jsonb_typeof(b.value->'goods') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid batch snapshot';END IF;
  IF (b.value->>'quantity')::bigint<>coalesce((balances->>((b.value->>'goods')||':batch:'||b.key))::bigint,0) THEN RAISE EXCEPTION 'Batch stock does not reconcile';END IF;
 END LOOP;
 FOR l IN SELECT * FROM jsonb_each(coalesce(s->'commerce'->'listings','{}'::jsonb)) LOOP
  IF jsonb_typeof(l.value->'remaining') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid listing snapshot';END IF;
  IF (l.value->>'remaining')::bigint<>coalesce((balances->>((s->'commerce'->'batches'->(l.value->>'batch')->>'goods')||':listing:'||l.key))::bigint,0) THEN RAISE EXCEPTION 'Listing stock does not reconcile';END IF;
 END LOOP;
 FOR o IN SELECT * FROM jsonb_each(coalesce(s->'commerce'->'orders','{}'::jsonb)) LOOP
  IF jsonb_typeof(o.value->'quantity') IS DISTINCT FROM 'number' OR jsonb_typeof(o.value->'status') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid order snapshot';END IF;
  expected=CASE WHEN o.value->>'status' IN ('accepted','cancelled','refunded') THEN 0 ELSE (o.value->>'quantity')::bigint END;
  IF expected<>coalesce((balances->>((o.value->>'goods')||':order:'||o.key))::bigint,0) THEN RAISE EXCEPTION 'Order custody does not reconcile';END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER stock_snapshot_reconciled AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_stock_snapshot();
REVOKE EXECUTE ON FUNCTION simulator.assert_stock_account(text,text,text),simulator.check_stock_account(),simulator.check_stock_journal(),simulator.check_stock_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.assert_stock_account(text,text,text),simulator.check_stock_account(),simulator.check_stock_journal(),simulator.check_stock_snapshot() TO simulator_server;
