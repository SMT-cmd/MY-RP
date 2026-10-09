# Project instructions

9 October runtime update: eleven hosted migrations now include a restricted NOINHERIT runtime login. DATABASE_URL is saved and masked; automatic deployment is off; npm/PostgreSQL/readiness settings are saved. The Render environment-update connector ALWAYS triggers a deploy even when automatic deployment is off: its accidental build was canceled and verified canceled. Use dashboard Save Changes only for held configuration. Never repeat that connector under the no-deploy hold. Read the latest infrastructure checkpoint. Direct driver/TLS, provider signup and full-game gates remain open.

9 October update: the owner instructed “Finish it” after review of the four pending development migrations. All four exact scripts have now been applied and verified; hosted history has ten entries and eighteen forced-RLS simulator tables. Read docs/hosted-schema-verification.md. The earlier automatic approval rejection is resolved for this reviewed migration package; do not ask to approve it again or replay it. Continue remaining build/configuration work, preserve the no-deployment hold and publish completed source on build/main-game-2026-10-08.

Latest user direction (8 October): push all completed build work to GitHub, then resume Supabase login. Full-game requirements remain open; do not label the build complete or show further preview iterations. Render main still auto-deploys commits, so use build/main-game-2026-10-08 for source publication until its deployment settings are safely changed. Implement adult character presentation and movement, purchasable furniture with placement/customisation, and vehicle parking. Database setup and environment configuration are now authorised on the selected MY-RP Development Supabase project and existing main MY-RP Render service in Alonge's workspace under KING SMT. Keep credentials out of source and output. Do not present or launch the unfinished game as complete; full-game deployment/activation remains held until the full build is complete. Local commits and verified hosted migrations/configuration are allowed. Leave the isolated demo unchanged.

Read docs/project-status.md, docs/specification/BIBLE.md and the working registers before changing the game. The Bible is the product baseline. Keep requirement IDs stable and record implementation evidence honestly.

All specified systems belong to the prelaunch build scope. Work in dependency order. Public activation through the admin dashboard is separate from implementation completion. Do not replace working systems with placeholders or describe an interface as a completed subsystem.

Money, credentials, ownership and eligibility are server authoritative. Authenticate the actor independently of command payloads. Keep journals balanced, make commands idempotent, use server time, and preserve failure recovery. Never put production secrets in source control.

Run npm test for domain changes. Add regression coverage for money, persistence, eligibility and permission failures. Update docs/project-status.md and docs/CHANGELOG.md after each meaningful implementation milestone. Mark a full requirement complete only when its full Bible contract, integration and acceptance evidence pass.

The current file store and loopback HTTP service are development tools. Production requires the approved PostgreSQL/Supabase design, production identity, migrations and provider/load verification. Do not expose this development server publicly.

The demo/ visual prototype is an independent client-only sample with a read-only static-asset host. Keep its local sample wallet clearly labelled and separate from authoritative player state. Never wire the public preview host to the development key, world file, private data or production database.
