-- Operational read models remain private. Commands commit these with the world,
-- journals, receipts and outbox in one transaction.
CREATE TABLE simulator.domain_records (
  world_id text NOT NULL REFERENCES simulator.worlds(id),
  domain text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data)='object'),
  version bigint NOT NULL CHECK (version>0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(world_id,domain,id)
);
ALTER TABLE simulator.domain_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY world_scope ON simulator.domain_records TO simulator_server
  USING(world_id=current_setting('simulator.world_id',true)) WITH CHECK(world_id=current_setting('simulator.world_id',true));
GRANT SELECT,INSERT,UPDATE ON simulator.domain_records TO simulator_server;
