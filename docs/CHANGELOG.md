# Change log

## MY-RP migration on 7 October 2026

Prepared the Bible-backed foundation for the user-selected MY-RP repository. Preserved the former Holden RPG on archive/holden-rpg-2026-10-07 and retained its Apache LICENSE. Added an unauthenticated GET /healthz liveness response that exposes no game data. Updated the hosting plan to assess external monitoring, the shared free-hour budget and recovery limits. No monitor or hosted deployment is configured.

## Hosting proposal on 7 October 2026

Recorded the user's preference for free tiers and third-party scheduling. Added a sourced hosting plan covering Cloudflare Pages, Supabase, cron-job.org, authoritative zone candidates, email and abuse controls. Hosting integrations remain proposals. Separate GitHub website authentication stopped after declined phone approval; the prepared repository has not been published.

## Foundation 0.1.0 on 7 October 2026

Added the canonical Bible, implementation instructions and working registers. Began citizen provisioning, virtual ledger, replay-safe starter work and foundation education. Added a local persistence adapter and a loopback browser workbench. Full requirement completion and public activation remain gated by the Bible.

Validation: all 16 `npm test` checks pass. They cover citizen provisioning, concurrent command replay, payload collisions, account isolation, balanced journals, insufficient-fund rollback, wage caps and cooldowns, education unlocks, failed and successful examinations, outbox uniqueness, restart persistence and write failure. The HTTP integration test starts the real service and checks authentication, origin rejection, command replay, clock authority, malformed JSON and bounded bodies. `node --check web/app.js` passes.

Browser verification remains pending. The available Playwright package has no installed Chromium executable; the attempted browser check could not start. No visual or interactive browser result is claimed. No production type-check toolchain, production database or multiplayer deployment is included in this milestone.
