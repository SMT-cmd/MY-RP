# Main connection and nearby-presence component

Scope: components of R002, R040, R052, R053, R056 and R065–R067. Full requirements and A02/A08/A20 acceptance remain open.

## Authority and lifecycle

The production and local main entries require an authenticated active client lease for every new command. The file and PostgreSQL stores check the lease inside the same serial transaction as the business mutation. A committed command remains recoverable by its original actor and exact payload after takeover or expiry, but a revoked account session cannot read or replay it.

Each citizen has one durable lease with tab ID, claim-incarnation ID, Auth session, monotonically increasing epoch, last heartbeat and expiry. Repeating the same claim renews its epoch; a new incarnation increments the epoch, including documents that duplicate sessionStorage. Another tab ID requires explicit takeover while the old lease is active. Heartbeats occur every 20 seconds and leases expire after 60 seconds. These are connection bounds, not the Bible's proposed gameplay disconnect-grace or offline-obligation decisions.

Claims, takeover, renewal, release and logout commit to the private world snapshot and client_sessions mirror atomically. PostgreSQL rejects decreasing/jumping epochs, changed identities at the same epoch, reversed timestamps, malformed leases and mismatched mirrors. The table forces world-scoped RLS and is inaccessible to browser Data API roles. Lifecycle metadata does not increment the business outbox cursor or create financial events.

## Transport and projection

POST /api/connect claims authority and returns a fresh private view. POST /api/heartbeat renews it, and POST /api/disconnect releases it. GET /api/live upgrades only from the exact application origin, with no URL query. Authentication occurs in the first bounded WebSocket frame through the normal verified identity provider. Tokens never enter URLs, cookies or browser storage. Only heartbeat messages are accepted afterward; domain actions use the bounded authenticated HTTP command endpoint.

Live frames carry protocol version, stream sequence, lease epoch, durable business cursor and current region/interior/location-lease scope. Snapshots are authoritative replacements, not financial deltas. Heartbeats also consume the stream sequence. Missing sequences cause reconnect. Handshake timeout, message rate, payload size, compression, connection and outgoing-buffer limits are enforced. Origin mismatch, takeover, logout, expiration and failure close the stream without settling a new action.

Active nearby street citizens who explicitly enable both location and presence appear. The later home-visit component also permits opted-in peers within the same authorised private home. Both directions of blocking are respected. Other regions, uninvited private interiors, transit, expired/released leases and revoked sessions disappear. Projection contains public citizen ID, name, confirmed street/interior tile and facing, curated rendered appearance and bounded current home activity. It excludes account/Auth IDs, money, inventories, receipts and private households. Emergency SQL session revocations also suppress peers without a connected socket. The live scene has a conservative 32-visible/64-active guard; these are implementation limits with no capacity guarantee and do not approve D17's proposed 100-visible test seed.

GET /api/presence supplies the same projection for the fallback transport. GET /api/recovery returns a fresh private snapshot and a bounded 256-event receipt page filtered to the actor, with cursor/reset/hasMore metadata. After restoration, a cursor beyond the current outbox resets. A full snapshot covers current state even when older receipts require further pages; uncertain business commands still retry their own identifiers.

## Browser behavior

The tab stores only its nonsecret ID and the existing account-bound unconfirmed command intent. Claim incarnations, leases, cursors and credentials remain in memory. Initial/reconnect state blocks new actions until the fresh snapshot and live projection arrive. The browser requests recovery from its last event cursor; missed sequences and socket loss reconnect with bounded backoff. No offline economic actions are queued automatically. Takeover is explicit. Hidden/offline tabs stop movement, routes and heartbeat traffic; reconnect never resumes an approach action automatically. Auth failure returns to sign-in without clearing an uncertain business intent.

The accessible list, articulated adult crowd rigs and Canvas fallback use the same public projection. Adjacent confirmed moves interpolate; larger discontinuities reconcile immediately. Reduced motion remains available. Fresh private views preserve a matching current crowd frame, avoiding disappearance when the HTTP command response follows its live update.

Private scene snapshots now refresh after a changed business cursor or location/home scope, including expiry at an unchanged cursor. A private home-use revision also refreshes fixture availability after pose expiry without exposing hidden occupant identities; public activity includes only kind/fixture/start and an optional slot. Read docs/shared-furniture-use-contract.md. A later private per-actor relationship revision also refreshes pending consent expiry at an unchanged cursor without attaching a social graph to nearby peers; see docs/relationships-contract.md. Stale scope/time responses cannot overwrite newer views. Automatic authentication failure stops recovery and clears private connection authority. Unconfirmed business requests retain their original retry identifiers. Read docs/home-visits-contract.md for the later component and evidence.

## Evidence and open gates

138 automated checks pass. New coverage tests concurrent claims, exact-claim retry, duplicated-document incarnation, takeover, TTL and capacity guards; file restart, replay and durable logout; privacy/block/region/interior/expiry projection; actual HTTP/WebSocket origin, query, authentication, sequencing, prohibited actions and flood rejection; PostgreSQL rollback/mirror/tamper/isolation and revocation; adult crowd geometry; real HTTP-to-JSDOM purchase response loss, takeover, reconnect and revoked sign-in recovery.

Hosted PostgreSQL 17 received migration 20261008110107. Its constraints were exercised as simulator_server in a transaction explicitly rolled back, leaving no probe lease, citizen or event and revision zero. All fifteen private tables force RLS, browser schema access remains absent, function search paths are fixed and the security advisor reports no findings. Embedded adapter tests use PostgreSQL 18; the production pg-driver and actual Auth login remain unverified.

GPU/device/art acceptance, weak-network/load measurements, multiple processes, nationwide zones and venue crowd behavior, broader household/cohabitation and guest scenarios, gameplay disconnect abuse, delegated offline work, push and PWA delivery remain open. The single-world lock and whole-state snapshots require measured capacity before production. No main push, deployment or additional preview publication occurred.
