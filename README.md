# MY RP · My Roleplay

Project repository: SMT-cmd/MY-RP. The former Holden RPG is preserved on `archive/holden-rpg-2026-10-07`; see [docs/legacy-migration.md](docs/legacy-migration.md).

This repository implements the Nationwide Nigerian Life and Political Simulator specification. The canonical Bible and working registers live in docs/specification. Read docs/project-status.md for the actual state of implementation.

The existing free hosting service has earlier verified releases. The current physical gameplay upgrade is local and awaits its additive migration and deployment; see [docs/physical-gameplay-contract.md](docs/physical-gameplay-contract.md).

The staff permission/MFA component and trusted first-operator procedure are documented in [docs/staff-authority-contract.md](docs/staff-authority-contract.md). Consented home visits are documented in [docs/home-visits-contract.md](docs/home-visits-contract.md), shared fixture use in [docs/shared-furniture-use-contract.md](docs/shared-furniture-use-contract.md), and mutual relationships in [docs/relationships-contract.md](docs/relationships-contract.md). Their earlier migrations were applied; consult the dated project status for evidence. The new physical gameplay migration remains unapplied to hosted data, and production startup rejects an incompatible schema. No live staff authority is provisioned by this checkpoint.

The first working foundation includes server-owned citizen creation, starter housing, balanced virtual money journals, replay-safe commands, starter shifts, a five-day education schedule, lesson completion and a foundation exam. A small accessible browser interface exercises those real domain commands. This is the beginning of the full prelaunch build, not a completed multiplayer game.

## Run locally

Requires Node.js 24 or newer. Install pinned dependencies with npm ci.

    npm ci
    npm test
    npm run typecheck
    npm start

Open http://127.0.0.1:3000. The service binds only to loopback. A local development access key is printed at startup; enter it in the browser to use the prototype. The key is generated in memory and is not committed. State survives process restarts in .data/world.json; temporary access sessions do not.

The development access key is shared developer access, not production player authentication. The local file store proves command semantics and restart persistence only. PostgreSQL/Supabase schema, account integration, 3D rendering and authoritative movement have component implementations and earlier hosted evidence. Current-build hosted gameplay, native-device rendering, realtime zone capacity, content and remaining systems still need implementation or verification. See docs/project-status.md.

Unconfirmed browser commands retain their request identifier in tab session storage for retry after a reload; the access key stays in memory. If tab storage is unavailable, retries work only until the tab reloads. Do not run multiple server processes against one development snapshot.

Virtual balances have no real cash value. No real payments, voting, police authority or public social features are active in this foundation.

For optional local browser QA, install Chromium and run `npm run test:browser`.
`npm run test:browser:tv` separately checks TV animation and a front capture.
`CHROMIUM_PATH` overrides `/usr/bin/chromium`. The runner uses the pinned
`playwright-core` development dependency, a loopback-only in-memory world and
an ephemeral local citizen, without provider credentials. It saves captures to
ignored `.test-data/physical-world-qa` by default; `MYRP_QA_OUTPUT` overrides
the output folder. Software-WebGL and touch emulation do not replace phone/GPU
or production-account acceptance.

## Build source publication

The existing Render service watches `main` with automatic deployment off and
release stage `build`. Earlier source/release evidence is in
[docs/project-status.md](docs/project-status.md). The 18 October physical
gameplay merge is a local checkpoint; its migration and release order are in
[docs/physical-gameplay-contract.md](docs/physical-gameplay-contract.md).
The independent demo remains unchanged. Do not start this production source
against the older schema or infer full-game completion from component tests.
