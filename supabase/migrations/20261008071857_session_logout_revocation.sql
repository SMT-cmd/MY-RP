-- Only the trusted game server can revoke a verified session in its own world.
-- Public Data API roles still have no schema access.
GRANT INSERT ON simulator.revoked_sessions TO simulator_server;
