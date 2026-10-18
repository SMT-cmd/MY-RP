# Local physical gameplay QA, 18 October 2026

These captures use the actual Three.js client in headless Chromium with software WebGL, a loopback-only server and an isolated in-memory citizen. They are not live production, hardware GPU or native phone evidence. No hosted account, balance or data was used or changed.

Reproduce with `MYRP_QA_OUTPUT=docs/qa/2026-10-18 npm run test:browser` after installing Chromium and the pinned npm dependencies. Normal runs write to ignored `.test-data/physical-world-qa` instead. `CHROMIUM_PATH` overrides the executable.

| Capture | What it demonstrates |
| --- | --- |
| local-third-person.png | Follow camera and original tailored garment surfaces |
| local-aerial.png | Overview camera mode |
| local-seated.png | Sofa use during the timed activity |
| local-washing.png | Sink contact, articulated hands and wash effects |
| local-toilet.png | Clothed toilet activity |
| local-shower.png | Frosted shower activity |
| local-showroom.png | Physical counter purchase and collection |
| local-television.png | Placed TV and saved design progression, viewed from behind |
| local-television-front.png | Powered TV from a separate isolated purchase fixture |
| local-mobile.png | 390 × 844 touch-emulated controls and layout |

The runner verifies four completed home sessions, exactly 25 design XP, saved TV power after reload, visible touch controls and bounded dock buttons. It records script errors and failed non-API assets. Fixture selection uses normal client selection events before clicking action controls; full 3D ray picking and native touch feel remain to be accepted. See `docs/releases/2026-10-18-physical-gameplay-local.json` for final results and the implementation contract for limitations.

`npm run test:browser:tv` separately verifies that the city programme changes frames and captures the TV from its front using a local domain-purchased item. This extra fixture does not earn showroom XP.
