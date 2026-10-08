# MY RP playable visual preview

An isolated single-player visual prototype of the Bible's world/HUD/phone direction (R065, R066, R067; D24 remains proposed). The six original building footprints and entrances mirror the current development game. The preview extends that block to a connected 66×42 neighbourhood with residential streets and 18 surrounding homes. All 37 region/capital labels remain available. This is representative art, not a completed regional map catalogue; the surrounding blocks are preview geography.

Open `demo/preview.html` directly in a browser, or run:

```sh
node demo/build.mjs
node demo/server.mjs
```

Browse `http://localhost:3100`. Move with WASD/arrows/touch controls, choose a building label to walk to its entrance, interact with E, and open the phone with P. The larger character faces front, back, left and right, with walking animation. Drag the world or scroll over it to pan the camera; use +/− to zoom and Find my character to follow again. Scrolling outside the world uses normal page scrolling.

Enter the starter home to walk through a furnished cutaway interior. Bed, pantry, sofa, desk, sink and wardrobe have collision footprints shared with the main-game home. Click furniture, or choose it from Objects, to walk beside it; then use E. The bed and pantry use the sample welcome flow. Other furnishings have descriptive interactions, not a complete Sims-style needs, animation, furnishing or ownership simulation. Step outside returns to the original entrance; reloading inside preserves the room position. The first-day guide is available from Show first-day guide.

The guide's five-step path exercises shelter/meal, the wallet, a first-day lesson, and a three-choice starter shift. Map, clinic, market, all-region preview labels, graphics preferences, reduced motion, and reset are available.

Everything is a client-only sample saved under `my-rp-visual-preview-v1` in browser local storage. Money is labelled demo NGN. Each example action changes the sample once. No game credentials, live account, qualification, server-side payment, database, Supabase, external art/font/music, or multiplayer connection is used. Browser storage may be unavailable; the preview then continues in memory. The full game remains unfinished and its server-authoritative economy is separate.

The public preview server serves only the built HTML, SVG and liveness response. It does not import or expose the development server, file-based world, private lessons, source files or database configuration. Its only runtime setting is Render's `PORT`; it binds to `0.0.0.0`. It uses content hashes for inline script/style CSP and disables unnecessary browser permissions. `/api/commands` does not exist.

## Render configuration

Use the new KING SMT account, after its workspace selection is confirmed. Deploy the isolated branch `demo/visual-preview-2026-10-08` of `https://github.com/SMT-cmd/MY-RP`, with **free** plan, Node runtime, Frankfurt region, build `node demo/build.mjs`, start `node demo/server.mjs`, health path `/healthz`, and automatic deploy disabled. A prepared Blueprint is in `demo/render.yaml`. No paid resource, attached database, scheduler, monitor or keep-alive script is needed for this visual demo. This does not authorize publishing unfinished simulator code to main or launching the full game.

The demo-only publication contains the `demo/` files and existing LICENSE, without the unpushed full-game changes. Update its README and source as a separate preview iteration. A Render static site could serve the same built HTML if selected later; no API is necessary.
