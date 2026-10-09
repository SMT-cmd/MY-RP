# Shared furniture use

Main-build component, 8 October 2026. R017/R019/R033/R040/R052/R053/R056/R065–R067 remain partial. This coordinates presentation positions; it does not complete long-duration activities, household cohabitation, collision avoidance or production art.

## Authority and claims

InteractHomeFixture checks the authenticated occupant's home permission and wall-aware approach range before allocating a position. Three-seat sofas have three positions; chairs, desks, bookshelves, sinks, beds and wardrobes have one. Decorative inspection and the protected pantry do not reserve a timed position. Capacities and the ten-second presentation window are proposed D30 component parameters, distinct from the existing rest/food eligibility, reward and cooldown rules.

A caller may request an integer useSlot within the fixture's capacity; a busy or invalid position fails atomically. Otherwise the server retains the actor's current position or chooses the nearest free position using the confirmed tile and fixture rotation. The durable fixture instance, home, action, slot, server start time and actual interaction receipt bind each claim. Retrying the same command returns the original receipt without extending its time or issuing another reward. A rejected command commits no cleanup or partial reward.

An occupant has one activity. Confirmed movement, exit, revoked guest access, changed residence or an affected layout edit releases it. Server time makes a position available after ten seconds even if no command commits. A subsequent successful claim clears legacy and expired poses in that home before writing its own position. Historical legacy poses without slots remain restorable; these do not gain new command authority. Recovery validates evidence and rejects duplicate durable positions without evaluating the current wall clock.

## Private controls and scene

An authorised home view contains each fixture's capacity, free count, available slot numbers, own current slot and earliest other-claim expiry. Counts include occupants who have disabled public presence. They disclose availability needed to use an object without identifying those occupants. A hash of active fixture/slot/start tuples carries no account ID or receipt key. Live and fallback frames use this revision to refresh the private snapshot when a claim expires at an unchanged business cursor. Peer projection contains only kind, fixtureId, startedAt and optional slot; private receipt evidence remains excluded.

Accessible controls explain capacity and disable occupied furnishings. Three.js places sofa occupants a metre apart along the rotated sofa and grounds adult frames through the existing activity anchor. Canvas uses distinct rotated seat locations. Confirmed actor tiles remain the authority for approach/range; rendering a seat pose does not teleport or settle a command. Both renderers use server-relative presentation time, and refreshing an old snapshot for a graphics change cannot restart its pose window. Low/data-saver controls retain the same permissions and availability.

## Persistence and evidence

CLI-generated migration 20261008161823_shared_furniture_use.sql adds an invoker deferred constraint on the private world snapshot. It verifies placed instance/action/capacity, receipt-backed actor/time/home/slot and uniqueness. It depends on the earlier local home-visit receipt verifier and the immutable command mirror. It introduces no public table, scheduler, financial reserve or hosted service. The staff, visit and furniture-use migrations remain local; the hosted manifest is unchanged.

Domain tests cover three distinct seats, a fourth occupant's busy rejection, explicit position bounds, replay/renewal without rewards, movement/exit/time release, layout cleanup, scoped projection and forged recovery evidence. Embedded PostgreSQL tests force a failed claim commit, reopen/retry, deny changed proof and duplicate positions, and reclaim expiry atomically. Two actual HTTP/WebSocket-to-JSDOM clients verify a hidden resident's occupied sink and automatic expiry refresh with no new business cursor or visible peer. Geometry tests cover all sofa rotations and adult frames; a controlled execution of the actual Canvas renderer checks separate positions and expired-pose graphics refresh. These establish local geometry, transport, DOM and embedded SQL behavior; native GPU/art, devices, hosted PostgreSQL/driver and load acceptance remain open.

Long activities, task/reward progression, seat-specific approach paths, occupant traffic avoidance, broader relationship/cohabitation and full-game systems still need implementation and acceptance. Main push, deployment and further preview publication remain held.
