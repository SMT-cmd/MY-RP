# Connected infrastructure

Verified 7 October 2026. This is development infrastructure, not a launched game.

| Resource | Selected configuration | Verification |
|---|---|---|
| GitHub | SMT-cmd/MY-RP, main | Bible-backed foundation published; repository still public |
| Legacy archive | archive/holden-rpg-2026-10-07 | Preserves original main commit 309c705e758e243709797fd24a8eb3efbc8e9840 |
| Supabase organization | MyRP, bgwmmlepgkgkggniquel | User selected explicitly |
| Supabase development project | MY-RP Development, ogkuirfuwxqwstyjijln | Created at confirmed $0/month; ACTIVE_HEALTHY; public schema empty |
| Database region | Frankfurt, eu-central-1 | Selected for the initial European infrastructure spike; latency to Nigerian players remains to be measured |
| Render workspace | My Workspace, tea-d8id4ka8qa3s73easn20 | User selected explicitly; account access verified |
| Simulator Render service | Not created | Production database and identity integration required first |
| Scheduler and monitor | Not configured | cron-job.org remains the preferred job trigger; a future health monitor is separate |

These resource IDs are configuration references, not passwords or API credentials. No credentials have been added to source. The token posted in conversation was not used or stored and should be revoked.

## Deployment sequence

1. Implement versioned PostgreSQL migrations for actor identity, citizen state, balanced journals, replay keys and outbox records. Add role policies and authoritative transactional commands.
2. Integrate Supabase authentication and test actor isolation, duplicate submissions, database rollback, restart recovery and backup restoration.
3. Replace the local snapshot adapter in the hosted service. Keep the development access key and file-based store local.
4. Verify a private hosted preview and measured capacity before selecting the final D16 architecture. All Bible systems still need completion before public game launch.
5. Configure only required cron-job.org jobs against an authenticated, bounded, replay-safe endpoint, and separately configure monitoring after a deployable health endpoint exists.

Render's existing slt-tradehub free service is unrelated to MY-RP and was not changed. Free instance hours are shared by workspace. Two continuously awake services would consume 1,440 hours in a 30-day month or 1,488 in a 31-day month, exceeding the 750-hour allowance. External pings cannot remove that quota or guarantee service availability.

Making the repository private remains blocked: the connector exposes code operations but no visibility mutation. Automatic review rejected website sign-in because the earlier Google approval was declined, and requires an explicit user request to retry authentication. No retry or token workaround was attempted.
