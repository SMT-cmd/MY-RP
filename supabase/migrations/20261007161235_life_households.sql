CREATE TABLE simulator.households (
  world_id text NOT NULL REFERENCES simulator.worlds(id),
  id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('npc','player')),
  data jsonb NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(world_id,id),
  CHECK(data->>'id'=id AND data->>'kind'=kind)
);
CREATE TABLE simulator.household_invitations (
  world_id text NOT NULL,
  id text NOT NULL,
  household_id text NOT NULL,
  recipient text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY(world_id,id),
  FOREIGN KEY(world_id,household_id) REFERENCES simulator.households(world_id,id),
  FOREIGN KEY(world_id,recipient) REFERENCES simulator.citizens(world_id,actor_id)
);
CREATE INDEX invitation_recipient ON simulator.household_invitations(world_id,recipient);
ALTER TABLE simulator.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator.household_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY world_scope ON simulator.households TO simulator_server
  USING(world_id=current_setting('simulator.world_id',true)) WITH CHECK(world_id=current_setting('simulator.world_id',true));
CREATE POLICY world_scope ON simulator.household_invitations TO simulator_server
  USING(world_id=current_setting('simulator.world_id',true)) WITH CHECK(world_id=current_setting('simulator.world_id',true));
GRANT SELECT,INSERT,UPDATE ON simulator.households,simulator.household_invitations TO simulator_server;
