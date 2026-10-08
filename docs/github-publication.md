# Verified GitHub build publication

Verified 8 October 2026. Source publication only; the full game and hosted runtime are not complete.

- Repository: https://github.com/SMT-cmd/MY-RP
- Build branch: https://github.com/SMT-cmd/MY-RP/tree/build/main-game-2026-10-08
- Published code snapshot: `4d1a4f5e15285f698f837219ea39f4e35a5e48a5`
- Local source checkpoint: `56c5fd3629c1b15f600134067ac0daf14d825006`
- Exact shared tree: `758913ff0c918c73c6a6d94c780fe8acb01f2480`
- All 193 tracked files match by Git blob SHA and file mode, including binary assets.
- A fresh Git fetch and `git diff --exit-code HEAD origin/build/main-game-2026-10-08` returned zero differences before this documentation update.
- Code validation: 192 tests, strict TypeScript and changed browser JavaScript checks passed at this checkpoint. Documentation updates do not change application code.

The terminal lacked GitHub authentication, so the connected GitHub app published an exact source snapshot. The snapshot is parented to existing remote main; it does not preserve the separate 25 local commit hashes. Local history remains intact. No force push was used. Remote main remains `83fabade7d086b99492b634139fb0c499f29f873`; the independent demo remains `28c8437c89fdedb866e1cc3bfc0630d71574246b`. Render still watches main, so this branch publication does not trigger its commit deployment.

## Supabase access and remaining setup

The Supabase connector can access MY-RP Development (`ogkuirfuwxqwstyjijln`), status ACTIVE_HEALTHY. A successful dashboard sign-in was observed earlier; a newly opened dashboard tab later returned to sign-in. Connector authentication remains available independently of that browser session.

Read-only verification confirms six applied migrations through authoritative_client_sessions, fifteen simulator tables with enabled and forced RLS, no schema usage for anon/authenticated, and no security-advisor findings. No hosted data or schema was changed during publication.

Four additive migrations remain pending, in this order:

| Local migration | Change | SHA-256 |
|---|---|---|
| `20261008113540_scoped_staff_authority.sql` | Private staff grant/proposal/audit tables and invoker reconciliation | `d507c87f7cfda0aaf12a8edd6ffb2dc7348b7c425fa1cba01a3acbe79452c5fd` |
| `20261008153709_consented_home_visits.sql` | Private invitation consent and home permission reconciliation | `f39352eb6d9462d34f4dcb7ebebbf88cba9e5163d1eaf6ca18a959d5790cb143` |
| `20261008161823_shared_furniture_use.sql` | Receipt-backed furniture position/capacity reconciliation | `d750da4b8e51cfa4e76fafce6b96e09fea5ba288c924b68d023357fffd3ba1a7` |
| `20261008165535_mutual_relationships.sql` | Private mutual relationship consent and closure reconciliation | `f6a8f15b95b9a62fa78e5aab6a2ba2eb8330eeae9371c6387452a6d7d891f9d8` |

These scripts are already included in the published source and have embedded PostgreSQL regression coverage. They retain the private schema and restricted server role; they do not grant browser roles public table access or introduce SECURITY DEFINER functions. The staff migration creates schema only and grants no live staff account. Applying schema is separate from publishing or starting the game.

An earlier automatic approval review rejected hosted staff DDL because it interpreted the unfinished-publication hold as covering database changes. No bypass or retry occurred in this checkpoint. Explicit clarification of the four development schema changes is required before retrying that action.

DATABASE_URL still needs this project's actual session-pooler endpoint and a database login secret; a trusted CA may also be required. Dashboard sign-in alone does not provide or reveal the database password. Keep database and service credentials out of this repository and chat. Existing Render runtime commands, readiness route and auto-deploy setting still need configuration without deploying. SMTP/auth-provider, live database driver/TLS, restore, device/load and full-game acceptance remain open.
