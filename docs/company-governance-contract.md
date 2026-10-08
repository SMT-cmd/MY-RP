# Local corporate governance contract

Bible R030 and R031, sections 4.6–4.7. This records implemented local components. D09/D11 remain proposed; full A06/A18/A23 scenarios have not passed.

## Protected actions

| Action | Funding | Ownership consent | Result |
|---|---|---|---|
| Dividend | Reserve existing company cash | Captured controllers | Exact proportional cash distribution |
| Existing share transfer | Named buyer reserves the exact price; zero-price gift allowed | Selling holder and buyer, plus controllers | Existing units change holder; issued total stays fixed |
| New issuance | Named buyer reserves new capital | Every existing shareholder and buyer, plus controllers | Company receives capital; issued total increases |
| Buyback | Reserve existing company cash | Selling holder, plus controllers | Holder receives price; units are cancelled |
| Restructure | Zero payment | Captured controllers | Pause new commitments; retain existing obligations |
| Resume | Zero payment | Captured controllers | Restore new commitments |
| Final closure | Reserve exact remaining company cash | Every shareholder, plus controllers | Distribute residual cash; retain evidence and close company |

Founder, cofounder and CEO are controllers. Two distinct signatures are required if at least two controllers exist; a sole controller needs one. Acting managers cannot approve protected actions. A role invitation confers duties without shares or personal assets. Shareholders retain economic ownership separately from management roles.

Each proposal captures its exact price, units, parties, ownership/controller/operating-stage signature and seven-day expiry. Voting or accepting changed terms fails. A controller has one recorded vote; withdrawing it prevents settlement. A change in ownership, controllers or operating stage makes old terms stale. Review fresh terms after cancellation. Independent unrelated cash activity does not invalidate an ordinary share/dividend proposal, while final closure additionally checks exact remaining cash.

Existing offered units are locked across pending proposals to prevent overselling. Buyer acceptance reserves funds once. Failed settlement leaves reservations intact. The proposing or trading parties can cancel unexecuted proposals. A recorded party can return expired reservations. Refunds go to the original funding accounts. Successful settlement records an immutable command receipt and can be replayed without paying or transferring twice.

Development limits: initial 100,000 shares; each share action up to 1,000,000 units; issued total at most 10,000,000; one action amount at most 100,000,000 minor units. These bounded implementation parameters do not approve the complete securities design. Dividends use largest-remainder allocation with a stable actor tie-break to conserve minor units exactly.

## Restructuring and final closure

Restructuring rejects new purchases, production, goods adverts, payroll top-ups, hiring commitments, deposits, loans, policy sales and institutional intake. Already funded shifts, deliveries, refunds, treatment, education continuity and principal withdrawal remain callable. Workers retain consent, notice, resignation and earned payment rights.

Closure blockers count available stock, open listings, unsettled orders, running production, open/reserved vacancies, active contracts/shifts, financial institutions, deposits/unpaid interest, unpaid loan assets, private school enrolments, patient care, policies/claims and other pending approvals. Only aggregate counts reach the company overview; student/patient identities and private case details are not included. Blockers are checked at proposal and again in the settlement transaction. New income prevents distribution of an outdated final balance. Cancellation returns reserved final cash for a fresh review.

No company record or history is deleted. Closure is unavailable while recorded assets or obligations remain. Creditor priority, automatic distress warnings, disputed liabilities, acquisition/merger contract transfer and wider agency intervention are still unfinished; this component cannot be treated as complete insolvency handling.

## Evidence and runtime boundary

Domain tests exercise controllers, ownership consent, overselling, expiry/cancellation, dilution, buyback, rounding, stale terms, outsider privacy, closure blockers and worker continuity during restructuring. PostgreSQL tests reject changed terms and balanced counterfeit ownership, exercise failed-commit rollback, reopening and once-only settlement. HTTP-to-JSDOM tests exercise a funded dividend through the actual workbench controls. Recovery derives ownership from registration and settled actions. Private SQL mirrors enforce immutable terms/terminal records and reconcile reserves, approval receipts and issued shares in deferred checks.

Embedded PostgreSQL 18 is the tested local database. Connected Supabase PostgreSQL 17 has received no migration. The single-world transaction lock and snapshot scans need capacity verification. The workbench remains a loopback development tool; the public Render visual demo contains no authoritative game API or database connection.
