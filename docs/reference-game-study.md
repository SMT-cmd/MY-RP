# Reference games and main-build quality targets

Research checkpoint: 8 October 2026. Owner direction: a Nigerian life simulation with the human readability, homes and everyday interaction of The Sims and My Life in New York, and the connected city/vehicle presence of OneState RP and MadOut. This is a design reference, not a claim that their graphics or features are already matched. The Bible remains the scope baseline.

## Evidence and application

| Reference | Source evidence | Application to MY-RP |
| --- | --- | --- |
| The Sims / Sims 1 | EA's Legacy controls separate live, build and buy modes, support camera controls, and expose interaction cancellation. | Make living and decorating understandable modes; keep navigation, cancellation and the current citizen readable. Multiplayer commitments still use server time and cannot be undone as single-player purchases can. |
| The Sims 2 | EA's controls document character rotation/zoom, object rotation, room construction, floor changes, wall cutaways and selecting interactions on other Sims. | Inspect adult characters from all directions; provide useful furniture placement and room editing; add consented social interaction and distinct floors. Existing quarter-turn placement and cutaways are components, not completion of the full reference. |
| The Sims 3 | EA's Deluxe manual describes neighbourhood exploration, personality/wardrobe choices, coordinated material styles and autonomy settings. | Connect streets and services; distinguish personality from appearance; allow coherent furnishings and finishes. NPC autonomy needs bounded schedules and real needs, not merely random messages. Player actions remain intentional. |
| The Sims 4 | EA's console manual documents room/category furniture catalogues, household inventory, room construction and the requirement for doors and clear walkways. | Keep bought objects after moving, place them in storage, prevent blocked exits and distinguish decoration from ownership. Higher floors, extensions, varied objects and household use remain open. |
| My Life in New York | Gameloft confirms the title in its Classics collection. Artist Marie Pierre Rochel describes creating five levels and sprites and publishes game screenshots. | Preserve the owner's desired feeling of a readable person in authored rooms and a city with everyday choices. These sources verify the title/art contribution; they do not establish a complete gameplay or customization catalogue. |
| Lagos Life | lagoslife.app identifies a fictional Nigerian life simulation spanning employment, homes, transport, relationships and institutions. A separate lagoslife.com.ng product also calls itself Lagos Life. | Treat the .app version as the stronger match to the earlier Eliy reference, without claiming the similarly named sites are the same game. The user's exact build/version remains unverified; specific house-entry behaviour has not been independently playtested. |
| OneState RP | The publisher describes a modern Los Angeles online roleplay world with character/backstory choices. Its store listing describes jobs, businesses, real estate and vehicles. | Aim for believable street scale, human presentation, vehicles, proximity and social continuity. Publisher server-capacity claims are not MY-RP benchmarks. |
| MadOut | The official site presents an open city, vehicles, character skins and roleplay. | Reference vehicle presence, city continuity and varied character presentation. This does not add unrestricted combat or copy its rules into our Bible. |

The sources suggest useful interaction patterns, but do not tell us how those studios implemented their engines. The requirements below are our engineering/design decisions. No proprietary models, sprites, maps, animations or brand assets were copied into the game.

## Measurable character and interaction gates

1. Keep adults at human scale and visibly distinct from furniture. Examine neutral/front/back/side views, all approved skin tones, clothing and hairstyles at ordinary phone zoom. Production facial modelling, clothing deformation and cultural/art review remain required.
2. Drive gait phase from actual confirmed travel distance. At steady straight motion, a planted foot stays at floor height and does not drift while the body advances. Test 30/60 fps, direction changes, stops, slow responses and reduced motion. The implemented two-link leg solver now has numerical contact tests across all three frames.
3. Use physical furnishing contacts. Seat pelvis height follows the cushion; feet reach the floor; lying bodies fit the bed after each quarter turn; standing interactions face the actual object. Do not change the server's walking tile to make an animation work. Entry/exit transitions, cloth, hand-contact refinement and full interaction sequencing remain open.
4. Each interactable object needs a useful intention, clear approach point, duration, cancellation behaviour and a server result. A wash/read pose alone is not a hygiene/skill simulation. Rest and protective meals currently connect to existing authoritative needs/assistance; richer bathing, cooking, eating, entertainment and household activity are still required.
5. A purchased/rented residence must have its own accessible address and door. Owner/tenant permission, title transfer, moving, stored furniture and parking must survive reconnect/retry. The finite regional home and constructed-land plots now have distinct doors. Other facades remain scenery; nationwide property lots and consented guests remain open.
6. The camera must pan across connected streets, zoom without losing the character, rotate for directional understanding and return to the player. Closed roads/buildings must remain consistent with authoritative pathfinding. A generic representative neighbourhood is not a nationwide finished city.

## Art and performance acceptance

The original procedural art is an implementation scaffold with usable proportions and model variety. It has not passed production visual acceptance. Higher-quality authored human meshes, clothing, facial variations, hair, interiors and vehicles must preserve these domain contracts. Asset acquisition requires recorded provenance and redistribution permission, a known scale/coordinate convention, contact anchors and low/medium/high variants. No additional paid asset service or runtime AI dependency is required for the existing build.

A proposed asset path is glTF with named joints and clips, locally served versioned assets, and a validated rig/anchor contract. Three.js officially supports skinned meshes, glTF loading and animation mixing. Selecting that path does not mean a production asset catalogue has been authored or accepted. Geometry checks cannot prove GPU appearance, frame rate, mobile readability or perceived realism.

Before accepting the art gate, capture the actual main game on the approved device matrix, inspect all directions and object contacts, measure frame time/memory/loading, test optional asset failures and verify low-data text controls. Publish no new preview or main release before the owner's full-build hold is lifted through the completion gates.

## Sources

- [EA: The Sims Legacy controls](https://help.ea.com/en/articles/the-sims/the-sims-legacy-collection/the-sims-legacy-controls/)
- [EA: The Sims 2 Legacy controls](https://help.ea.com/da/articles/the-sims/the-sims-2-legacy-collection/the-sims-2-legacy-controls/)
- [EA: The Sims 3 Deluxe manual](https://eaassets-a.akamaihd.net/eahelp/manuals/the-sims-3-deluxe-manual_PC.pdf)
- [EA: The Sims 4 console manual](https://eaassets-a.akamaihd.net/eahelp/manuals/the-sims-4-xbox-one-na.pdf)
- [Gameloft: Classics title catalogue](https://www.gameloft.com/newsroom/happy-20th-anniversary-gameloft-reaches-milestone-4513)
- [Artist: My Life in New York contribution and screenshots](https://marypeter13.blogspot.com/2011/11/my-life-in-new-york-game-screenshots.html)
- [Lagos Life .app: product identity and fictional scope](https://lagoslife.app/disclaimer)
- [Lagos Life .com.ng: separate product description](https://lagoslife.com.ng/blog/what-is-lagos-life)
- [OneState: publisher game page](https://onestate.com/game)
- [OneState: publisher store listing](https://play.google.com/store/apps/details?hl=en&id=com.Chillgaming.oneState)
- [MadOut: official site](https://www.madoutgames.com/)
- [Three.js: GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js: AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
- [Three.js: SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html)
