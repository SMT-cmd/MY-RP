# Reference game access and controls

14 October 2026. The owner requested accounts and direct inspection of Lagos Life, My Life in New York, New York Nights, The Sims and related city simulations. The owner subsequently completed Lagos Life signup and directed that other games be studied through public guidance, with no game downloads. This records available access, observed UI and limits. It is not whole-game acceptance or proof of matched graphics. The earlier [reference study](reference-game-study.md) and [12 October browser inspection](lagos-life-interface-study.md) remain historical evidence.

## Access checked

| Game | Verified route | Result in this environment |
| --- | --- | --- |
| Lagos Life | https://lagoslife.app/ | Owner signup confirmed; character setup, home, catalogue, phone/guide, free travel and dealership activity inspected. A game-currency chair purchase succeeded. The scene still reports a 3D-start failure. |
| Naija Life, a separate product | https://lagoslife.com.ng/play/ redirects to https://naijalifegame.ng/play/ | Offline guest reached a starter home, floor plan, phone and Cars menu. No server account was created. The character preview/Explore renderer reported a WebGL-context error. |
| The Sims 4 | EA's official base-game page, FAQ and controls guidance | Free base game, installed PC/Mac/console software. No game installed or downloaded; the unneeded EA signup tab was closed after the owner's no-download direction. |
| The Sims 3 | EA's official product page | Paid installed PC/Mac game; an account alone does not supply a game licence. No purchase was made. |
| The Sims 1 / 2 Legacy | Listed on EA's Sims product pages | Paid PC products share the EA account route. No licence acquired or native play verified. |
| My Life in New York | Gameloft's Classics announcement lists it in the Android collection | The publisher's old download and press-kit links returned 404. Current official install availability was not verified; no game binary was downloaded. |
| New York Nights / New York Nights 2 | Historic publisher route; a third-party browser emulator for the sequel | Old publisher game page redirects to the current general catalogue. The emulator stayed blank; its alternate-engine interaction stalled, then its confirmation was dismissed and the tab closed. No playable session was verified. |
| “New York Life” | Ambiguous title | No matching Gameloft life-simulation product under this exact title was verified. Do not substitute an unrelated service or game. |
| OneState RP | Official site, getting-started guide and mobile listings | Publisher FAQ says iOS/Android and guest play. Published gameplay images inspected; native gameplay and driving physics not tested. |
| MadOut 2 | Official publisher and Google Play listing | Published walking/car-entry and driving screenshots inspected. Listing includes Android and Windows availability. No native client installed or gameplay session verified. |

The owner completed Lagos Life signup themselves. No credentials, age, terms acceptance or CAPTCHA answer was invented. No other account is needed for the current public-reference study. No game was installed or downloaded. Webstore authorization for a mobile game is not a browser-playable game client.

## Direct observations

Lagos Life .app keeps the world as the principal surface, with compact needs/status and Home/Buy/Map/Phone controls. Owner signup led to appearance, two traits, ambition, random starting circumstances and home selection. A Yaba residence was selected. The guide associates everyday needs with home objects. Keyboard help documents furniture movement, rotation, placement/cancellation and venue shortcuts; it does not establish WASD walking.

Buy mode exposes category/footprint/price cards and a selected-object toolbar with movement, rotation, placement and cancellation. Rotating and placing one cheap chair produced a purchase notice and a 500-unit game-wallet deduction. Phone/guide and the Cars app opened. Free travel reached the dealership; its test-drive hotspot exposed a seven-second activity. It ran, cleared and increased Fun. Showroom/garage menus opened; no vehicle was bought. The scene continued reporting failed 3D startup, so avatar movement, room geometry, visual placement, parking and steering physics remain unverified. Public counters were not validated. No real payment or player message was sent.

Naija Life's guest setup accepted a fictional local character, Reference Visitor. The starter home screen exposes Live/Decorate and Explore/Floor plan controls, a house Shop and bottom navigation for Home, City, Sim, Lagos and Phone. Its visible instructions say floor taps move the person and dragging changes the view, but animation and camera movement could not be judged in the failed 3D view. The floor-plan mode actually rendered a tile grid and selectable furniture icons; selecting the bed highlighted it. The phone opened a grid of jobs, contacts, messaging, housing, vehicles, banking, family, government, health and settings functions. Cars opened a travel-mode list and a notice tying parking capacity to the residence. These observed menus do not prove a driveable vehicle or fully simulated object use. The home page also needs considerable scrolling on this desktop viewport, so it is not approval of MY-RP's existing scrolling dashboard.

OneState's published hospital screenshot shows a large adult viewed from behind, a minimap in one corner, compact status/menu controls and physical service markers near an entrance. Its guide directs recruits to those markers before training, and provides activities through a separate menu. Official support describes touch/keyboard input and vehicle-location recovery through garage/map markers. Still images do not measure gait, camera response, latency or handling.

MadOut's publisher-supplied screenshots show a landscape road view, adult/car scale, a following camera behind a vehicle, a minimap, left-side steering arrows and right-side pedal/action icons. Treat these as published presentation references, not independently measured game physics.

## Documented controls

EA's Sims 3 manual separates character commands from camera movement: WASD/arrows move the camera, while destination selection directs the Sim. It documents following/recentring the selected person, map destinations, action queues, cutaway walls and separate Live/Buy/Build modes. We must not describe those keys as direct Sim locomotion based on that manual. EA's Sims 4 console manual likewise documents object categories, household inventory, clear door/walkway requirements, follow-camera controls and current/future actions.

EA's specific Sims 4 rotation guidance documents selection before placement, stepped rotation and mouse-based free rotation. The official FAQ and player-help hub were checked. MadOut's current publisher listing also includes its 21.0 feature-update notice. Published features and tutorials are reference evidence, not native playtesting or proof of engine behaviour.

EA's August 2026 FreePlay furniture-store FAQ describes a limited rollout, not availability to every player: Furnish/Construct areas, grouped colour variants, owned-item filtering, search and collapsible store controls. Camera gestures remain usable while shopping. These are useful catalogue/layout ideas; they do not prove our mature furniture catalogue is finished.

EA's official 20:08 Sims 4 walkthrough page was selected. Its player showed a loading spinner without usable playback controls. It was located, not watched; no moving-video evidence is claimed.

## MY-RP implementation targets

The owner endorses landscape play. The Bible now specifies a dismissible rotate prompt, player-initiated full screen, optional orientation locking, portrait access to essential menus and safe resize behaviour. MDN documents limited orientation-lock support and typical mobile/full-screen requirements, so physical phone rotation cannot be forced universally.

Implement a full-screen world with readable adults and compact HUD/phone drawers. Retain tap-to-walk and object approach, add clear touch controls, and distinguish living from vehicle control layouts. A future vehicle milestone must verify steering, acceleration, braking, reversing, collisions, fuel, parking and ownership across actual devices and network recovery. No research result makes these implemented or changes a requirement to Complete. No proprietary game art or code was copied into MY-RP.

## Primary sources

- [Lagos Life terms and official service identity](https://lagoslife.app/terms)
- [Sims 4 installation instructions](https://help.ea.com/en/articles/the-sims/the-sims-4/base-game-install/)
- [Sims 4 FAQ](https://www.ea.com/games/the-sims/the-sims-4/faq)
- [Sims 4 rotation controls](https://help.ea.com/en/articles/the-sims/the-sims-4/how-to-rotate-sims-4/)
- [Sims 3 official product](https://www.ea.com/games/the-sims/the-sims-3)
- [Sims 3 Deluxe manual](https://eaassets-a.akamaihd.net/eahelp/manuals/the-sims-3-deluxe-manual_PC.pdf)
- [Sims 4 console manual](https://eaassets-a.akamaihd.net/eahelp/manuals/the-sims-4-xbox-one-na.pdf)
- [FreePlay Home Store FAQ, limited rollout](https://www.ea.com/games/the-sims/the-sims-freeplay/news/build-mode-and-home-store-refresh-faq)
- [Sims 4 official walkthrough, playback unverified](https://www.ea.com/en-gb/games/the-sims/the-sims-4/media-hub/media/the-sims-4-gameplay-walkthrough)
- [Gameloft Classics announcement and title list](https://www.gameloft.com/newsroom/happy-20th-anniversary-gameloft-reaches-milestone-4513)
- [OneState official platform/guest FAQ](https://onestate.com/game)
- [OneState getting-started guide, observed in browser](https://onestate.com/guides/getting-started-in-onestate)
- [OneState input support](https://chillbase.helpshift.com/hc/en/3-onestate/faq/39-is-controller-support-available/?p=web)
- [OneState vehicle recovery](https://chillbase.helpshift.com/hc/en/3-onestate/faq/47-my-car-is-missing-why-can-t-i-find-my-vehicle/?p=android)
- [MadOut publisher](https://www.madoutgames.com/)
- [MadOut publisher listing](https://play.google.com/store/apps/details?hl=en&id=com.MadOut.BIG&pli=1)
- [MDN orientation locking](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock)
