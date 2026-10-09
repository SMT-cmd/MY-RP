# Nigerian Life and Political Simulator

Project repository: SMT-cmd/MY-RP. The former Holden RPG is preserved on `archive/holden-rpg-2026-10-07`; see [docs/legacy-migration.md](docs/legacy-migration.md).

This repository implements the Nationwide Nigerian Life and Political Simulator specification. The canonical Bible and working registers live in docs/specification. Read docs/project-status.md for the actual state of implementation.

The researched free-tier hosting proposal is in [docs/free-hosting-plan.md](docs/free-hosting-plan.md). Provider setup and deployment are not yet complete.

The local staff permission/MFA component and trusted first-operator procedure are documented in [docs/staff-authority-contract.md](docs/staff-authority-contract.md). Consented home visits, guest permissions and shared interiors are documented in [docs/home-visits-contract.md](docs/home-visits-contract.md). Shared fixture positions and availability are documented in [docs/shared-furniture-use-contract.md](docs/shared-furniture-use-contract.md). Mutual friendship/partnership consent is documented in [docs/relationships-contract.md](docs/relationships-contract.md). All four additive migrations remain local; do not run the newer main source against the old hosted schema. No live staff authority has been provisioned.

The first working foundation includes server-owned citizen creation, starter housing, balanced virtual money journals, replay-safe commands, starter shifts, a five-day education schedule, lesson completion and a foundation exam. A small accessible browser interface exercises those real domain commands. This is the beginning of the full prelaunch build, not a completed multiplayer game.

## Run locally

Requires Node.js 24 or newer. Install pinned dependencies with npm ci.

    npm ci
    npm test
    npm run typecheck
    npm start

Open http://127.0.0.1:3000. The service binds only to loopback. A local development access key is printed at startup; enter it in the browser to use the prototype. The key is generated in memory and is not committed. State survives process restarts in .data/world.json; temporary access sessions do not.

The development access key is shared developer access, not production player authentication. The local file store proves command semantics and restart persistence only. PostgreSQL/Supabase schema, account integration, 3D home rendering and authoritative movement now have component implementations. Hosted driver/login, device rendering, realtime zone capacity, the complete content catalogue and remaining systems still need implementation or verification. See the build sequence in docs/project-status.md.

Unconfirmed browser commands retain their request identifier in tab session storage for retry after a reload; the access key stays in memory. If tab storage is unavailable, retries work only until the tab reloads. Do not run multiple server processes against one development snapshot.

Virtual balances have no real cash value. No real payments, voting, police authority or public social features are active in this foundation.

## Build source publication

The current main-game build is published on `build/main-game-2026-10-08` under the owner's 8 October push instruction. The existing Render service watches `main` with automatic deployment, so the build branch keeps source publication separate from launching the unfinished game. The latest code checkpoint passes 192 tests and strict TypeScript. Read [docs/project-status.md](docs/project-status.md) for the remaining requirements and unapplied hosted migrations. The independent demo branch remains unchanged.
