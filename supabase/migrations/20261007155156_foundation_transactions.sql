-- Private, server-only schema. No Data API role receives access.
DO $$ BEGIN CREATE ROLE simulator_server NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA simulator;
REVOKE ALL ON SCHEMA simulator FROM PUBLIC;
GRANT USAGE ON SCHEMA simulator TO simulator_server;

CREATE TABLE simulator.worlds (
  id text PRIMARY KEY,
  state jsonb NOT NULL CHECK (state->>'worldId' = id AND state->>'version' = '1'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE simulator.citizens (
  world_id text NOT NULL REFERENCES simulator.worlds(id),
  actor_id text NOT NULL,
  citizen_id text NOT NULL,
  data jsonb NOT NULL CHECK (data->>'actorId' = actor_id AND data->>'id' = citizen_id),
  version integer NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(world_id,actor_id), UNIQUE(world_id,citizen_id)
);
CREATE TABLE simulator.accounts (
  world_id text NOT NULL REFERENCES simulator.worlds(id),
  id text NOT NULL,
  balance bigint NOT NULL CHECK (abs(balance::numeric) <= 9007199254740991),
  PRIMARY KEY(world_id,id),
  CHECK (id LIKE 'system:%' OR balance >= 0)
);
CREATE TABLE simulator.journals (
  world_id text NOT NULL REFERENCES simulator.worlds(id),
  id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 300),
  PRIMARY KEY(world_id,id)
);
CREATE TABLE simulator.journal_lines (
  world_id text NOT NULL,
  journal_id text NOT NULL,
  line integer NOT NULL CHECK (line >= 0),
  id text NOT NULL,
  amount bigint NOT NULL CHECK (amount <> 0 AND abs(amount::numeric) <= 9007199254740991),
  PRIMARY KEY(world_id,journal_id,line),
  FOREIGN KEY(world_id,journal_id) REFERENCES simulator.journals(world_id,id),
  FOREIGN KEY(world_id,id) REFERENCES simulator.accounts(world_id,id)
);
CREATE INDEX journal_account ON simulator.journal_lines(world_id,id);
CREATE TABLE simulator.commands (
  world_id text NOT NULL REFERENCES simulator.worlds(id),
  actor_id text NOT NULL,
  id text NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  receipt jsonb NOT NULL CHECK (receipt->>'actorId' = actor_id AND receipt->>'commandId' = id),
  revision integer NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(world_id,actor_id,id)
);
CREATE TABLE simulator.outbox (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  world_id text NOT NULL REFERENCES simulator.worlds(id),
  id text NOT NULL,
  actor_id text NOT NULL,
  type text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  aggregate_version integer NOT NULL CHECK (aggregate_version > 0),
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_until timestamptz,
  delivered_at timestamptz,
  UNIQUE(world_id,id)
);
CREATE INDEX outbox_cursor ON simulator.outbox(world_id,sequence);
CREATE INDEX outbox_due ON simulator.outbox(world_id,sequence) WHERE delivered_at IS NULL;
CREATE TABLE simulator.revoked_sessions (
  world_id text NOT NULL REFERENCES simulator.worlds(id),
  session_id text NOT NULL,
  reason text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(world_id,session_id)
);

-- Both rows and their replacements remain in the transaction's world scope.
ALTER TABLE simulator.worlds ENABLE ROW LEVEL SECURITY;
CREATE POLICY world_scope ON simulator.worlds TO simulator_server
  USING (id = current_setting('simulator.world_id',true))
  WITH CHECK (id = current_setting('simulator.world_id',true));
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['citizens','accounts','journals','journal_lines','commands','outbox','revoked_sessions'] LOOP
    EXECUTE format('ALTER TABLE simulator.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('CREATE POLICY world_scope ON simulator.%I TO simulator_server USING (world_id = current_setting(''simulator.world_id'',true)) WITH CHECK (world_id = current_setting(''simulator.world_id'',true))',tab);
  END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON simulator.worlds,simulator.citizens,simulator.accounts,simulator.outbox TO simulator_server;
GRANT SELECT,INSERT ON simulator.journals,simulator.journal_lines,simulator.commands TO simulator_server;
GRANT SELECT ON simulator.revoked_sessions TO simulator_server;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA simulator TO simulator_server;

CREATE FUNCTION simulator.immutable_record() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Settled journal and command records are immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER journal_immutable BEFORE UPDATE OR DELETE ON simulator.journals FOR EACH ROW EXECUTE FUNCTION simulator.immutable_record();
CREATE TRIGGER line_immutable BEFORE UPDATE OR DELETE ON simulator.journal_lines FOR EACH ROW EXECUTE FUNCTION simulator.immutable_record();
CREATE TRIGGER command_immutable BEFORE UPDATE OR DELETE ON simulator.commands FOR EACH ROW EXECUTE FUNCTION simulator.immutable_record();

CREATE FUNCTION simulator.check_journal() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE total numeric; lines bigint;
BEGIN
  SELECT coalesce(sum(amount),0),count(*) INTO total,lines FROM simulator.journal_lines WHERE world_id=NEW.world_id AND journal_id=NEW.id;
  IF lines < 2 OR total <> 0 THEN RAISE EXCEPTION 'Journal must have at least two lines and balance' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER journal_balanced AFTER INSERT ON simulator.journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_journal();

CREATE FUNCTION simulator.check_account() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE total numeric; actual bigint;
BEGIN
  SELECT coalesce(sum(amount),0) INTO total FROM simulator.journal_lines WHERE world_id=NEW.world_id AND id=NEW.id;
  SELECT balance INTO actual FROM simulator.accounts WHERE world_id=NEW.world_id AND id=NEW.id;
  IF actual <> total THEN RAISE EXCEPTION 'Account balance does not match its immutable journal' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER account_reconciled AFTER INSERT OR UPDATE ON simulator.accounts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_account();
CREATE CONSTRAINT TRIGGER line_reconciled AFTER INSERT ON simulator.journal_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_account();

CREATE FUNCTION simulator.check_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE current_state jsonb;
BEGIN
  SELECT state INTO current_state FROM simulator.worlds WHERE id=NEW.id;
  IF EXISTS(SELECT 1 FROM simulator.accounts a WHERE a.world_id=NEW.id AND coalesce((current_state->'balances'->>a.id)::bigint,0) <> a.balance)
    OR EXISTS(SELECT 1 FROM jsonb_each_text(current_state->'balances') b WHERE b.value::bigint <> coalesce((SELECT a.balance FROM simulator.accounts a WHERE a.world_id=NEW.id AND a.id=b.key),0)) THEN
    RAISE EXCEPTION 'World snapshot does not match account balances' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER snapshot_reconciled AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.check_snapshot();
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA simulator FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA simulator TO simulator_server;
ALTER DEFAULT PRIVILEGES IN SCHEMA simulator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
