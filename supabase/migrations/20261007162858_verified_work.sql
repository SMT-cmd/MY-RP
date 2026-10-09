CREATE TABLE simulator.work_shifts (
  world_id text NOT NULL,
  id text NOT NULL,
  actor_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','completed','cancelled')),
  data jsonb NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  PRIMARY KEY(world_id,id),
  FOREIGN KEY(world_id,actor_id) REFERENCES simulator.citizens(world_id,actor_id),
  CHECK (jsonb_typeof(data)='object' AND data ?& ARRAY['id','actorId','status','version']),
  CHECK (data->>'id'=id AND data->>'actorId'=actor_id AND data->>'status'=status AND (data->>'version')::integer=version)
);
CREATE UNIQUE INDEX one_active_shift ON simulator.work_shifts(world_id,actor_id) WHERE status='active';
ALTER TABLE simulator.work_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY world_scope ON simulator.work_shifts TO simulator_server
  USING(world_id=current_setting('simulator.world_id',true)) WITH CHECK(world_id=current_setting('simulator.world_id',true));
GRANT SELECT,INSERT,UPDATE ON simulator.work_shifts TO simulator_server;
