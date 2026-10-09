-- Curated cosmetic profiles remain private and are backed by immutable command receipts.
CREATE FUNCTION simulator.citizen_appearance_reconcile() RETURNS trigger
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
   OR COALESCE(profile->>'frame','') NOT IN ('slender','balanced','broad')
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
CREATE CONSTRAINT TRIGGER citizen_appearance_world_reconciles AFTER INSERT OR UPDATE ON simulator.worlds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simulator.citizen_appearance_reconcile();
REVOKE ALL ON FUNCTION simulator.citizen_appearance_reconcile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION simulator.citizen_appearance_reconcile() TO simulator_server;
