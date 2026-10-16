# Adult character assets and lifecycle

16 October 2026 component. Original publisher: [Quaternius, Universal Base Characters](https://quaternius.itch.io/universal-base-characters). The free Standard archive was reviewed under CC0 1.0; its original licence is retained at `web/assets/characters/LICENSE-Quaternius.txt`. Only its adult Superhero male/female meshes, skinning and brown eye texture are used. The paid Source package, teen meshes, franchise assets and third-party application code are not included.

The importer `tools/assets/import-quaternius.py` accepts the reviewed archive or a strictly hash-checked source folder. Official archive: 128,968,391 bytes, SHA-256 `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40`. After transient workspace loss, six CC0 source files were recovered from the public data mirror [NafisRayan/Animate-Rigged-Humanoid-No-Blender](https://github.com/NafisRayan/Animate-Rigged-Humanoid-No-Blender/tree/5821923af517ac5fdc82505faa92a0d575fc1b1a), pinned to that commit. Every member's Git blob hash is checked by the importer. The licence's line endings are restored. Rebuilt GLBs exactly match the previously generated official-archive output hashes below. No mirror program or executable was run.

| Local file | Bytes | SHA-256 |
|---|---:|---|
| adult-male.glb | 741608 | f12483c4b9e06743a8aedb74985b7820a0150b2c3f918bc2eac9819e7036c0e3 |
| adult-female.glb | 1012840 | 5e07a0d2cd8700689b29bc391d10c2b8566fe1ed22b9a1fe968027727982e21a |
| eyes-brown.png | 35958 | d08e3356a83211bc6ca21fe3a8e39f4b5c1a3b8f85457fc2c0fb57be09935025 |

The two models total 1,754,448 bytes, with one shared 35,958-byte eye texture. GLBs have no external image or buffer URI. Pinned Three.js loaders and utilities are served locally through the explicit HTTP asset allowlist and hashed import map. The low/data saver view does not import the 3D engine or fetch these models.

MY-RP supplies material groups for four clothing styles, colour palettes, garment allowance, collars, buttons, tunic hem and existing original hairstyles. This is a fitted palette-based wardrobe component, not a full garment simulation or a claim of photorealism. Five frame choices retain saved profile IDs; the two curved frames use the female base. Clothing remains free and confers no gameplay advantage.

Each rendered citizen owns its cloned skeleton, geometry and clothing materials. Shared templates and the eye texture belong to the engine library. Destroy aborts fetches, fences late completions and releases actor resources before library resources. A loading/failed model retains the procedural adult. Existing confirmed movement drives the imported bones through body-space joint targeting, preserving nonuniform frame scale, grounded feet and the shared seat height. No downloaded animation clip or client-authoritative movement was introduced.

`test/authored-characters.test.ts` checks all five frames and four outfits, foot/seat contact, independent skeletons, human bounds and late-completion disposal. Scene tests cover local dependencies and exact binary delivery. These numerical and lifecycle checks do not establish GPU appearance, phone FPS, cultural review or device animation acceptance. Those remain D24/D28 gates.
