# Project status

Bible version 1.0 | Initial foundation 0.1.0 | 7 October 2026

## Source of truth

docs/specification/BIBLE.md is canonical. The requirements, decisions, acceptance and release CSVs provide traceability. Proposed parameters remain proposed until approved or validated. The supplied Bible does not guarantee coverage of earlier omitted conversation messages.

## Implemented components

- Typed domain command engine with authenticated development actor context.
- Atomic citizen starter provisioning for Independent Start, shelter and 20,000 virtual naira as an explicitly temporary development seed.
- Balanced journals and integer minor units, guarded spending and recorded receipts.
- Idempotency scoped to actor and command key, payload mismatch detection and replay of the original result.
- Finite daily NPC wage budget, protected starter shifts, server clock cooldowns and one settlement per work completion.
- Five rolling daily lesson unlocks, completion records, versioned foundation exam, failure/review flow and a single certificate on passing.
- Serialised command execution, commit-before-response persistence and event outbox in a local development snapshot.
- Loopback-only HTTP API with a generated development access key, bounded request bodies, no cross-origin access, and an accessible browser workbench.

These are components of R003, R004, R008, R009, R010, R028, R040, R056 and R075. Their full game requirements are not complete. The exam has a five-question fixture rather than the proposed 20-question production bank. Work is an accessible task completion fixture rather than a finished job minigame. Exact tests are recorded in docs/CHANGELOG.md.

All 16 automated checks pass. Browser JavaScript passes syntax checking; interactive and visual browser verification is pending because this workspace has no installed browser executable. The HTTP and domain checks do not establish production readiness. Native TypeScript execution has been verified, but static type checking is not yet configured.

Unconfirmed browser commands retain their identifiers in tab session storage; the server deduplicates retry settlements. The access key is not saved. This is a development recovery path, not the complete multiplayer reconnect protocol.

## Next implementation work

The user prefers free service tiers and cron-job.org for external scheduling. Read docs/free-hosting-plan.md for the researched provider proposal, limits and migration requirements. D16 remains proposed until production integration and capacity verification. The user selected the connected MyRP Supabase organization and My Workspace Render workspace. A free MY-RP Development Supabase project was created at a confirmed $0/month cost and verified healthy; it has no public game tables yet. No paid plan, simulator Render deployment or scheduler was created. Read docs/infrastructure.md for exact resource identifiers and remaining setup.

1. Resolve D16 infrastructure choices and create production PostgreSQL migrations, transaction adapters and identity integration.
2. Complete Independent and Random Family starts with all states, atomic onboarding and protection rules.
3. Add the Phaser world, NPC guide, movement authority, zone leases and reconnect protocol.
4. Expand starter jobs, production curriculum and exam bank, accessible task interaction and employer payroll integration.
5. Implement company, stock, route, service and civic domains in the Bible's dependency order.
6. Finish social, entertainment, advanced ownership, legacy and admin activation, then verify all closed and public modules before launch.

## Remote repository

Selected repository: SMT-cmd/MY-RP. The user authorised replacing the former RPG and requested private visibility. The original main commit is preserved on archive/holden-rpg-2026-10-07. The working source is the Bible-backed development foundation. Read docs/legacy-migration.md for the transition and existing browser-save limitations. The repository is public; making it private remains outstanding. The connected GitHub tools expose code changes but no repository-visibility mutation. Automatic approval review blocked website sign-in after the earlier Google approval was declined; an explicit authentication retry request is required before trying that flow again.

The local service includes GET /healthz for liveness checks without exposing player state. This is not a database-readiness check or an active external uptime monitor. The service remains loopback-only until production identity and durable database adapters are implemented.
