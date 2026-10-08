# Scoped staff authority contract

This is a locally verified component of R058, R056 and R057. The full administration subsystem, hosted provider verification and prelaunch acceptance remain unfinished. The six role names are defined; a role grant does not claim its future moderation, support, content or emergency tools have been completed.

## Authority and authentication

Staff authority is stored separately from citizenship, government office, employment, company titles and editable Auth metadata. Every request first verifies the bearer token through Supabase Auth. Staff reads and writes require `aal2` with a verified TOTP AMR timestamp less than fifteen minutes old, a nonrevoked session and a current grant. Refreshing a password session or an old MFA token does not reset this age. The authenticated session must match the dispatch context. Staff actions are independent of avatar creation and the citizen's active movement tab.

Super grants permit staff-grant review only. They do not imply technical, financial or moderation powers. Technical grants expose bounded world availability counts. Economy grants expose treasury balances and citizen counts in their named state/FCT or the whole world. Other current roles receive their own grant and audit records. There is no direct balance editing, ballot change, qualification bypass or private-message inspection control.

## Independent staff changes

Proposals identify a verified world account, exact role, jurisdiction, expiry and reason. Initial operator accounts can receive another bounded role before joining the game. Super and technical authority are world scoped. Routine grants last at most thirty days, and a routine account can hold at most two distinct roles. The maker cannot grant themselves authority. Existing matching grants cannot be duplicated. Reasons are ten to four hundred characters. At most sixty-four live proposals may await review.

The maker supplies the first approval. A second distinct current Super authority independently approves or rejects the signed exact terms. Two sessions of one account do not count as two reviewers. Review requires fresh MFA, exact administration/proposal versions and the unchanged signature. Each approval records actor, session, time, step-up time and reason. A rejected proposal closes; it is never partially applied. Proposals expire after fifteen minutes.

Application rechecks current reviewer authority, session revocation, approval age, expiry, duplicate roles, role limits and the referenced grant version. Grant/revocation, audit, receipt, outbox and world revision commit atomically. A Super revocation must leave two distinct current Super authorities at application time. This guard prevents immediate lockout; it is not a completed long-term succession or break-glass recovery mechanism. Bounded successor grants can expire and must be reviewed/renewed. Emergency access, protected root rotation, independent recovery and ongoing staffing checks remain prelaunch work.

Exact settled retries return the saved result only while the caller still has current authority and fresh MFA. Authenticated fresh-MFA callers can separately retrieve their own minimal staff command receipt by identifier after losing a role; they cannot inspect another actor's receipt or regain the dashboard. HTTP commands bind their initiating account to the verified identity. Ordinary citizen routes reject staff commands, and HTTP never exposes bootstrap.

## Staff interface and MFA

The main authenticated interface shows staff controls only for accounts with a recorded grant. It supports TOTP enrollment, manual setup-key entry, challenge/verification, independent review, rejection, bounded grants and revocation. The provider issues the upgraded access/refresh session, which replaces the in-memory session and reconnects citizen transport. Only owned unverified setup factors may be discarded through this interface; verified factor removal and recovery are outside this component.

Password, session tokens, OTP and enrollment secret are not saved to browser storage, source, command records or staff audits. Secret/OTP displays clear after verification, account change, logout and tab hiding. Hidden-tab asynchronous results cannot repopulate them. Staff terms render as text. Unconfirmed staff commands retain their identifier in memory in the same tab; retry checks the original receipt before submitting again. Keep that tab open to resolve the result. Reload recovery for staff intent, device/screen-reader acceptance and production authenticator recovery remain open.

The TOTP integration follows the official [Supabase MFA guide](https://supabase.com/docs/guides/auth/auth-mfa) and [TOTP guide](https://supabase.com/docs/guides/auth/auth-mfa/totp). Gateway regression verifies the REST paths and response filtering against controlled provider responses. This is not evidence of live project MFA configuration or live provider login.

## Private persistence and audit

The additive migration `20261008113540_scoped_staff_authority.sql` introduces private grants, proposals and audit mirrors. All three force RLS, use the selected world scope and grant access only through the existing trusted server role. Audit insertion also binds the actor context. Browser roles have no simulator schema access. Grant terms cannot change; proposals retain immutable signed terms and append-only approval history. Settled proposals cannot reopen. Audit rows cannot update or delete, and every audit row references a command receipt. Deferred reconciliation rejects missing or changed mirrors and authority removed from the world snapshot.

The application chains SHA-256 audit hashes over actor, role, session, MFA time, target, reason, request identifier, before/after administration hashes and server time. Backup/file reconciliation checks this chain, the resulting material, command proof and approval evidence. These controls catch corruption and unsupported API/database changes. A mutable database and recomputable hashes do not establish independent tamper resistance. Protected external seals/copies, retention, timed restore drills and privileged-operator threat acceptance remain required by Bible 7.7–7.8.

## First operator setup

No live staff account has been granted. After hosted schema and connection authorization are resolved, a trusted operator must identify two independent confirmed registered Supabase Auth accounts. The offline script verifies both in `auth.users`, rejects anonymous/deleted/currently banned or unconfirmed accounts, requires the existing world and refuses a second bootstrap. It does not create fake game citizens or money. Its default invocation reviews the proposed principals without writing:

```sh
node scripts/bootstrap-staff.ts FIRST_AUTH_UUID SECOND_AUTH_UUID "Reason for initial independent staff authority"
```

Explicit application uses the same arguments with `--apply`. Supply `DATABASE_URL`, `WORLD_ID` and any required `DATABASE_CA_CERT` through private environment configuration. TLS verification stays enabled, URL-level TLS overrides are rejected, and connection diagnostics suppress private credentials. Operator DB verification precedes the game store's restricted server role. Initial roots receive permanent world-scoped grant authority only; their session MFA is still mandatory.

## Evidence and hosted status

All 152 repository checks pass through `npm test`. Strict TypeScript, browser syntax and whitespace checks pass. New domain/file evidence covers trusted bootstrap, current permissions before replay, exact independent decisions, stale/expired/self/invalid-scope/role-cap failures, immediate two-authority minimum, backup/restart integrity and audit corruption. Embedded PostgreSQL evidence covers actual inserts, failed-commit rollback, reopening, duplicate settlement, immutable terms/audits, snapshot mismatch and world/browser-role isolation. Real HTTP and JSDOM evidence covers two independent sign-ins, enrollment/verification, exact review/application, lost-response recovery, account mismatch, logout and final-role removal.

On 8 October, automatic approval review rejected applying this migration to the selected MY-RP Development project, interpreting the main-publication hold as a hold on hosted DDL/security changes. No alternate execution or retry was attempted. The remote migration list remains the previous six entries through `20261008110107`; the hosted world and staff authority are unchanged. The hosted manifest remains unchanged. Do not start this newer main server against the old hosted schema until the pending migration is authorized and verified.

No source push, Render deploy or preview publication occurred. Live Auth/MFA, hosted PostgreSQL 17 staff probes, production-driver/TLS, initial real staff provisioning, operational role tools, staff recovery, independent audit protection and full A13/A24 acceptance remain open.
