# Physical gameplay implementation, 18 October 2026

## Scope and sources

This checkpoint implements a connected physical gameplay loop in the existing Node/Three.js game. Main baseline is `50edec602a7c64dcfcb3790ff22cd603b540f1d9`; recovered branch source is `df05ceeb2d03ba66e81fd10b6fcfeb95fbd401a7`. The merge preserves both sources and completes missing integration, persistence and verification.

The owner supplied a handoff, specification PDF and 48.43-second portrait gameplay video. The clip is a visual reference for adult scale, camera distance and spatial interaction; its game identity is unconfirmed. Attached instructions are context, not an independent grant of operational authority. The canonical repository Bible v1.1 (8 October) is newer than the PDF v1.0 (7 October). Requirement statuses remain incomplete where whole-system acceptance is outstanding.

## Movement, rooms and camera

`NavigateCitizen` plans a bounded server-owned path of at most 512 steps. Walking advances every 300 ms; road driving every 150 ms. The server projects only its recorded path using server time, rechecks room access/layout, and checkpoints positions before commands. A normal pointer route needs a start and a durable stop/checkpoint rather than a database transaction for every displayed step. Projection reads and WebSocket traffic still have cost; no measured WAN or capacity improvement is claimed.

The browser waits for a confirmed destination before entering a room or interacting. A lost acknowledgement retains the original command identifier. An accepted route may already be progressing on the server, but the client does not automatically enter or use an object until it has recovered/reselected the action. Focus/input release sends `StopNavigation` after any pending receipt is resolved.

Keyboard movement still sends individual authoritative steps. One pending step may be shown immediately, with bounded recovery if rejected. It cannot grant a location, purchase, reward or fixture use. Collision, lease, ownership and receipt checks remain on the server.

Follow, close and overview cameras support rotation, zoom, pinch and camera-relative input. Walls/tall furnishings bound the camera; a close obstruction raises it to keep the actor readable. Room transitions align the follow view behind the actor. The low/data-saver path keeps the simpler Canvas renderer and controls; detailed 3D activity effects and animated TV imagery are not equivalent in that fallback.

## Home activity and television

Furniture use approaches a valid front tile, aligns the actor, then animates contact. Seat/stand transitions retain a visible departure before walking. Imported CC0 adult meshes use separate procedural skinned garments, hand targets and bounded water/foam/towel/flush effects. Toilet and shower presentation uses clothing/frosted privacy surfaces.

| Activity | Server duration |
| --- | ---: |
| Sit, read, dress, rest, wash | 10 seconds |
| Toilet | 14 seconds |
| Shower | 18 seconds |
| Clean | 12 seconds |

Start receipts record origin, fixture/home versions, lease and slot. Finishing requires the same authorized room, unchanged versions/origin and elapsed server duration, within a two-minute completion grace. Walking, room access loss and explicit cancellation interrupt the activity. Early, stale or replayed completion cannot duplicate a benefit. Public HTTP rest uses the bed flow; an internal legacy domain command remains readable for compatibility.

Hygiene, bladder, comfort, fixture dirt and care experience derive from completed sessions. Care experience is limited to one qualifying completion per minute. Rest uses the existing life/rest rules. An explicit free bathroom fit-out adds a starter toilet and shower only where the complete layout remains valid; it never moves existing furniture and atomically fails if both cannot fit.

The catalogue now has 155 items, preserving the original 152 and adding toilet, shower and television. The television costs 75,000 kobo (₦750). Owner/proximity/lease/layout/screen-version checks protect saved power/channel settings, without invalidating an unsent floor draft. Guests view permitted settings but cannot change them. Three original silent Canvas channels (city, nature and learning) update a bounded 384 × 216 texture at five frames per second. This is an animated in-world programme, not streamed broadcast/video-provider integration.

## Venues, work, purchases and vehicles

School, workplace, market, clinic, terminal and showroom have physical rooms/counters. Work requires three timed five-second stations and the existing one-minute shift settlement. Existing reserved wages, eligibility and exact receipt rules apply.

Showroom orders record an exact model, finish and virtual price. Players collect purchases at the pickup counter, return home and place them using existing layout validation. Each collected order earns 25 design XP once on its first valid placement; replaying or moving it cannot duplicate the award. Existing phone purchasing is retained alongside this spatial flow.

Owned roadside vehicle entry checks permission, current game driving licence, condition, available fuel and local position. Server-issued connected road routes reserve fuel in the stock ledger, consume travelled portions and refund unused reservation on stop. Moving exit is rejected until the route is stopped. The complimentary studio shuttle includes an NPC driver and consumes no player fuel. Decorative ambient traffic is bounded scenery, not shared player driving or a collision simulation.

These are timed road routes, not a continuous steering/physics model. Additional real-time revocation/expiry cases during an already accepted drive, traffic collisions, passenger rules and device driving feel remain acceptance work.

## Persistence and migration

`supabase/migrations/20261018190000_physical_world_gameplay.sql` is local and **not applied to hosted data**. It adds catalogue parity, showroom purchase recognition, care/navigation/work/order/driver/location mirrors and deferred receipt/reconciliation constraints, plus television validation. Existing journal and stock reconciliation stays active.

The runtime may delete only the current actor's transient `physical.work` and `physical.driver` records in the current world. A restrictive DELETE policy limits the newly granted table privilege; historical receipts, ledger records and other domain mirrors remain protected. Constraints compare physical mirrors with the authoritative snapshot in both directions.

Production startup calls `assertPhysicalSchema` before creating/loading a world. An old catalogue or missing physical/television validation functions/policy stops startup with a migration error rather than serving incompatible gameplay. Local PGlite tests verify this guard and transaction rollback/reopen/replay behavior. PGlite is not hosted PostgreSQL acceptance.

## Reproduce validation

Use Node 24+, `npm ci`, `npm test` and `npm run typecheck`. The optional `npm run test:browser` requires Chromium (`CHROMIUM_PATH` overrides `/usr/bin/chromium`). It starts a loopback-only, in-memory world, uses an ephemeral local identity and closes its server/browser afterward. Default output is ignored `.test-data/physical-world-qa`; `MYRP_QA_OUTPUT` selects another output folder.

The browser runner checks camera modes, free fixtures, timed sit/wash/toilet/shower benefits, physical showroom purchase/collection, return/placement, exactly 25 design XP, saved television after reload, and a 390 × 844 touch-emulated layout. Fixture selection enters through the normal client selection events and then clicks real action controls; this is not end-to-end 3D ray-picking acceptance. Screenshots under `docs/qa/2026-10-18` are local Chromium software-WebGL evidence. Final counts/results are recorded in `docs/releases/2026-10-18-physical-gameplay-local.json`.

Domain checks cover early/cancelled/replayed activities, restoration/tampering, authoritative path timing, showroom progression, work and fuel reservation/refund. SQL checks cover physical/TV mirrors, rejected forgery, work settlement, restricted deletion and startup readiness. Existing identity, origin, privacy, RLS, journal, backup and interface regressions stay in the complete suite.

## Release prerequisites and remaining work

No Render/Supabase management connector is callable in this chat; required production bindings are also absent from this runtime. Account connections elsewhere do not make their tools available here. The environment draft saves reusable install/start instructions, additive variable/secret requirements and network destinations for review. Saving does not publish settings, inject values, run a migration or deploy the game. Do not paste credentials into chat or recreate existing projects.

For an authorized live release on the existing free service:

1. Make the existing provider tools/bindings available, read current migration/service state, and take/verify the existing backup procedure.
2. Review this exact migration and apply it through the existing project migration workflow. Verify catalogue/function/policy parity and rolled-back positive/negative probes before starting new source.
3. Publish the verified merge, retain automatic deploy off and `GAME_RELEASE_STAGE=build`, and deliberately deploy on the existing service. Do not add a paid plan or alter the independent demo.
4. Verify TLS/readiness, auth/origin denial, exact assets, existing-account cookie restoration, saved activities/purchases and two-client privacy/presence. Record exact commit, migration and deployment evidence.

Rollback must retain new catalogue/state readers once players acquire the new items. Blindly returning to pre-upgrade source can make those saves unreadable. Stop writes and inspect a compatible rollback path; never wipe accounts, items or ledger history.

The pinned external PBR importer was blocked by the current network proxy. Runtime uses original deterministic procedural surface textures and existing licensed meshes; missing vendor binaries are not activated. Unity Store assets have not been selected, licensed or downloaded here. Bespoke character/furniture art, production animation polish, audio and real-device review are still required to assess the owner's visual target.

Priorities after this checkpoint are production account/multiclient verification; measured phone GPU/touch/landscape/fallback performance; art/animation/cultural review against the video; continuous vehicle controls and collision rules; and the remaining Bible systems/content. Nationwide scenes, broader social/political/economy acceptance, public SMTP, load/cold-start and operational restore gates remain open. This checkpoint cannot establish parity with GTA, The Sims, OneState or Lagos Life, or full-game completion.
