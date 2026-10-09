# Hosted schema verification, 9 October 2026

Project: MY-RP Development (`ogkuirfuwxqwstyjijln`), PostgreSQL 17.11, eu-central-1, ACTIVE_HEALTHY.

Applied the exact four reviewed scripts via the connected Supabase migration API after the owner instructed completion. This completes the schema package; it does not finish or deploy the game.

| Hosted version | Migration | Local source |
|---|---|---|
| `20261009031611` | `scoped_staff_authority` | `20261008113540_scoped_staff_authority.sql` |
| `20261009031643` | `consented_home_visits` | `20261008153709_consented_home_visits.sql` |
| `20261009031649` | `shared_furniture_use` | `20261008161823_shared_furniture_use.sql` |
| `20261009031653` | `mutual_relationships` | `20261008165535_mutual_relationships.sql` |

The hosted migration list now has ten entries. Exact source SHA-256 hashes are recorded in `hosted-migration-manifest.json`. Existing migrations were not replayed; hosted and local timestamps remain mapped rather than assumed equal.

| Verification | Result |
|---|---|
| Tables | 18 simulator tables; all enable and force RLS |
| Browser access | anon and authenticated lack simulator schema usage |
| New functions | All 14 are security invoker; browser execution denied; simulator_server execution allowed |
| New triggers | 14 expected enabled triggers; reconciliation constraints are initially deferred |
| Trusted server | Existing scoped empty world validates all deferred constraints |
| Scope denial | Changing the world scope hides world/staff rows |
| Actual browser roles | anon and authenticated private table/function calls raise insufficient privilege |
| Staff forgery | Invalid administration state rejected |
| Home invitation forgery | Unsupported invitation rejected by mirror count |
| Furniture forgery | Slot-bearing furniture use outside home rejected |
| Relationship forgery | Invalid relationship terms rejected |
| Persistence after verification | Every smoke mutation rolled back; world remains revision 0 with zero citizens/commands and zero staff grants/proposals/audits |
| Security advisor | No findings |
| PostgreSQL regressions | Four relevant staff/home/furniture/relationship cases pass, including rollback/reopening and immutable evidence |

The focused regression command was `node --test --test-name-pattern='mutual relationships|shared furniture claims|home visit consent|staff changes' test/postgres.test.ts` (4/4 pass). The earlier complete application checkpoint remains 192 passing tests with strict TypeScript. Application source did not change here, so the full suite was not repeated.

Hosted smoke checks used explicit transactions, restricted server/browser roles and rollback. Negative checks required the expected exception messages; an unrelated exception or unexpected acceptance would fail the check. They verify hosted migration behavior, not a live Node/PostgreSQL driver connection or gameplay load.

Performance advisor reports five existing informational unused indexes on the empty schema; retain these workload indexes until actual usage is measured. Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

DATABASE_URL/session-pooler credentials and any required trusted CA are still missing. Render still requires runtime/manual-deployment settings; provider signup/email delivery, browser/device/load, restore and whole-game acceptance remain unverified. No paid resource, live staff account, scheduler, Render deployment or demo update occurred.
