# Connected infrastructure

Verified 8 October 2026. This is development infrastructure, not a launched game.

## Current main setup, 8 October 2026

Source is now published and verified on build/main-game-2026-10-08 (code snapshot 4d1a4f5e15285f698f837219ea39f4e35a5e48a5). Main and demo remain unchanged; the game was not deployed. Supabase connector access is healthy and the latest read-only audit confirms fifteen forced-RLS tables, no anon/authenticated schema access and zero security findings. Four newer local migrations remain blocked by the recorded automatic approval rejection. DATABASE_URL, any required CA, provider signup and Render runtime settings are still incomplete. Read docs/github-publication.md; older checkpoint statements below are historical.

Latest instruction authorises database/environment setup and holds further previews and unfinished main publication. Installed the main schema in MY-RP Development, applied role/policy hardening and logout revocation, and initialised the empty my-rp-nigeria-1 world. Hosted verification: fourteen tables with forced RLS; no anon/authenticated schema access; postgres can SET ROLE simulator_server; security advisor clear. The initial eleven local files were applied as one atomic baseline; docs/hosted-migration-manifest.json maps their hashes to remote migration history. Subsequent migrations retain separate remote names. Do not replay old local migrations with db push without reconciling history first.

Saved SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, WORLD_ID, APP_ORIGIN, NODE_VERSION and GAME_RELEASE_STAGE in existing main Render service srv-db378467bikc73bta2e0, using merge to preserve unrelated settings. Credentials are absent from source and output. Remaining connection setup requires this project's actual session-pooler URL and database password through secure account access, plus a trusted CA if required. A dedicated login with simulator_server membership is preferable to an administrative login. Never use service-role/browser credentials for PostgreSQL or disable TLS validation.

The existing main service still uses yarn/yarn start, has no healthCheckPath and auto-deploys commits. Prepared render.yaml specifies npm ci --omit=dev, npm run start:postgres, /readyz and automatic deployment off, without adding a paid database, disk, worker or cron service. These existing-service settings still require application in Render; the Blueprint is not synced. Do not create a second service when applying them. No main source push or full-game deployment has occurred. Leave the old demo unchanged.

Supabase authentication Site URL, redirect allowlist and email delivery must also be configured and tested before public signup. The built-in SMTP sends only to project team members and is limited to two messages/hour; public signup requires custom SMTP (https://supabase.com/docs/guides/auth/auth-smtp). No email account/provider or paid subscription was created. The local account proxy and server identity boundary are verified through HTTP/DOM/PostgreSQL tests; live login, pooler/TLS driver connection, reboot and backup restoration remain gates. A configured environment is not a completed deployment.

## Earlier infrastructure inventory and history

The following records describe earlier checkpoints; the current setup above supersedes their former migration/configuration hold.

| Resource | Selected configuration | Verification |
|---|---|---|
| GitHub | SMT-cmd/MY-RP, main | Bible-backed foundation published; repository still public |
| Legacy archive | archive/holden-rpg-2026-10-07 | Preserves original main commit 309c705e758e243709797fd24a8eb3efbc8e9840 |
| Supabase organization | MyRP, bgwmmlepgkgkggniquel | User selected explicitly |
| Supabase development project | MY-RP Development, ogkuirfuwxqwstyjijln | Created at confirmed $0/month; ACTIVE_HEALTHY; private simulator schema installed; public schema empty |
| Database region | Frankfurt, eu-central-1 | Selected for the initial European infrastructure spike; latency to Nigerian players remains to be measured |
| Render connection | KING SMT | User-confirmed Alonge's workspace, tea-db377mbtqb8s73fqsf70; independent free preview live |
| Existing MY-RP Render service | srv-db378467bikc73bta2e0, free, main, Ohio | Existing main code not replaced; six env entries saved; runtime settings pending |
| Independent visual preview | srv-db3dm46i0phs739o71fg, free, Frankfurt | Demo-only branch live; automatic deployment off |
| Scheduler and monitor | Not configured | cron-job.org remains the preferred job trigger; a future health monitor is separate |

These resource IDs are configuration references, not passwords or API credentials. No credentials have been added to source. The token posted in conversation was not used or stored and should be revoked.

## Deployment sequence

1. Implement versioned PostgreSQL migrations for actor identity, citizen state, balanced journals, replay keys and outbox records. Add role policies and authoritative transactional commands.
2. Integrate Supabase authentication and test actor isolation, duplicate submissions, database rollback, restart recovery and backup restoration.
3. Replace the local snapshot adapter in the hosted service. Keep the development access key and file-based store local.
4. Verify a private hosted preview and measured capacity before selecting the final D16 architecture. All Bible systems still need completion before public game launch.
5. Configure only required cron-job.org jobs against an authenticated, bounded, replay-safe endpoint, and separately configure monitoring after a deployable health endpoint exists.

The old Primary connection's slt-tradehub service is unrelated to MY-RP and was not changed. The new KING SMT workspace already contained the failed MY-RP service; it was also left unchanged. Free instance hours are shared by workspace. Two continuously awake services would consume 1,440 hours in a 30-day month or 1,488 in a 31-day month, exceeding the 750-hour allowance. External pings cannot remove that quota or guarantee service availability.

Making the repository private remains blocked: the connector exposes code operations but no visibility mutation. Automatic review rejected website sign-in because the earlier Google approval was declined, and requires an explicit user request to retry authentication. No retry or token workaround was attempted.

## Build-only instruction

The user requested no deployment or further push until all Bible milestones are finished. Migration files and adapters are being built and tested locally only. The newly connected KING SMT account resolves the previous account discrepancy: it exposes Alonge's workspace, rather than the old Primary account. The user confirmed Alonge's workspace for the independent demo. Inventory found the failed MY-RP main-branch service, so an independent demo-only service was created. The full simulator remains undeployed. One continuously running instance fits within 750 hours for a 31-day month (744 hours), provided it is the only consumer and other quotas remain within limits. Oracle Cloud remains an unevaluated hosting alternative.

## Visual demo request, 8 October 2026

The latest request authorizes visual prototype/demo preparation separately from the full-game hold. `demo/` contains a client-only sample and a fixed-asset Node host with no game API, private world, identity key, database, or secrets. Publish only this package and LICENSE on `demo/visual-preview-2026-10-08`; keep the unfinished full-game changes off main. Prepared settings: free Node web service, Frankfurt, automatic deploy off, build `node demo/build.mjs`, start `node demo/server.mjs`, health `/healthz`. Node 24.21.0 matches the documented current Render default checked on 8 October (https://render.com/docs/node-version); `demo/render.yaml` uses the current documented Blueprint fields (https://render.com/docs/blueprint-spec). No dependency install is required.

The user confirmed Alonge's workspace, `tea-db377mbtqb8s73fqsf70`, under KING SMT. Existing service `MY-RP` (`srv-db378467bikc73bta2e0`) had an `update_failed` main-branch deployment and was left unchanged. Created the independent `my-rp-visual-preview` service (`srv-db3dm46i0phs739o71fg`), free plan, Frankfurt, Node, automatic deployment off. Initial deployment `dep-db3dm56i0phs739o76f0` is live at https://my-rp-visual-preview.onrender.com/. Retrieved logs report successful startup on Render's port. A direct browser check of `/healthz` was blocked by the browser client (ERR_BLOCKED_BY_CLIENT), so hosted response-body verification remains pending. The app's `/healthz` liveness route exists; the MCP creation schema does not expose healthCheckPath and the actual service setting is empty. No scheduler, keep-alive integration, remote migration or paid resource was created. Desktop browser verification confirms the actual first-day preview; mobile device and authoritative game verification remain separate gates. The service displayed the expected sleep/wake startup screen before loading on a later visit.

Published demo-only head: `ba289e806c97e1d4cd1afaecd67846efa45a0f35` on https://github.com/SMT-cmd/MY-RP/tree/demo/visual-preview-2026-10-08. Its tree contains the preview package, LICENSE, a minimal preview-only package.json/README, and root render.yaml. Full-game changes and development/production server files were not published on this branch, and main was not updated.
