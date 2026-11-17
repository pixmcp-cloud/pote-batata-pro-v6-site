# Potê Batata Pro — V4 beta release (17 November 2026)

## Release boundary

- Prior public commit: d5421e914258c0baa2399072d3a146c1da54bb23.
- Development source: hardening/v4-20261117.
- Release scope: tested frontend/build/V2 sync changes only; not the unresolved commercial security controls.
- Public hosting: GitHub Pages beta with existing Google login gate.
- Rollback: re-publish the prior public commit if needed, after checking schema and unsynced local data.
- A verified Git bundle backup of source exists on the authorized desktop, outside the public repository.
- No Firestore production rules deployment, account migration, Firebase Storage enabling, paid backend, or Floot changes.

## Release checks

- 85 / 85 Node automated tests passed in the local isolated worktree.
- Browser emulation: 320 / 375 / 390 / 430 / 768 px, no horizontal overflow on beta auth gate.
- Real Chrome virtual file-picker test: same-account backup JSON accepted, wrong UID rejected.
- V2 competing order simulation: 8+8 units attempted against 10 in stock; exactly 1 transaction committed.
- V2 incremental sync mock: contiguous pulse fetches changed records; missed event chain causes complete reload.
- Real Firestore Emulator with demo project: Google verification, owner isolation, licensing protected, cash record modification denied.
- Security issues F18/F19 reproduced in the current production rules; separate hardened draft fixes only F18 under Emulator.
- F19 remains unresolved in production and draft: Free quota limits can be bypassed by directly writing additional V2 records.

## Delivered beta improvements

- Paid vs pending sales reporting; strict BR currency input checks.
- Preserve personalized legacy recipe price percentages.
- Backup file must be reselected and verified before account reset.
- Detect module initialization errors; improve delivery account isolation.
- Better V2 rank spacing, clearer menu engineering, more economical gallery and event handling.
- F13: incremental sync with verified history and a full-refresh fallback.
- Payment/stock concurrency protection validated in mocks (not full backend quota enforcement).
- Beta HTML noindex, while static assets remain publicly accessible.
- Disable redundant scheduled deployments; preserve Free/Pro feature flags without activating paid services.

## Not certified for production commercialization

The 35-item technical improvement program is NOT complete. Critical outstanding items:
- F19 server-enforced Free/Pro record quotas.
- F02/F05 server-level reservation, cancellation and inventory invariants beyond generic conflict prevention.
- F18 full legacy migration and secure Firestore rules deployment.
- F20 immutable financial event history across all business events.
- F24 admin privilege model.
- Real data/Firestore backup and restore, Android tests on physical devices, production API sandbox checks.
- F06, F08, F10, F11, F12, F15, F17, F28, F34, F35 require further architecture work.
- Cloud gallery remains disabled; no new recurring fees were authorized.

Do not claim all 35 fixes are complete. Do not deploy firestore.hardened.rules without a migration and compatibility review.

## Deployment verification
- Public main commit: f4ec3c2de69a12b416483f21b3b68b7655ca3c1b.
- GitHub Actions workflow: 44147206716, completed success.
- GitHub Pages tested directly over HTTPS, status 200.
- Login gate, V4 module cache version, incremental V2 code, financial report and noindex all present.
- A real Firestore Emulator concurrency test additionally validated competing V2 clients, without touching live data.
- Remaining critical Free quota weakness (F19) is unchanged in production. Never describe this as full 35/35 approval.
