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
| F13 | Pending | V2 still re-reads whole collections; incremental sync not implemented. |
| F14 | Pending | Rendering still emits change events; queueSave already checks equality before writes. |
| F15 | Pending | Global module interface/contracts remain. |
| F16 | Partial, tested | Small saturated sort groups rebalance within transaction limits; large groups fail safely. |
| F17 | Pending | Mobile performance profiling and lazy loading not complete. |
| F18 | Blocked | Legacy Firestore write rules need emulator validation, staged compat/migration; production unchanged. |
| F19 | Blocked | Free/Pro quota security needs trustworthy server-side enforcement, not just UI restrictions. |
| F20 | Blocked | Immutable audit records need schema/rules and compensation strategy; no destructive changes. |
| F21 | Partial | Beta meta requests noindex; GitHub Pages static assets remain public. |
| F22 | Coded, tested | Menu report names popularity/contribution instead of misusing BCG terminology. |
| F23 | Coded, tests green, manual mobile validation needed | Account reset requires selecting actual downloaded backup and checking UID/schema/current state. |
| F24 | Blocked | Admin claims/roles need a secured operator migration procedure. |
| F25 | Coded, tested | Future integrations collapsed behind secondary disclosure. |
| F26 | Coded, tested | Gallery text accurately explains local, not Floot-synced, retention. |
| F27 | Coded, tested | Hidden tabs skip gallery timers; redundant twice-daily deploy schedule removed. |
| F28 | Pending | Demonstration and authenticated runtime require deeper extraction. |
| F29 | Pending | Firebase emulator rules tests not executed; remote PC lacks Java. |
| F30 | Coded, tested | Delivery Hub clears temporary import/order context on logout and account switch. |
| F31 | Partial | Sandbox UI proxy restricted to owned hosts and path; PHP auth/protocol need live sandbox tests. |
| F32 | Deferred | Cloud Gallery remains disabled; protected Storage and billing require authorization. |
| F33 | Pending | Two-device shared-universe concurrency not yet proven. |
| F34 | Pending | Supplier provider cache, rate limits and fallback require dedicated stress test. |
| F35 | Existing / pending | Firebase SDK URLs are version-pinned; package/failover review not complete. |

## Evidence

82 / 82 local JS/MJS/CJS tests passed, including new money, legacy pricing, rank and reset tests. This is NOT a production Firestore rule, concurrent-device, live API, or real Android backup test.

## Release gate

Do not merge into main or change production rules until actual data backups are proven, file-picker UX is checked on mobile, rules pass emulator tests, stock concurrency is reconciled, migration/rollback are tested, and any required backend costs are approved. No paid service was activated.
