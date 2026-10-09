# Main-game furnishing and parking contract

Added 8 October 2026 from the owner's request for mature interiors, configurable purchases and parking. This is a component of the main build; it is not a claim that the Sims-style art direction or full game has passed acceptance.

## Furniture and home access

Fourteen authored models cover bedroom, kitchen, living, study, dining and decor. Seven finishes apply to furniture, walls and floors. All prices use fictional integer minor units. Purchases require the displayed exact price and explicit terms, debit available funds once, credit the provider, and record ownership and the immutable command receipt. NPC stock is bounded to twenty units per model/region/day; purchased personal inventory has a hundred-item limit. Protected starter fixtures do not consume that limit and are not resold or redeemable.

A home resolves from completed title or current tenancy in the citizen's region, otherwise the personal starter shelter. Starter rooms have one parking space; completed property rooms have two. Entering a home binds its identity to the server location lease. Arranging furniture requires being inside that current home and submitting its current layout version. Only the item's owner can place or store it. Rotation is a quarter turn; bounds, footprints, player occupancy, entrance/exit and reachable interaction paths are checked before committing. Walls and floors use the disclosed palette.

The floor selection tool updates a draft footprint and the numeric placement fields. An explicit save commits through the same server checks as keyboard placement; a green client footprint is advisory because reachable-path validation remains authoritative. Selecting a fixture finds a reachable adjacent tile, walks there through individual server-validated moves and then interacts. It stops on uncertain responses, blur or changed home version/location/account; resolving an uncertain command does not restart the route. Keyboard placement and labelled object controls remain available.

Starter beds and pantries cannot be removed into storage. Title/tenancy changes return the departing resident's furniture to personal storage, release their parking, and revoke their old interior position. An empty residence receives usable starter fixtures for its current resident without duplicating that resident's prior grant. Purchase ownership survives moving out. There is no permission to take a tenant's furniture through landlord powers.

Bed and pantry actions retain the existing rest cooldown and protected food budget. Sitting, reading and washing have activity poses; reading does not grant qualifications and washing does not provide clinical recovery. Wardrobe inspection does not claim a clothing purchase or complete avatar customisation.

Room partitions, doorway passage, ownership, construction inputs and individual floor finishes now follow docs/interior-construction-contract.md. Walls cannot cross furnishings, doors remain clear and layouts keep all free floor areas and fixtures reachable.

## Parking

Parking/retrieval requires being outside at the current home entrance, an owned local vehicle, and no active journey. A space can hold one vehicle; a vehicle can occupy one home space. Sales and reserved repairs block parking. Vehicles must be retrieved before sale, refuelling, repair or departure. Title, physical region and parking capacity are reconciled on recovery and in PostgreSQL. The main street scene displays the resident's recorded vehicles in numbered spaces.

These are home parking records in the representative development map. Vehicle driving within cities, shared public parking, garages, fleets and nationwide road geometry remain incomplete. Furniture deliveries between regions, player furniture manufacturing/resale, multiple floors/extensions, unique property doors, guest access, drag-to-place floor editing and production art assets remain open. These limits remain release gates, not removed requirements.

## Storage and verification

Furniture/home/parking records mirror the authoritative snapshot in the private simulator schema. PostgreSQL rejects changed acquisition/title fields, missing purchase evidence, invalid footprints, mismatched mirrors and conflicting parking. Layout reachability is checked by the server and recovery reconciler. Deferred constraints and the shared command transaction commit money, ownership, receipt and outbox together.

The main 3D renderer uses procedural adult/furniture/vehicle geometry and locally served pinned Three.js, with Canvas and DOM fallbacks. All fourteen models have distinct geometry and fit their authoritative quarter-turn footprints. This does not establish accepted production art or GPU/device performance.

Tests cover duplicate purchase, exact quotes, private views, stale layout versions, rotation, footprints, blocked access, placement under a citizen, preserved purchases on residence exit, parking capacity, retrieval-before-sale, database reopening and failed-placement rollback. Device rendering, furniture art quality, multiplayer capacity and full Bible acceptance remain open.
