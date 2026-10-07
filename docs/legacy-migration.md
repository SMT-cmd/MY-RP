# MY-RP migration

The user selected SMT-cmd/MY-RP as the project repository on 7 October 2026 and authorised editing or replacing its former RPG code.

## Preserved original

- Original main commit: `309c705e758e243709797fd24a8eb3efbc8e9840`.
- Archive branch: `archive/holden-rpg-2026-10-07`.
- Original files: `app.js`, `index.html`, `LICENSE`.
- Original title: Holden City Grand RPG – Simulation.
- The repository's Apache 2.0 LICENSE is retained unchanged.

The former RPG contains client-side ideas for offices, families, work, shops, banks, transport, parties and justice. It saves world state in browser localStorage and runs money and role changes in that client. These mechanics are useful references for the product catalogue but cannot be the authoritative multiplayer economy or access-control implementation.

The main working tree now uses the Bible-backed Node/TypeScript development foundation. The original source is preserved through the archive branch and normal Git history; no history is rewritten. The replacement does not assert that the archived systems have been rebuilt. Requirement statuses continue to record full systems as incomplete.

## Existing browser saves

Old saves belong to each user's browser. They are not centrally stored game accounts and have not been migrated to the new server. Never import browser balances, credentials or official roles as trusted multiplayer state. A future import path would need explicit validation and product rules. Development fixtures are separate from any such migration.

## Repository visibility

The selected repository is public until a verified GitHub visibility change succeeds. GitHub's connected code tools can update files and branches but expose no repository-visibility mutation. Automatic approval review blocked a website sign-in attempt because earlier Google approval was declined; that sign-in must not be retried until the user explicitly asks. Keep secrets out of every commit. The token pasted into chat is not used, stored or committed; it should be revoked. Changing future visibility cannot retract copies of code that were already public.
