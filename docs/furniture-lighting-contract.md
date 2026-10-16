# Furniture catalogue and working lamps

16 October 2026 main-build component; full requirements remain in progress.

## Catalogue and purchases

`src/furniture-catalogue.ts` preserves all fourteen original IDs, prices and footprints. It adds 23 furniture forms in six collections, producing 152 purchasable SKUs. Seven finishes give 1,064 SKU/finish combinations; this is not a claim of 1,064 unique meshes or thousands of original assets. Collection geometry uses woven, metal, carved, angled, soft and brass details. Loveseats/benches have two use positions and sofas three; all other supported use positions retain capacity one.

Prices are virtual NGN minor units. Purchases retain exact quote/finish consent, balanced journal settlement, idempotent receipts, finite regional daily stock and the existing 100 purchased-item storage cap. No real-money premium checkout, entitlement or payment processor is implemented. The visual shop uses original SVG illustrations, search, category/collection filters, price/owned sorting and 24 cards per page. Selected finishes and search survive snapshot redraws; an unchanged layout preserves the active unsent floor draft.

## Switch authority and recovery

`SetFurnitureLight` requires an owned, placed light in the actor's current usable home, current location lease, exact home version, exact prior light version and physically accessible adjacent position. Guests cannot change it. Payload: furnitureId, homeVersion, leaseVersion, lightVersion, boolean enabled, listed scene and integer brightness 0–100. There is no client-owned balance, location or ownership authority.

Each saved light has enabled, scene, brightness, version and private commandKey. The immutable command receipt must match actor, item, previous version and all four public settings. File/backup recovery and the deferred SQL trigger reject forged or unsupported settings. Switching increments the item/light versions without incrementing the layout version, charging money or awarding utilities/rewards. Storage removes the lamp from the scene and retains its settings. Placement still uses normal collision, occupancy and path checks.

Public/guest fixtures receive only the four display fields. The private light command key is excluded. Connected snapshots use the existing durable cursor; no extra client clock or scheduler is required. The migration expands the private SQL catalogue and appearance whitelist and adds one invoker trigger; no public API table, privileged SECURITY DEFINER function or new runtime grant is introduced.

## Rendering and interaction

Scenes are warm, daylight, ocean, sunset and lounge colour. Lounge colour blends gently over seconds; reduced motion keeps a fixed colour. Only enabled, server-confirmed settings light the scene. Emissive bulbs accompany at most two visible point lights in medium and four in high; lamp shadows are disabled. Canvas has coloured lamp/pool equivalents. Selecting a lamp uses the existing confirmed approach/interaction path and opens its Furniture controls; save remains an explicit action.

Car presentation is now approximately human scale, with tyres, glass, mirrors and lamps. Rendered parking bays are 2 × 4.8 units and use explicit authored side-lot coordinates. Title, capacity and retrieval rules remain server controlled. The change does not implement road driving, collision physics, passengers or vehicle enter/exit animation.

## Evidence and remaining gates

Domain tests cover exactly-once saving, invalid settings, stale versions, ownership/proximity, backup restoration and removal from scene. The interface test covers real catalogue selection, quote payloads, finish artwork and unsent floor-draft preservation. PostgreSQL tests cover catalogue parity, curved profiles, injected mirror failure/rollback, retry/reopen, forged light rejection and a two-seat loveseat. Scene tests cover every SKU/rotation, local assets, light budget and reduced motion. Full-suite and hosted-release results are recorded in project-status and hosted-schema-verification. Device/GPU quality, long-term economy balance, power billing, player manufacture, production garment art, driving and full Bible acceptance remain open.
