# Destination movement, interactive objects and playable art

16 October 2026. This component addresses the owner's reports of short steps,
slow responses, non-interactive furniture, primitive buildings and missing adults.
It does not finish the whole game or establish photorealistic/device acceptance.

## Movement and response work

The Canvas and WebGL views dispatch a floor selection during pointer release.
The same release previously bubbled into a global stop handler and cancelled
the new route after its first command. Pointer release now stops held controls
without cancelling a tap route. Blur, cancellation, hidden documents, menus,
uncertain replies and scope changes still stop input. A fresh floor tap can
replace a route after its in-flight step confirms; it never queues a purchase,
survives a disconnect or discards a retained command identifier.

The client step interval is 300 ms, above the unchanged server's 250 ms minimum.
This is a pacing floor, not a network-latency/FPS guarantee. Each step remains
collision/range/lease validated, persisted and acknowledged. A destination ring
shows the accepted local intent immediately. Canvas hit coordinates use the last
painted camera transform, including interpolated following, rather than the next
authoritative tile. Imported sprite hit regions ignore transparent pixels.

Command stores may return their exact committed state internally. HTTP produces
the same private filtered citizen view from that state instead of opening a
second database transaction. It never serialises the raw state into the response.
The initial busy lock avoids rebuilding all furniture/business forms. Live
recovery waits for a pending command before requesting a redundant snapshot;
confirmed revisions still repair unrelated changes and expiry.

The actual cloud browser observed Render's free-service wake screen before game
code loaded. No paid resource, uptime ping or claim of eliminating cold starts
is included. Render returned no recent error logs and no samples for the queried
performance metrics. Real device/WAN throughput and zone-service scaling remain
acceptance work; this release still uses durable adjacent movement commands.

## Selection and objects

Selecting a furnishing opens a contextual panel immediately and does not use or
move it. Explicit actions approach/use it, open its existing placement/finish
editor, rotate its recorded placement or put it into storage. Ownership, guest
permissions, occupancy, protected starter items, collision, layout revisions and
receipts remain server controlled. Existing wardrobe and lamp “walk to” controls
remain direct physical-use intents. Opening/closing panels releases held input;
an unsaved placement draft is preserved. Server-confirmed light settings retain
the existing visible bulb/pool and bounded accelerated light budget.

## Local licensed art and expanded map

Fifty selected models from Kenney's Furniture Kit, City Kit Suburban, City Kit
Commercial and Car Kit are imported as data. Each archive's original CC0 licence
is retained. Reviewed archive and source-member hashes are recorded in
`web/assets/world/manifest.json`. The 50 self-contained GLBs total 3,551,988 bytes.
Referenced palette textures are embedded; there is no runtime asset CDN, remote
code, paid package, external tracking or required on-screen attribution.

`tools/assets/import-kenney.py` reproduces the subset from hash-checked archives.
`web/scene/asset-catalogue.js` maps the recorded furniture forms and buildings to
models. Runtime dimensions and rotation fit the existing collision footprints.
The accelerated library limits parallel fetches, clones owned geometry/materials,
retains shared templates/textures until disposal and fences late completion.
Downloaded models do not change prices, ownership, housing entitlements or cars'
gameplay. Vehicles remain parked presentation; direct steering is still open.

The same 50 models have 200 software-rendered WebP views, totalling 2,563,432
bytes. Canvas loads needed views lazily and retains the old immediate drawing
only while assets load or fail. The adult fallback now draws posed projections
of the same existing Quaternius CC0 male/female meshes, with four directions,
walking/sitting/resting/reading, four outfits and mask-based saved colour choices.
Eight atlases plus masks total 1,035,384 bytes. These are actual mesh projections,
not new AI concept pictures. The two rendering scripts and mesh export script
reproduce them. Hair is attached to the imported head bone during reclining and
turns. Canvas retains approximate hair silhouettes/frame scaling; full garment,
hair and device visual acceptance remains open. Creation shows a rotatable adult
selection before the authoritative citizen command is sent.

The authored map expands from 66 × 42 to 110 × 70 tiles, with five named districts,
different residential/commercial/tower facades and connecting roads. Existing
service footprints, old collision-free street tiles, private plot IDs/addresses,
property rights and saved home layouts remain unchanged. Every walkable tile is
connected by the existing path rules. The phone map draws actual authored roads,
buildings and confirmed location; tapping a street or an available building uses
the same physical navigation. Canvas ground iteration is bounded by the visible
camera area. Windows, curtains, skirting and plank flooring improve the home shell.
These remain representative authored districts, not a cadastral/nationwide map.

Gameloft is not a connected engine or free asset source for this implementation.
Its official licensing page describes a contracted, fee-based IP/assets process.
No Gameloft assets were extracted. Unity was not provisioned or substituted.

## Session recovery and account evidence

Successful authentication now sets a host-only HttpOnly, SameSite=Strict session
cookie on `/api/auth`; production uses Secure and the `__Secure-` prefix. It has
no persistent expiry and never contains a password. Same-origin JSON POST resume
exchanges that refresh token with the configured provider; it is never itself
accepted as identity. The browser receives ordinary access/refresh fields only
in memory, and normal verified-user plus database revocation/lease checks remain.
Refresh requests in a document share one in-flight operation. Logout clears the
cookie. Invalid/duplicate/malformed cookies and foreign-origin resume are rejected;
provider 401 clears the saved cookie while 5xx preserves recovery. No credential
or token is put into localStorage/sessionStorage or a URL.

A successful password response followed by a temporary citizen-load failure is
recoverable without throwing away the valid session. A provider outage is 503;
an unconfirmed email has explicit confirmation guidance; signup-email throttling
retains scoped cooldowns and never blocks password login. Email verification and
provider limits were not weakened. Read-only aggregate evidence at this checkpoint
is three Auth registrations, one email-confirmed account and no currently banned
account. No identities, tokens, raw logs or emails are in the evidence. This does
not identify which registration produced a reported failure. Public SMTP/sender
setup remains a separate delivery gate; code cannot confirm an email for its owner.

The login page no longer links to the concept/provenance gallery or displays the
art-credit caption. The source retains licences/provenance and a truthful build
status. No new account, confirmation email, paid service, schema migration or
independent demo change was made for this release.

## Verification

The complete checkpoint passes 227 tests (129.80 s), strict TypeScript and browser
script syntax. New regression cases cover real bubbling pointer release, exact
destination and safe retargeting, non-mutating selection, origin/cookie rotation,
invalid sessions/outages, precise committed response/no extra read, original GLB
hashes/embedded textures, independent fitted meshes and public binary delivery.
Existing money, SQL rollback/reopen/forgery, privacy, live expiry, receipt recovery,
PWA, layout and ownership cases pass. Publication, actual live browser evidence
and any remaining sign-in handoff are recorded in the release checkpoint.

Primary references checked 16 October:

- https://kenney.nl/assets/furniture-kit
- https://kenney.nl/assets/city-kit-suburban
- https://kenney.nl/assets/city-kit-commercial
- https://kenney.nl/assets/car-kit
- https://www.gameloft.com/licensing-out
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/changelog.md
