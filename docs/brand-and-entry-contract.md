# MY RP identity, entry and account retry

16 October 2026. The visible product name is **MY RP**, expanded as **My Roleplay**. The existing Nigerian life/political Bible remains the product contract; this identity update does not change game authority, geography or completeness. The owner requested removal of the prior green/white identity and a more cinematic game entry.

## Visual assets and presentation

The selected generated identity is `web/assets/brand/my-rp-logo-night.png`. A midnight/cobalt/amber palette, cinematic city key art, account card, separate authentication tabs, numbered account/citizen/city steps, confirmation guidance and truthful indeterminate loading replace the former generic entry page. The header, page title, installed-app name, offline page, favicon and HUD use MY RP. Existing code-native app icons use the same route motif and palette; the generated wordmark is used in the main header and loading view.

Original AI-generated concept assets cover city/road/characters, home interior, workspace/office, district layout and sedan. Exact prompts, builtin generator mode, source paths and QA are in `docs/art/*generation.json`. They were created with the built-in image generator, not scraped from a competitor. The first transparent logo was rejected for edge artifacts; it is preserved as an exploration and is not served by the app. The selected opaque alternate is used. No trademark-clearance or in-engine art-acceptance claim is made.

`tools/assets/encode-web-art.py` performs lossless file-format conversion without altering pixels. The WebP copies are decoded-pixel identical to their PNG originals; sizes/hashes are in `docs/art/web-encodings.json`. Artwork is served through explicit public asset routes. The entry hero and selected logo total 2,501,512 encoded bytes before code and other resources. Gallery images load lazily; data saver omits automatic large entry-background loading and offers an explicit 1.9 MB artwork control without changing the saved gameplay preference. Public worker updates keep private APIs and credentials uncached and never reload an uncertain command.

`/world-art.html` is a public visual-concept gallery. It explicitly identifies concept art and distinguishes the district illustration from the actual navigable map. Generated cars, homes and offices are visual targets; they do not implement vehicle physics or replace the current game scene meshes. No paid graphics tool or Unity project was provisioned.

## Account limit diagnosis

Read-only provider log aggregation for 16 October 14:00–14:49 UTC found one `/signup` 429 with `over_email_send_rate_limit`, one signup success, two token successes and successful user validations. No email, IP address, account ID, token or raw log message was retrieved. This establishes an email-delivery signup limit in that window, not a password-login failure. A fresh secure password sign-in subsequently reached the existing saved citizen and Ready game state in the cloud browser.

The prior gateway mapped all provider 429 responses to the same vague “too many account attempts” notice. It now distinguishes a signup-email limit, preserves a bounded Retry-After duration, sends a safe error code/scope and suppresses provider text. Sign-in and account creation have separate UI modes and submit controls. The active action is the first submit button, including Enter-key submission. Creation confirmation returns the user to sign-in; a confirmation email is not treated as a session.

Cooldowns are scoped to the attempted operation. A signup-email cooldown never disables password sign-in. The browser counts down, prevents duplicate submits and does not retry authentication automatically. It stores only bounded cooldown timestamps after a limit response, never credentials or tokens. Authentication/session authority and the provider's actual limits remain unchanged. The countdown indicates a retry opportunity, not a guarantee that an email quota has refilled. Public delivery still requires a suitable email sender/provider; this change does not bypass verification or increase email quotas.

## Loading and failure behavior

Configuration, authentication and first scene preparation have actual pending states rather than invented percentages or delays. Overlapping jobs keep the loading view until each finishes; first Three.js paint or a completed Canvas fallback releases scene preparation. Configuration failure has an explicit reconnect control. Existing receipt recovery, live connection leases, input release, owned purchases and pending-command storage remain authoritative. No automatic signup, hidden credential replay, fabricated account, confirmation bypass or environment-secret change is included.

The signed-in reference inspection in the cloud browser displayed the actual furnished home and a Ready connection using the Canvas fallback. Browser developer logs explicitly report WebGL context creation disabled in that environment. Production-device GPU rendering, phone FPS and native orientation acceptance remain open; screenshots of concepts do not satisfy those gates. The secure sign-in succeeded before the new entry release, and post-release entry verification is recorded separately.

## References and evidence

Provider limits: https://supabase.com/docs/guides/auth/rate-limits (checked 16 October). Supabase changelog index was fetched and relevant auth/security changes reviewed. Unity 6.6 browser guidance: https://docs.unity3d.com/6000.6/Documentation/Manual/webgl-browsercompatibility.html. The existing Three.js browser client can consume the new branding/assets; adopting Unity would be a separate client/asset-pipeline migration and device performance decision.

`test/account-retry.test.ts` verifies provider error suppression/Retry-After, scoped email cooldown, duplicate prevention, password login, token/credential storage boundaries, active submit order, configuration recovery, overlapping loading jobs, confirmation and data saver. Existing account, world-first interface, PWA, movement, receipt and SQL suites remain required. Project status and the release record contain exact publication/deployment results and remaining full-game gates.
