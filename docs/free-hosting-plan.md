# Free hosting and service plan

Researched 7 October 2026. D16 remains a proposal pending implementation, provider setup and measured capacity. User constraint: prefer usable free tiers and third-party scheduling; no paid subscriptions or upgrades have been authorised.

## Recommended development stack

Use Cloudflare Pages for the compiled browser game, Supabase for identity and durable PostgreSQL data, Supabase Edge Functions for short authenticated commands and scheduled-job endpoints, and cron-job.org to trigger background work. Evaluate Cloudflare Durable Objects for authoritative multiplayer zones. Render Free is an alternative for a Node zone-service technical spike, with sleep and restart handling built into the test.

This is a development and private testing budget, not a promise that the complete nationwide simulation can run continuously at zero cost. All Bible systems remain in scope; infrastructure constraints do not change the prelaunch completion rule. A free Supabase development project has now been created in the user's existing organization. No game endpoint or scheduler has been deployed.

| Component | Service | Verified free allowance or constraint | Build decision |
|---|---|---|---|
| Browser game and admin assets | Cloudflare Pages | Static asset requests are free and unlimited; 500 builds/month; 25 MiB maximum per asset | Recommended static frontend; dynamic requests have separate limits |
| Accounts, database and small uploads | Supabase Free | 500 MB database/project, 1 GB file storage, 50,000 monthly active auth users; free projects pause after one week of inactivity | Recommended development database; auth quota does not establish game capacity |
| Short server commands and job runners | Supabase Edge Functions | 500,000 invocations/month | Implement transactional PostgreSQL operations; never execute money changes as independent browser writes |
| Low-frequency realtime events | Supabase Realtime | 200 peak connections and 2 million messages/month | Notifications and persisted-state reconciliation; keep movement traffic off this channel |
| Authoritative zone service | Cloudflare Durable Objects, SQLite backend | Free plan supports SQLite objects; 100,000 requests/day, 13,000 GB-seconds/day, 100,000 row writes/day and 5 GB total storage | Candidate requiring a benchmark, WebSocket hibernation and zone leases; quotas halt operations when exceeded |
| Alternative Node zone spike | Render Free web service | 750 instance hours/workspace/month; sleep after 15 minutes without inbound traffic; ephemeral filesystem | Private technical testing only; store durable game data in Supabase |
| Background-job trigger | cron-job.org | Free; up to once per minute; 30-second timeout and 64 KB response limit; POST and custom headers supported | Preferred external scheduler; run bounded batches on our server endpoint |
| Signup abuse controls | Cloudflare Turnstile Free | Up to 20 widgets, unlimited challenges | Add server-side token validation alongside application rate limits |
| Transactional email, when required | Resend Free | 3,000 emails/month, maximum 100/day | Optional; requires a verified sending domain for real recipients |

Provider URLs and limits are recorded below. Limits may change and must be rechecked before deployment.

## Vercel and Render choices

Vercel Hobby is for personal, non-commercial use. It is a valid personal preview option, but should not be the free launch assumption for a monetised game. Current Vercel documentation does support WebSockets in public beta; the Hobby connection duration is capped at 300 seconds, so reconnect and external shared state are necessary. Do not carry forward the outdated blanket claim that Vercel Functions cannot serve WebSockets.

Render can host a Node WebSocket service. A free service may take about a minute to wake, and local data is lost on sleep, restart and deployment. Its free PostgreSQL expires after 30 days, so it is not the long-term free database for this game. A sleeping Render service is also a poor target for cron-job.org's 30-second request window. Point scheduled work at a short-lived serverless endpoint instead.

The user proposed cron-job.org or UptimeRobot pings to reduce idle sleeping. Based on Render's documented inbound-traffic rule, regular successful HTTP checks may prevent the inactivity condition, but they do not establish guaranteed uptime or prevent restarts. A single always-running instance consumes 720 hours in a 30-day month or 744 hours in a 31-day month, leaving little of the 750-hour workspace allowance for other free services. This arithmetic is a capacity estimate, not a provider availability commitment. Keep quotas, database recovery and reconnect logic in the design even when monitoring is enabled.

GET /healthz is implemented as a small liveness response. Once a production-safe hosted preview exists, an external monitor can check that URL at a proposed 10-minute interval with failure alerts. No external monitor is configured yet. Health checks do not perform payroll or other business jobs, and a successful liveness check does not prove database readiness. Check the selected monitor's current free interval and account limits during setup. No GitHub Actions keepalive workflow is needed.

Render and Supabase connections were verified on 7 October 2026. The user selected the MyRP Supabase organization and My Workspace Render workspace. Supabase reported and confirmed a creation cost of $0/month; MY-RP Development was created in Frankfurt (eu-central-1) and verified ACTIVE_HEALTHY. It currently has no public-schema game tables: migrations, authentication configuration and application integration remain implementation work.

Render's selected workspace already contains the separate slt-tradehub free web service. Do not change it as part of the simulator build. Both free web services would share the 750-hour workspace allowance: keeping two awake for a full month would exceed that allowance. The simulator therefore cannot assume continuous free Render operation alongside the existing service. No simulator Render service or external monitor has been created. No provider credentials are recorded in source.

Project identifiers and setup evidence are recorded in docs/infrastructure.md. These identifiers are not credentials.

## Job contract

cron-job.org sends a POST to a future scheduler endpoint with a dedicated, rotatable secret in an authorization header. It does not host or execute the simulation itself. Do not give the scheduler a Supabase service-role key or place secrets in a URL, browser bundle, repository or response.

The runner checks its server clock and claims due work from PostgreSQL. Each job has a unique business key such as world, job type, subject and accounting period. Transactional claims and deduplicated journals prevent duplicate wages, refunds or other settlements after retries. Record job state and an outbox event atomically; external side effects use their own idempotency keys and delivery records.

Process bounded batches with a proposed 20-second request budget. Return a small count and status, without player details. A timeout or missed trigger must leave recoverable due work. Resume from database records on the next invocation, with backoff and dead-letter review for persistent failures. A successful trigger must not be reported as successful settlement unless the relevant durable state actually committed.

Candidate later jobs: employer payroll, contract and escrow deadlines, auction closure, expiring licences, retention cleanup and summary metrics. Do not introduce punitive offline processing that violates the Bible's caps and recovery rules. Election deadlines must be enforced by server eligibility checks even if a scheduling trigger is late.

The present foundation does not need a cron job for school unlocks: eligibility is computed from enrolment plus elapsed server time. Its daily NPC budget is also keyed by server date, without requiring a midnight reset process. Continuous movement belongs to the authoritative zone service, not a minute scheduler.

## Before the first hosted preview

1. Replace the development access key with production identity and scoped authorization.
2. Add PostgreSQL migrations, atomic command/ledger transactions and persistence recovery tests.
3. Make the browser's API location configurable and enforce the hosted origins, JWT validation and access policies.
4. Add the actual scheduler runner and deduplication tests before configuring any cron-job.org job.
5. Implement and benchmark a zone-service adapter; publish measured limits for simultaneous players, traffic and job throughput.
6. Connect only needed providers, select their free plans, and retain exports and a tested restore route. Use provider subdomains initially; a custom domain can cost money.

The loopback development server and JSON snapshot must stay local. Supabase's default email sender is restricted to team addresses and currently two messages/hour; normal email signup needs custom SMTP. An initial configured OAuth login can avoid depending on email delivery, while email support remains required work for the full account lifecycle. Resend sending-domain setup must be verified; domain ownership costs are not included in its free email quota.

## Sources

- Cloudflare Pages static pricing: https://developers.cloudflare.com/pages/functions/pricing/
- Pages build and asset limits: https://developers.cloudflare.com/pages/platform/limits/
- Supabase pricing, inactivity and resource quotas: https://supabase.com/pricing and https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase Realtime: https://supabase.com/docs/guides/realtime/pricing
- Durable Objects pricing and free quotas: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Render free services and database expiry: https://render.com/docs/free
- Render WebSockets: https://render.com/docs/websocket
- cron-job.org scheduling, headers and timeout: https://cron-job.org/en/faq/
- Vercel Hobby purpose: https://vercel.com/pricing
- Vercel WebSocket beta and duration: https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections
- Turnstile plans: https://developers.cloudflare.com/turnstile/plans/
- Supabase default SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Resend quotas: https://resend.com/pricing
- Resend sending-domain ownership and verification: https://resend.com/docs/dashboard/domains/introduction

Sending-domain ownership and DNS setup must be completed before enabling delivery to real players. These are researched service options, not active integrations.
