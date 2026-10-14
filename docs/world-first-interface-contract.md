# World and phone interface

14 October 2026. This implements the owner's correction to the scrolling main dashboard. The main build remains in development; this is interface and recovery evidence, not whole-game or production-art acceptance.

## Playing surface

After authenticated citizen loading, the world occupies the viewport. A compact HUD shows name, virtual wallet, location, needs, activity and connection/command state. The walking pad works outdoors and in authorised home interiors. Nearby confirmed interactions appear over the scene. Doors, furniture, NPCs and floor tiles retain graphical selection and authoritative approach commands. Camera pan, zoom and recenter controls remain available. The default adult framing is larger in both renderers.

Existing command controls are moved into one selected phone drawer, rather than duplicated as independent command implementations. Existing IDs, reviewed prices/terms, bearer identity, server-time eligibility, client fencing and idempotent command identifiers stay intact. Panel closing, app navigation and camera controls remain available while a command is pending or the controlling connection is lost; game actions stay locked. Pending recovery and takeover remain visible above the world, even when another app is open.

| App | Existing controls |
| --- | --- |
| Home / Furnish / Wardrobe | Needs, household, invitations, housing, owned furniture, floor placement, room finishes and parking; saved appearance |
| Work / School | Starter tasks, employment, foundation lessons/exam, advanced study, licences and teaching |
| People | Privacy-filtered nearby citizens, scheduled NPC conversations and consenting relationships |
| Wallet / Business | Banking, savings, disclosed credit/transfers, companies, stock, production, orders and protected ownership decisions |
| Travel / Care / Community | Journey booking and recovery, vehicles, treatment, insurance and petitions |
| Activity / Settings / Help / Map | Receipts, privacy/graphics/account/connection, instructions and accessible physical destinations/interactions |

Confirmed entry into a school, clinic, market, work desk or terminal opens the corresponding app. Home entry retains the visible room. A confirmed wardrobe interaction opens the wardrobe app before focusing its hairstyle control. NPC selection opens People before focusing that neighbour. Escape or Close hides the panel and restores a usable navigation focus.

## Input and display

Opening/changing panels, orientation/viewport changes, full-screen changes, blur, hiding the tab, uncertain responses and disconnection release held input and cancel automatic routes. Closing a panel, retrying a receipt or restoring connection does not revive the previous held direction. Pointer release/cancellation also stops touch walking. Holding the pad uses the existing bounded adjacent-move commands; it adds no client-side movement authority.

Portrait offers a dismissible wider-view prompt, without preventing account/settings/task use. Full screen is requested only by a player click. Landscape locking is attempted only after full-screen entry and only if supported; failures provide a visible manual-rotation fallback. Exit/sign-out releases orientation locking. Safe-area CSS, dynamic viewport sizing, at least 44px touch controls, visible focus, readable drawer scrolling and reduced-motion handling are included. Resizing does not submit or reconstruct a furnishing draft. No orientation operation is a payment or gameplay command.

Low/data saver now keeps the Canvas 2D world visible and does not import Three.js. Medium/high lazily use 3D when available; failure keeps the 2D scene and accessible apps. Switching to low destroys the 3D scene, and a late import completion/failure cannot restore a signed-out scene. Both renderers resize to the available world area. Canvas failure leaves the accessible Map/phone controls available. No game assets from other publishers were copied.

## Evidence and open gates

`test/game-ui.test.ts` uses the real loopback HTTP service with disposable in-memory development citizens. It verifies panel/focus transitions, held input cancellation, lost movement and payment receipt recovery, single charging, confirmed school/home/wardrobe behaviour, unchanged unsent furniture drafts, full-screen rejection/orientation fallback and private HUD clearing after identity denial. Controller checks prove the low path avoids WebGL loading and signed-out late failures cannot repaint. Existing Canvas seat/expiry, private-door/parking, account, NPC and multiplayer takeover/reconnect tests remain relevant.

The complete suite passes 209 tests (149.0 s), followed by the final display/recovery checks; strict TypeScript, changed-script syntax and diff checks pass. These are HTTP/DOM, numerical and API-boundary checks. The cloud browser rejected local HTML navigation under its protocol policy; no alternate protocol, local-server exposure, injected browser code or security bypass was used. Hosted sign-in and asset/readiness checks do not establish authenticated production citizen gameplay. Actual GPU rendering, physical touch holding, phone/browser rotation, display cutouts, text enlargement and real-device performance remain unverified. SMTP/first player signup, direct steering/braking/vehicle collisions, nationwide geometry, production art and the remaining Bible systems remain open. R065/R066 stay In progress.
