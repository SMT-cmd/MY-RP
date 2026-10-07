# Project instructions

Read docs/project-status.md, docs/specification/BIBLE.md and the working registers before changing the game. The Bible is the product baseline. Keep requirement IDs stable and record implementation evidence honestly.

All specified systems belong to the prelaunch build scope. Work in dependency order. Public activation through the admin dashboard is separate from implementation completion. Do not replace working systems with placeholders or describe an interface as a completed subsystem.

Money, credentials, ownership and eligibility are server authoritative. Authenticate the actor independently of command payloads. Keep journals balanced, make commands idempotent, use server time, and preserve failure recovery. Never put production secrets in source control.

Run npm test for domain changes. Add regression coverage for money, persistence, eligibility and permission failures. Update docs/project-status.md and docs/CHANGELOG.md after each meaningful implementation milestone. Mark a full requirement complete only when its full Bible contract, integration and acceptance evidence pass.

The current file store and loopback HTTP service are development tools. Production requires the approved PostgreSQL/Supabase design, production identity, migrations and provider/load verification. Do not expose this development server publicly.
