# Foundation verification, 7 October 2026

Story: a developer opens the local citizen preview, creates an Independent citizen, settles starter work and spending, completes daily modules and receives a foundation certificate through server-owned commands and persisted state.

| Boundary | Result | Evidence |
|---|---|---|
| Server startup | Passed | HTTP integration test launches the real server on an ephemeral loopback port |
| Authentication and origin | Passed | Missing key returns 401; unrelated origin returns 403 |
| HTTP to domain | Passed | Citizen creation produces the authenticated actor's receipt and balance; payload actor and clock fields cannot override server context |
| Liveness endpoint | Passed | Real HTTP test checks GET /healthz returns only status ok without authentication or player details |
| Domain to journal and event | Passed | Balanced monetary journals, rollback on failure, deduplicated command receipts and unique event records |
| Domain to persistence | Passed | Restart preserves receipts and balances; failed write leaves in-memory state uncommitted |
| Exam and daily progression | Passed | Domain tests verify unlock times, module prerequisites, failed exam review, free retake and a single certificate |
| Browser JavaScript syntax | Passed | `node --check web/app.js` |
| Browser interaction and rendering | Pending | Playwright launch blocked by missing Chromium executable |
| Production identity/database/zones | Pending | These adapters are not yet implemented |

Validation command: `npm test`, 16 tests, 16 passed, 0 failed. Browser status must stay pending until an actual browser run verifies the UI. The fixture exam and starter job do not satisfy the complete production requirements.
