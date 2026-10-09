# Residence doors and physical character motion

Main-build component, 8 October 2026. R017/R033/R034/R065/R066 remain partial; A01/A08/A17/A21 remain full-scenario gates.

## Residence authority

The finite regional NPC home has a stable authored facade at 1 Market Lane, street door (27,6). The finite land plot retains 2 Market Lane, door (36,6), when verified construction changes its kind to a home. These plots reuse existing obstacles and reachable street tiles. They are representative game addresses, not real Nigerian cadastral records. A future catalogue must allocate distinct plots; unknown asset IDs fail closed instead of sharing an arbitrary door.

The current local ready home is available only to its resident owner or active tenant. Other citizens cannot open it by sending its building ID, housing ID or home ID. The later consented-visit component adds reviewed guest entrances; see docs/home-visits-contract.md. A landlord with an active tenant uses personal starter accommodation; buying that title preserves the tenant's home and door. In other regions, personal starter accommodation stays available. No guest or household access is implicitly granted.

EnterBuilding accepts the actor's server-derived residence entrance. It checks street proximity, trip state and the existing location lease, sets the actual home ID, and increments the lease once. The stored interior discriminator remains `shelter` for compatibility with the existing home engine; presentation shows the correct home/address. Exit retains the confirmed outdoor tile where entry occurred. Idempotent retries replay the original receipt without another lease change.

SetResidence reviews the current ready local property version, verifies owner/tenant permission, requires explicit moving terms and requires the citizen to be outside without an active journey. Selecting starter accommodation or another home stores personal placed furnishings and releases recorded parking. It does not transfer property, refund purchases, end a tenancy, delete assets or cancel rent/tax/utility obligations. A newly constructed home can be selected through this action.

Purchase, tenancy and household residence changes now use the same furniture-preserving transition. It exits the previous interior and fences stale movement with a new location lease. Recovery rejects an interior home ID that is not the actor's current local residence. This check is currently in application/file/backup recovery; no new hosted DDL was applied for this milestone.

Private snapshot navigation, nearby entry actions, keyboard pathfinding, 3D facade selection, Canvas selection and parking controls use the same entrance. The residence checkpoint marked only the actor's home as enterable; the later visit component also marks expressly accepted private invitations. Other facades remain scenery. Parking bays are drawn beside the actual residence; server title, region, availability and slot-capacity checks remain unchanged. Physical street collision with parked cars remains a broader transport/art gap.

## Motion and furniture contact

`web/scene/motion.js` contains presentation-only stride, two-link leg and contact calculations. Confirmed adjacent movement interpolates over 650 ms; client held/route walking uses the same pace. The existing server rate bound remains 250 ms and is an abuse bound, not a promise that every client follows the preferred visual pace. There is no new movement reward or authority.

The gait advances by actual interpolated distance, with a 1.2 m complete stride. Each leg spends 60% of its cycle in stance and lifts during swing. Two-link inverse kinematics positions the ankle, keeps stance feet at floor height and compensates for each frame's depth scale. Facing turns smoothly; arms counter-swing. Local activity poses do not advance gait or move the authoritative tile. Teleports/region/interior changes reset locomotion.

Seat contacts use the recorded furniture rotation and cushion height. Seated pelvis and feet use solved leg angles. Rest lies face-up along the bed rather than rotating an upright character sideways through it. Standing wash/read/dress poses face their object. Activity entry blends for 350 ms after current movement, and reduced motion snaps to the readable final pose. Activity expiry uses the snapshot's server clock plus monotonic elapsed presentation time rather than relying on the device's wall clock. The presentation lasts at most ten seconds; this is not a new timed activity/reward system.

The adult head now uses an original tapered jaw/head profile, refined nose/eyes and optional idle blinking. Reduced motion keeps the eyes open. The underlying renderer is still original procedural art, not accepted production graphics. Its anchors can guide later authored rigs.

## Evidence and limits

Tests cover private/tenant/constructed doors, foreign entry denial, stale title/movement checks, replay/reload, preserved purchases and contracts, changed residence recovery, garage origin, and 3D interaction IDs. Kinematic tests check planted feet across all adult frames, alternate swing lift, frame-independent travelled distance, cushion/ground contact, all bed rotations, object-facing and reduced-motion idle presentation.

HTTP/DOM checks still exercise real commands and persisted state. All fourteen furniture models and sixty adult frame/hair/outfit geometry combinations remain covered. These checks do not verify GPU appearance or full production assets, nationwide plot coverage, multiple floors, drag furniture placement or full hygiene/cooking. The later home-visit component supplies consented guest access and private home co-presence; native GPU/device validation remains pending.

Source remains local. The prior scoped-staff hosted migration is still blocked by automatic approval review. Render's actual session-pooler connection and live provider sign-in are still unverified; Supabase's dashboard remained on its sign-in form at the final check. Main push/deployment and preview publication remain held.
