# URAI Privacy Production Audit

Date: 2026-05-15
Repository: `LifeLoggerAI/urai-privacy`
Scope: full repo evidence available through GitHub connector on `main`
Verdict: **NOT PRODUCTION READY — BROKEN/RISK for launch, PARTIAL for staging scaffold**

## Executive summary

`urai-privacy` is materially advanced beyond a static governance package. It contains a Next.js/React/TypeScript app scaffold, Firebase callable Functions, Firestore and Storage rules, workflow helpers, unit tests, CI workflows, release scripts, and governance documentation. However, the repo itself still identifies the system as **NOT READY — BLOCKERS REMAIN** and describes the current product surface as an operational draft plus staging scaffold.

The strict production verdict is **not production ready** because the privacy center and admin pages render workflow-backed previews rather than authenticated live Firebase reads/writes, route-level middleware is incomplete, emulator-backed rules tests are missing, export package generation is incomplete, deletion execution is incomplete, schema names are not fully aligned, legal review is unresolved, and no staging/production deployment evidence is recorded.

Do not call this repo production-ready until the production release gate in `docs/RELEASE_CHECKLIST.md` is satisfied and a lock/evidence document records clean command results, emulator tests, deployment URLs, smoke tests, and approvals.

## Repository map

| Area | Evidence | Status |
|---|---|---|
| Framework/runtime | `package.json`, `next.config.mjs`, `app/`, `src/lib/*` | PARTIAL |
| Legacy public governance website | `website/`, `CNAME`, GitHub Pages workflow | PARTIAL |
| Next.js product routes | `app/page.tsx`, `app/privacy/page.tsx`, `app/privacy-center/*`, `app/admin/*` | PARTIAL |
| Firebase Functions | `functions/src/index.ts` callable scaffold | PARTIAL |
| Firestore rules | `firestore.rules` deny-default and scoped rules | PARTIAL |
| Storage rules | `storage.rules` export/evidence rules and deny-default fallback | PARTIAL |
| Domain workflows | `src/lib/privacy-types.ts`, `src/lib/privacy-workflows.ts` | PARTIAL |
| Unit tests | `tests/unit/privacy-workflows.test.ts` | PARTIAL |
| Route smoke checks | `scripts/smoke-routes.mjs` | PARTIAL |
| Static rules checks | `scripts/validate-rules.mjs` | PARTIAL |
| Release verifier | `scripts/verify-release.sh`, `scripts/assert-production-ready.sh` | PARTIAL |
| Governance/legal docs | `docs/*`, `legal/*`, `policy/*`, `api/privacy-api.yaml`, `schemas/*` | PARTIAL |
| Deployment evidence | No recorded staging/production lock evidence found | NOT STARTED |

## Status matrix

| Area | Feature | Status | Evidence | Missing work | Severity | Acceptance criteria | Tests required | Docs required | Phase |
|---|---|---|---|---|---|---|---|---|---|
| Product shell | Next.js app and npm scripts | PARTIAL | `package.json`, `app/*`, `docs/REPO_MAP.md` | Clean install/build not recorded; lockfile blocker noted; staging scaffold wording remains | HIGH | Clean `npm ci`/install, lint, typecheck, tests, build, preflight pass with evidence | CI + local release verifier | Production verification lock | 0 |
| Privacy Center | User dashboard | PARTIAL | `app/privacy-center/page.tsx` | No live auth state, no live reads, no real status summary, no forms | CRITICAL | Authenticated user sees own consent, requests, retention, ledger, and data categories from live backend | Playwright + callable integration | Privacy Center runbook | 1,3 |
| Export request UI | Request export | BROKEN/RISK | `app/privacy-center/export/page.tsx` uses `demo-user` preview | Not wired to callable Function; no package generation, expiry, manifest integrity, status tracking UI | CRITICAL | User can request export, backend creates request/job/audit, package written to Storage with verified manifest and expiring access | Unit, integration, emulator, E2E, storage tests | Data export runbook | 3 |
| Deletion UI | Request account/data deletion | BROKEN/RISK | `app/privacy-center/delete/page.tsx` uses `demo-user` preview | Not wired to callable Function; destructive deletion not implemented; legal hold and proof missing | CRITICAL | User can submit deletion; admin/legal workflow runs; deletion dry-run/destructive-run are idempotent and audited | Integration, destructive dry-run, emulator, E2E | Data rights/deletion runbook | 3 |
| Consent UI | Manage consent | BROKEN/RISK | `app/privacy-center/consent/page.tsx` uses demo consent and workflow preview | No per-signal consent controls, no backend enforcement gates, no consent receipt UI, no re-consent workflow | CRITICAL | User can grant/revoke by purpose/signal; backend processing checks consent; receipts and version history visible | Unit, callable, E2E, consent-gate tests | Consent model | 1 |
| Audit log UI | User audit history | PARTIAL | `app/privacy-center/audit-log/page.tsx`, `auditLogs` model | Needs live user-scoped query and pagination; integrity hash/tamper evidence not implemented | HIGH | User can view own privacy ledger safely; admin/system events logged; immutable/read-scoped | Rules + E2E | Ledger model | 2 |
| Admin console | Admin dashboard | BROKEN/RISK | `app/admin/page.tsx` renders derived health from empty arrays | Route middleware/session enforcement missing; live admin data not wired; admin actions need evidence | CRITICAL | Admin routes server/client-gated; non-admin denied; all actions logged | Admin/non-admin E2E + rules | Admin runbook | 4 |
| Callable Functions | Export/delete/consent/admin functions | PARTIAL | `functions/src/index.ts` | Basic auth/admin checks exist, but validation is thin; no rate limits/App Check; export/deletion only transitions metadata | CRITICAL | All inputs validated; App Check/rate limits; real export/deletion execution; safe errors | Callable integration tests | API docs | 1-4 |
| Firestore security rules | Owner/admin scoped access | PARTIAL | `firestore.rules` | Static validation only; emulator allow/deny tests missing; create rules rely on `request.resource` shape but no schema validation | CRITICAL | Emulator tests prove owner/admin boundaries and deny-default behavior | Firestore emulator rules tests | Security rules matrix | 4 |
| Storage rules | Export/evidence storage | PARTIAL | `storage.rules` | No signed URL expiry test; no export object creation flow; admin-only write may not match Functions/admin write path depending on backend access | HIGH | Export files private, user/admin readable, evidence admin-only, no public access | Storage emulator tests | Storage policy | 3,4 |
| Static rule checker | Rule invariant script | PARTIAL | `scripts/validate-rules.mjs` | Checks strings only, not actual security behavior | MEDIUM | Static check remains but is supplemented by emulator tests | Emulator tests | Test docs | 4 |
| Route smoke | Route presence script | PARTIAL | `scripts/smoke-routes.mjs` | Only checks files/default export/no lorem; does not verify auth, forms, real behavior, accessibility | MEDIUM | Route smoke plus Playwright flows and accessibility checks | E2E + axe/Lighthouse | QA checklist | 7 |
| Unit tests | Workflow helpers | PARTIAL | `tests/unit/privacy-workflows.test.ts` | Covers pure helpers only; no Functions/Firestore/Auth integration | HIGH | Unit + integration coverage for all critical flows | Vitest + emulator | Test plan | 7 |
| Release verifier | Local verification script | PARTIAL | `scripts/verify-release.sh` | Uses `npm install` not deterministic `npm ci`; command results not recorded; no Firebase deploy evidence | HIGH | Deterministic install, clean CI, evidence file, deployment smoke | CI release verifier | Production verification | 7,8 |
| Production assertions | Static production checks | PARTIAL | `scripts/assert-production-ready.sh` | Static assertions do not prove privacy/security correctness; missing real data-flow gates | HIGH | Static assertions plus behavioral tests and evidence | CI + emulator + E2E | Release checklist | 7,8 |
| Schema contracts | Firestore schema | PARTIAL | `schemas/firestore-privacy-schema.json`, `src/lib/privacy-types.ts` | Existing docs note schema names still need alignment with executable collections | HIGH | One canonical schema aligns docs, rules, Functions, UI, and tests | Schema validation tests | Firestore schema docs | 0 |
| Legal/regulatory docs | Governance/legal package | PARTIAL | `docs/*`, `legal/*`, `policy/*` | Qualified legal review still required | CRITICAL | Legal review signoff recorded before production | Review checklist | Legal approval record | 8 |
| Deployment | Staging/production Firebase | NOT STARTED | `.firebaserc.example`, release docs | No real project IDs, staging deploy, production deploy, smoke evidence, or lock file | CRITICAL | Staging and production URLs deployed and smoke-tested; `docs/LOCK.md` created | Deploy smoke + rollback drill | Lock/evidence docs | 8 |

## Feature inventory by completion class

### COMPLETE

No core production feature is classified as COMPLETE under the strict standard because no feature has recorded evidence for all required gates: real wiring, auth, security rules behavior, tests, docs, deployment, and verification.

### PARTIAL

- Governance documentation package.
- Next.js route files for public, privacy center, and admin surfaces.
- TypeScript domain models and workflow helpers.
- Firebase callable Function scaffold.
- Firestore and Storage rules with deny-default structure.
- Unit tests for pure workflow helpers.
- Static route/rule validation scripts.
- CI/release verifier scaffolding.

### NOT STARTED

- Recorded staging Firebase deployment evidence.
- Recorded production Firebase deployment evidence.
- Production lock/evidence file with commit, command output, URLs, smoke tests, and approvals.
- Real data export package generation and signed/expiring delivery.
- Legal review signoff evidence.
- Full production incident/rollback drill evidence.

### BROKEN/RISK

- UI pages use preview/demo records instead of authenticated live Firebase calls.
- Route-level auth middleware/session enforcement is not implemented for protected routes.
- Deletion processing marks users for deletion but does not complete destructive deletion.
- Export processing records a manifest path but does not build/write/verify a package.
- Static rule validation can pass while real Firestore/Storage authorization behavior remains untested.
- Admin console shows computed empty-state health rather than live operational data.

## Risk register

| Risk | Severity | Evidence | Impact | Required mitigation |
|---|---|---|---|---|
| Production readiness overclaim | CRITICAL | README and final report say not ready | Could ship unsafe privacy system | Keep launch blocked until verifier, emulator, deploy, legal evidence exist |
| Demo/live mismatch | CRITICAL | UI preview pages use `demo-user` | Users cannot actually exercise rights | Wire UI to Auth + callable Functions + live status views |
| Incomplete deletion | CRITICAL | Function only marks user for deletion | False compliance with deletion rights | Implement dry-run, legal hold, destructive deletion, proof, retries |
| Incomplete export | CRITICAL | Function only writes metadata/path | False compliance with portability rights | Generate package, manifest, checksums, storage, expiry, status UI |
| Missing behavioral rules tests | CRITICAL | Static checker only | Access control bugs could survive | Add emulator allow/deny suite for all collections/storage paths |
| Missing route guard | CRITICAL | Repo map says middleware required | Admin/user pages may render without enforced session | Add middleware/client guard/server authorization patterns |
| Schema drift | HIGH | Repo docs note legacy/executable schema mismatch | Rules, docs, API, UI can diverge | Canonical schema alignment and validation |
| Legal templates unreviewed | CRITICAL | README/final report state legal review required | Public launch legal risk | Qualified legal signoff and policy version lock |

## Missing production requirements

1. Deterministic dependency lock and clean install evidence.
2. Live Firebase Auth wiring in the app.
3. Callable Function invocation from UI forms.
4. Route-level auth and admin middleware.
5. Real Firestore reads for privacy center and admin pages.
6. Real export package generator with manifest, checksums, storage write, expiry, and download access.
7. Real deletion executor with dry-run, legal hold, destructive execution, proof, and idempotency.
8. Consent enforcement gates across downstream URAI processing.
9. Consent receipts and versioned re-consent flow.
10. Emulator-backed Firestore and Storage security tests.
11. Callable Functions integration tests.
12. E2E tests for user export/delete/consent/audit and admin status workflows.
13. Accessibility and responsive QA evidence.
14. Schema alignment between docs, API, rules, Functions, and UI.
15. Staging Firebase project configuration and smoke evidence.
16. Production Firebase project configuration and smoke evidence.
17. Legal review signoff.
18. Incident response/rollback drill evidence.

## Recommended implementation phases

See `docs/URAI_PRIVACY_PRODUCTION_ROADMAP.md` for the executable plan.

## Final audit verdict

`urai-privacy` is **not production ready**. It is best classified as a **PARTIAL staging scaffold with critical launch blockers**. The correct next step is not feature polish; it is production hardening: real auth/callable wiring, behavioral security tests, export/deletion execution, schema alignment, deployment evidence, and legal/operational signoff.