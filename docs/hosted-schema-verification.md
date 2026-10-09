# Hosted schema verification, 9 October 2026

Validation after the account-return change: npm test passes all 193 tests (78.66 s), strict TypeScript passes, both changed browser scripts pass node --check, and git diff --check is clean. The provider certificate-download attempt timed out without a returned file; no CA certificate was saved and TLS validation remains enabled. Runtime authentication/TLS still requires permitted network/provider verification.


## Account confirmation return and provider URL, 9 October 2026

Saved the Supabase authentication Site URL as https://my-rp-8kiw.onrender.com, replacing the localhost default. No wildcard redirect, new identity provider, account, email send or SMTP credential was added. Custom SMTP is visibly disabled; public signup/email delivery remains open until a suitable provider and sender are configured and tested.

The main client now removes recognised authentication credentials and error parameters from email-return query/fragment URLs before the other client scripts run. It retains only generic presentation flags, preserves unrelated navigation, and requires independent email/password sign-in. It does not accept URL tokens as a session or assert that an untrusted URL proves confirmation. Provider error text is not displayed. If URL cleanup fails, account submission is refused and the user is directed to open the main game address. No credentials are written to browser storage. Real HTTP-to-JSDOM tests cover token fragments, token/code queries, expired/error links, unrelated navigation and unavailable History cleanup; live provider email delivery remains unverified.


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

## Restricted runtime follow-up

The restricted runtime connection is now saved in the existing free MY-RP Render service. Supabase hosted history has eleven entries, including operational migration 20261009033201_restricted_runtime_login. The dedicated myrp_runtime login has NOINHERIT, no superuser/createdb/createrole/replication/BYPASSRLS, a connection limit of eight and only simulator_server membership; server transactions explicitly SET LOCAL ROLE and world/actor scope. The dashboard verified the actual session-pooler endpoint. No administrative password was read or reset; no plaintext password or SCRAM verifier is published. Security advisor remains clear.

Render now has automatic deployment off, build npm ci --omit=dev, start npm run start:postgres and health path /readyz. All seven expected environment names, including masked DATABASE_URL, are visible. The environment-update connector unexpectedly triggered API build dep-db465sss728c739n5kgg even after automatic deployment was independently confirmed off. It was immediately canceled and verified canceled at 03:44:15 UTC before a successful deployment; further settings used dashboard Save Changes only. Do not use that connector for save-only updates while deployment is held. Main remains the old source and the isolated demo is unchanged. This configuration does not launch or complete the game.

A direct pg-driver connection from this workspace failed DNS resolution with EAI_AGAIN before authentication or TLS. Login usability, the provider TLS chain/any required CA, live account signup/email delivery, reboot/restore, device/GPU/load and the remaining Bible systems are still unverified. Do not weaken TLS validation or call this production ready. The existing 192-test code checkpoint remains unchanged by these infrastructure/documentation changes.
