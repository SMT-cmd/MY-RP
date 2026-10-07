# Nigerian Life and Political Simulator

Project repository: SMT-cmd/MY-RP. The former Holden RPG is preserved on `archive/holden-rpg-2026-10-07`; see [docs/legacy-migration.md](docs/legacy-migration.md).

This repository implements the Nationwide Nigerian Life and Political Simulator specification. The canonical Bible and working registers live in docs/specification. Read docs/project-status.md for the actual state of implementation.

The researched free-tier hosting proposal is in [docs/free-hosting-plan.md](docs/free-hosting-plan.md). Provider setup and deployment are not yet complete.

The first working foundation includes server-owned citizen creation, starter housing, balanced virtual money journals, replay-safe commands, starter shifts, a five-day education schedule, lesson completion and a foundation exam. A small accessible browser interface exercises those real domain commands. This is the beginning of the full prelaunch build, not a completed multiplayer game.

## Run locally

Requires Node.js 24 or newer. There are no external runtime dependencies for this foundation.

    npm test
    npm start

Open http://127.0.0.1:3000. The service binds only to loopback. A local development access key is printed at startup; enter it in the browser to use the prototype. The key is generated in memory and is not committed. State survives process restarts in .data/world.json; temporary access sessions do not.

The development access key is shared developer access, not production player authentication. The local file store proves command semantics and restart persistence only. PostgreSQL/Supabase, account authentication, Phaser world movement, realtime zones, the complete content catalogue and the remaining systems are still to be implemented and verified. See the build sequence in docs/project-status.md.

Unconfirmed browser commands retain their request identifier in tab session storage for retry after a reload; the access key stays in memory. If tab storage is unavailable, retries work only until the tab reloads. Do not run multiple server processes against one development snapshot.

Virtual balances have no real cash value. No real payments, voting, police authority or public social features are active in this foundation.
