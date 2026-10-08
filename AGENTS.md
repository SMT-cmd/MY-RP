# Project instructions

Latest user direction (8 October): push all completed build work to GitHub, then resume Supabase login. Full-game requirements remain open; do not label the build complete or show further preview iterations. Render main still auto-deploys commits, so use build/main-game-2026-10-08 for source publication until its deployment settings are safely changed. Implement adult character presentation and movement, purchasable furniture with placement/customisation, and vehicle parking. Database setup and environment configuration are now authorised on the selected MY-RP Development Supabase project and existing main MY-RP Render service in Alonge's workspace under KING SMT. Keep credentials out of source and output. Do not present or launch the unfinished game as complete; full-game deployment/activation remains held until the full build is complete. Local commits and verified hosted migrations/configuration are allowed. Leave the isolated demo unchanged.

Read docs/project-status.md, docs/specification/BIBLE.md and the working registers before changing the game. The Bible is the product baseline. Keep requirement IDs stable and record implementation evidence honestly.

All specified systems belong to the prelaunch build scope. Work in dependency order. Public activation through the admin dashboard is separate from implementation completion. Do not replace working systems with placeholders or describe an interface as a completed subsystem.

Money, credentials, ownership and eligibility are server authoritative. Authenticate the actor independently of command payloads. Keep journals balanced, make commands idempotent, use server time, and preserve failure recovery. Never put production secrets in source control.

Run npm test for domain changes. Add regression coverage for money, persistence, eligibility and permission failures. Update docs/project-status.md and docs/CHANGELOG.md after each meaningful implementation milestone. Mark a full requirement complete only when its full Bible contract, integration and acceptance evidence pass.

The current file store and loopback HTTP service are development tools. Production requires the approved PostgreSQL/Supabase design, production identity, migrations and provider/load verification. Do not expose this development server publicly.

The demo/ visual prototype is an independent client-only sample with a read-only static-asset host. Keep its local sample wallet clearly labelled and separate from authoritative player state. Never wire the public preview host to the development key, world file, private data or production database.
