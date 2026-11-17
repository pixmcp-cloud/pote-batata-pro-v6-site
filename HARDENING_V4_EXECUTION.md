# Potê Batata Pro — V4 hardening (17/11/2026)

Base: d5421e914258c0baa2399072d3a146c1da54bb23
Branch: hardening/v4-20261117 (isolated). Main/public site unchanged.
Local verified full-Git backup SHA-256: 8793A30634BA18A82657C3DD9E0967E8CB3F966718376AC7D6BB84921690A598.
Important: Git backup contains CODE, not live Firestore data or device-local gallery images.
No paid service, Firebase rules deployment, migration, or Floot edit performed.

## 35 audit items — evidence-based completion status

| Item | Status | Work / blocker |
|---|---|---|
| F01 | Coded, tested | Separates registered, confirmed and pending money in report; Finance Core no longer counts unconfirmed Pix as received. |
| F02 | Blocked | True atomic stock reservation needs a trustworthy backend transaction plus concurrent devices. |
| F03 | Partial | Strict BR currency parser and safer order prices; other input forms still need migration. |
| F04 | Coded, tested | Preserves custom pricing modes and gain percentages in legacy migration. |
| F05 | Blocked | Cancellation/stock/refund atomicity depends on F02 backend strategy. |
| F06 | Pending | Bulk writes larger than 290 changes still fail safely; safe batching not yet developed. |
| F07 | Coded, tested | Authentication-required operations fail closed on unavailable essential module health. |
| F08 | Pending | Duplicate legacy creative implementation not removed yet. |
| F09 | Partial | Shared Finance Core parser/receipt policy; duplicate numeric helpers remain elsewhere. |
| F10 | Pending | V1 compatibility remains enabled for recovery; migration not run. |
| F11 | Pending | Single permission contract not yet delivered. |
| F12 | Pending | Text substitution build still needs modular rework. |
| F13 | Coded, simulated | Adjacent V2 pulse events read only changed records; missed events fall back to a full collection read. Requires live-scale latency validation. |
| F14 | Coded, tested | Only emits data-change event after actual state changes or account transitions, not every navigation. |
| F15 | Pending | Global module interface/contracts remain. |
| F16 | Partial, tested | Small saturated sort groups rebalance within transaction limits; large groups fail safely. |
| F17 | Pending | Mobile performance profiling and lazy loading not complete. |
| F18 | Draft rules tested, NOT deployed | Real Firestore Emulator reproduced unrestricted Free writes in legacy; hardened draft rejects them and preserves V2 metadata and Pro V1, but older Free compatibility is unverified. |
| F19 | CRITICAL, emulator confirmed | Free can create multiple V2 records through SDK. Server-enforced quotas and safe migration required. Unresolved. |
| F20 | Blocked | Immutable audit records need schema/rules and compensation strategy; no destructive changes. |
| F21 | Partial | Beta meta requests noindex; GitHub Pages static assets remain public. |
| F22 | Coded, tested | Menu report names popularity/contribution instead of misusing BCG terminology. |
| F23 | Coded, Chrome mobile emulation green | Actual browser file picker accepted valid account backup and rejected wrong UID at 375px; real Android/production untested. |
| F24 | Blocked | Admin claims/roles need a secured operator migration procedure. |
| F25 | Coded, tested | Future integrations collapsed behind secondary disclosure. |
| F26 | Coded, tested | Gallery text accurately explains local, not Floot-synced, retention. |
| F27 | Coded, tested | Hidden tabs skip gallery timers; redundant twice-daily deploy schedule removed. |
| F28 | Pending | Demonstration and authenticated runtime require deeper extraction. |
| F29 | Partially verified | Android Studio JBR runs Firebase Emulator locally; Google, isolation, license and immutable cash tests pass. Test confirms F19. Draft F18 validation passes. Not deployed. |
| F30 | Coded, tested | Delivery Hub clears temporary import/order context on logout and account switch. |
| F31 | Partial | Sandbox UI proxy restricted to owned hosts and path; PHP auth/protocol need live sandbox tests. |
| F32 | Deferred | Cloud Gallery remains disabled; protected Storage and billing require authorization. |
| F33 | Simulated only | Parallel V2 clients consuming 8 of 10 stock: one transaction committed, one aborted. Physical multi-device shared-universe test remains. |
| F34 | Pending | Supplier provider cache, rate limits and fallback require dedicated stress test. |
| F35 | Existing / pending | Firebase SDK URLs are version-pinned; package/failover review not complete. |

## Evidence

Local suite 82/82 on preceding commit. Added F14 regression and Chromium mobile emulator tests (320/375/390/430/768px). Neither is a production Firestore, multi-device, live API or physical Android validation.

## Release gate

Do not merge into main or change production rules until actual data backups are proven, file-picker UX is checked on mobile, rules pass emulator tests, stock concurrency is reconciled, migration/rollback are tested, and any required backend costs are approved. No paid service was activated.


## 17/11/2026 mobile continuation
- Chrome emulated 320, 375, 390, 430, 768px: no horizontal overflow in beta login.
- Puppeteer exercised file-picker with two test JSONs: same-account accepted, wrong UID rejected.
- F14 data change only on actual account-specific state changes, with regression test.
- Windows-local Puppeteer dependency is unavailable in Linux CI; mobile test intentionally remains local only.


## 17/11/2026 later virtual homologation
- Firebase Emulator (demo-pote-hardening, port 8787) confirmed F18 legacy Free write bypass and F19 unrestricted Free record creation; owner isolation and financial protections passed.
- Separate firestore.hardened.rules draft fixes legacy Free write bypass under Emulator but does not fix F19 and is not configured for production. Existing rules remain unchanged.
- Parallel V2 simulation: exactly one order can consume 8 units from a balance of 10; one rejects with conflict.
- Incremental V2 sync reads only touched documents when pulse history is contiguous; lost events trigger full refresh.
- No Firestore rules changed in production; no paid backend or Floot edits.
