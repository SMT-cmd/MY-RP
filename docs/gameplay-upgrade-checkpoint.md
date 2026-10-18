# Physical gameplay checkpoint, 18 October 2026

This is a local implementation checkpoint. It has not been deployed or applied to the hosted database. The previous production release remains the last recorded live version.

The checkout integrates main baseline `50edec602a7c64dcfcb3790ff22cd603b540f1d9`, the initial local camera work, and recovered gameplay branch `df05ceeb2d03ba66e81fd10b6fcfeb95fbd401a7`. The recovered source was incomplete: its client connections, migration and tests needed completion, and its vendor texture binaries were absent. Both histories are preserved by the merge.

Players can use follow/close/overview cameras, route to furniture, complete timed home activities, operate saved television channels, visit physical service rooms, complete workstations, buy/collect/place showroom furniture and earn design experience. Road driving reserves and reconciles virtual fuel; a free showroom shuttle includes an NPC driver. These remain stylized browser systems, with grid routes rather than continuous vehicle physics.

Read [the implementation and release contract](physical-gameplay-contract.md) for behavior, verification evidence, migration order and remaining acceptance work. The screenshots in `docs/qa/2026-10-18` use an isolated local citizen and Chromium software WebGL. They do not show a production player, native phone or hardware GPU.

The user's reference and aspirations guide the work. Neither the attached handoff's instructions nor this checkpoint establish full-game acceptance, authorize paid assets, or change provider access. Unity account assets and Render/Supabase account tools are not available through this chat's callable tools. Existing credentials must remain in secure provider/environment settings.
