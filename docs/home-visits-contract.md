# Consented home visits and shared interiors

Main-build component, 8 October 2026. Relevant requirements remain partial: R017/R018/R019/R033/R040/R052/R053/R056/R065–R067. This component does not complete friends, partnership, household cohabitation, national maps or release acceptance.

## Invitation and entry

A resident inside their own current home can invite another existing citizen by public citizen ID. An invitation identifies the particular home, resident, recipient, server-created expiry and versioned terms. The local bounds are 15, 30 or 60 minutes from invitation creation, at most eight active invitations per home and one active invitation per recipient/home. These are proposed component limits in D29; they have no production capacity guarantee. Both directions of blocking prohibit invitations.

The recipient must expressly accept the exact home ID, expiry, terms version and current invitation version. Acceptance does not teleport the citizen or create a location lease. Only an accepted, unexpired invitation adds that home's actual entrance to the recipient's private navigation. EnterBuilding checks the correct region, street-door range, journey state and current location lease. The guest uses the existing home interior, arrival tile and recorded layout. An invitation never transfers housing, title, money, a tenancy or a household role.

A guest can walk, sit, read, wash and inspect permitted furnishings. Host bed, pantry and wardrobe fixture actions are unavailable to guests. Existing baseline rest and welfare commands retain their independent rules; this is not removal of the safety net. Furniture purchasing into personal storage remains independent, but arranging/storing furniture, decorating, construction, wardrobe changes and vehicle parking retain their own resident/title permissions. Guest views show the visited layout and the guest's own storage; they do not show the host's stored purchases or accounts. Guest entry does not count as the actor's personal starter-home foundation visit.

ExitBuilding is always available from a valid visit and retains the outdoor entry tile. Exiting clears the guest's interior marker and increases the location lease, while the accepted invitation remains usable until it ends. EndHomeVisit relinquishes that invitation. A resident can withdraw either a pending or accepted invitation from any location. Recipients can decline a pending invitation wherever they are.

## Expiry, moves and recovery

Expiry, blocking by either party, changed selected residence or lost resident/tenant permission closes access. The guest is returned to their confirmed street entry tile and their location lease increases once. A tenant's existing visit permission survives a property sale that preserves the tenancy; the new landlord receives no invitation or home entry right. Ordinary travel by the host preserves consent to the selected residence in its original region. Household membership alone grants no physical home access.

Reads settle on a copy, immediately hiding expired/obsolete interiors and presenting the new location lease without mutating durable state. The next successful new command settles those closures before checking movement, in the same transaction as its own effects. It settles again after effects such as a block, sale, tenancy ending or residence change. A rejected command does not persist cleanup, but subsequent reads still deny access. An unchanged retry returns the original receipt; current private views still enforce expiry.

Automatic closure evidence is a canonical record hash attached to the committing receipt. It does not attach other people's invitation details to an unrelated player's action. Public command, recent-activity and recovery receipts omit internal consent/closure keys and replace other account identities with public citizen IDs. Private stored receipts retain complete evidence for reconciliation.

File/backup reconciliation checks exact invitation terms, guest consent, terminal receipt proof, current resident permission, duplicate/capacity bounds and guest-position authority. It intentionally does not apply the wall clock while restoring a historical backup: expired accepted records may remain durable until settlement, but private reads and new actions always apply server time.

## Shared scene and interface

Nearby presence includes only active, nonrevoked connections in the same authorised home instance and region. Each visible peer must opt into both location and presence, and both directions of blocking remain effective. The peer projection contains public citizen ID/name, interior coordinates, curated appearance, facing and a bounded current activity pose (kind/fixture/start and optional slot only). It excludes account IDs, inventories, money and consent records. Uninvited citizens, other private homes and public service interiors remain absent. The existing 32-visible/64-active connection guard remains a component limit.

Three.js and Canvas include the authorised interior crowd. Three.js uses the same distance-driven gait and furniture-contact anchors as the local actor. Scope changes reset crowd motion. Layout edits clear occupants' presentation activities so a moved/removed furnishing cannot leave someone visually using its previous position. Confirmed actor tiles remain server authority.

The accessible invitation panel provides duration and consent review, acceptance, decline, withdrawal, ending and walk-to-entrance actions. Guest fixture controls explain the available actions and disable resident-only actions. Low graphics/data saver retains the same authority and text controls. It does not fetch optional 3D assets.

Live/fallback frames now request a fresh private snapshot after a new business cursor or changed location/home scope. This updates remote layout changes and consent revocation even without a guest click. Expiry can update the scope with an unchanged business cursor. The later shared-furniture component also refreshes the private view when the home-use revision changes, releasing busy controls without publishing a hidden peer. Stale cursor/time responses cannot overwrite a newer view; authentication failure stops scene recovery and does not restart it with cleared credentials. Unconfirmed command identifiers remain available for their own safe retry.

## Persistence and verification

The CLI-generated local migration is `20261008153709_consented_home_visits.sql`. It adds invoker functions and constraints to existing private world-scoped tables. It introduces no public Data API table, privileged public function, paid scheduler or hosted resource. Visit cores are immutable, transitions are bounded and terminal records cannot change or be deleted. Deferred checks match invitation/consent/closure evidence against actual immutable commands, reconcile world/visit/position mirrors, enforce capacity and reject unsupported home occupants. Automatic hashes use the same scalar canonical JSON as the application.

Evidence covers exact consent/foreign-entry denial, permitted fixture use, furniture/wardrobe denial, duplicate and capacity guards, stale versions, block/leave/withdrawal, expiry reads and lease fencing, tenant title transfer, moving, regional host travel, scoped presence/privacy and backup tampering. File tests force persistence failure and concurrent withdrawal/stale movement/retry, then reopen. Embedded PostgreSQL tests force failed acceptance/ejection commits, reopen and retry, and reject changed terms, unsupported consent/occupancy, mirror deletion and cross-world/browser-role access.

Two actual HTTP/WebSocket-to-JSDOM sessions exercise explicit consent, lost acceptance response and deduplicated retry, shared home presence, guest movement/sitting, a remote furniture edit, withdrawal with no guest action, and expiry with an unchanged business cursor. These are authoritative transport/DOM checks, not native browser/GPU/device playtests.

The staff, visit and later furniture-use migrations remain local. Read docs/shared-furniture-use-contract.md for position allocation and evidence. The hosted migration manifest is unchanged. Live provider login, Render session-pooler credentials, hosted pg-driver validation, device/load/art acceptance and remaining full-game systems stay open. No main source push, deployment or preview publication occurred.
