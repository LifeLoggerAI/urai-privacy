# URAI Privacy Production Roadmap

Date: 2026-05-15
Repository: `LifeLoggerAI/urai-privacy`
Current verdict: **NOT PRODUCTION READY**
Roadmap mode: audit-only deliverable; no implementation performed in this pass.

## Roadmap principles

1. Fix correctness before polish.
2. Do not call preview/demo UI production.
3. Treat consent, export, deletion, admin access, audit logs, and security rules as critical paths.
4. Require file-path evidence and test evidence for every completed item.
5. Do not mark production-ready until verifier, emulator tests, staging deploy, production deploy, smoke checks, legal review, and release lock all pass.

## Phase 0 — Stabilize and remove prototype risk

### Outcome

Create a stable, deterministic baseline and eliminate schema/config drift before wiring new behavior.

### Files likely affected

- `package.json`
- `package-lock.json`
- `src/lib/privacy-types.ts`
- `schemas/firestore-privacy-schema.json`
- `api/privacy-api.yaml`
- `firestore.rules`
- `functions/src/index.ts`
- `docs/REPO_MAP.md`
- `docs/FINAL_SYSTEM_REPORT.md`
- `docs/LOCK.md`

### Work items

| Item | Acceptance criteria | Tests required | Verification command | Production risk if skipped |
|---|---|---|---|---|
| Generate and commit deterministic lockfile | Clean install uses `npm ci`; lockfile matches package graph | CI install test | `npm ci` | Non-reproducible builds |
| Align canonical schema names | One canonical map for collections, API, rules, Functions, UI, docs | Schema validation test | `npm run typecheck && python tools/run_validation.py` | Data written to undocumented or conflicting collections |
| Replace staging-scaffold readiness language with precise status | Docs say exact readiness level without overclaiming | Doc lint/manual review | `grep -R "production ready" docs README.md` | False launch confidence |
| Run baseline verifier and record results | `docs/LOCK.md` or verification doc records exact command results | CI/local evidence | `bash scripts/verify-release.sh` | Unknown build/test state |

## Phase 1 — Consent and policy versioning

### Outcome

Consent becomes real, versioned, user-visible, and enforceable by backend processing.

### Files likely affected

- `app/privacy-center/consent/page.tsx`
- `src/lib/privacy-types.ts`
- `src/lib/privacy-workflows.ts`
- `functions/src/index.ts`
- `firestore.rules`
- `tests/unit/privacy-workflows.test.ts`
- `tests/integration/*`
- `docs/CONSENT_MODEL.md`
- `docs/PRIVACY_WORKFLOWS.md`

### Work items

| Item | Acceptance criteria | Tests required | Verification command | Production risk if skipped |
|---|---|---|---|---|
| Add per-purpose/per-signal consent model | Audio, GPS, device, app/email/social/passive-sensor, AI inference, analytics, monetization are modeled | Unit/schema tests | `npm run test:unit` | Consent cannot be enforced granularly |
| Wire consent UI to Firebase Auth and callable Function | Authenticated user can grant/revoke live consent and see saved state | E2E + callable integration | `npm run test:e2e && npm run test:integration` | UI remains fake/demo |
| Add consent receipts/history | Every change produces immutable event and visible receipt | Unit + Firestore tests | `npm run test:emulators` | Cannot prove consent or revocation |
| Add policy version/re-consent flow | Published policy version can trigger required re-consent | Integration/E2E | `npm run test:integration` | Users stay on stale legal consent |
| Add backend consent enforcement helper | Sensitive processing checks current consent before execution | Unit + integration | `npm run test` | Downstream systems may process revoked data |

## Phase 2 — Ethics/consent ledger

### Outcome

Ledger becomes append-only, queryable, and sufficiently tamper-evident for operational audit.

### Files likely affected

- `src/lib/privacy-types.ts`
- `src/lib/privacy-workflows.ts`
- `functions/src/index.ts`
- `app/privacy-center/audit-log/page.tsx`
- `app/admin/audit-log/page.tsx`
- `firestore.rules`
- `tests/integration/*`
- `docs/AUDIT_LOGGING_STANDARD.md`

### Work items

| Item | Acceptance criteria | Tests required | Verification command | Production risk if skipped |
|---|---|---|---|---|
| Define full audit action taxonomy | Consent, policy, export, deletion, admin access, data access, AI provenance, breach hooks covered | Type/unit tests | `npm run typecheck && npm run test:unit` | Missing evidence for sensitive actions |
| Add hash/integrity strategy | Audit entries include hash or documented immutable evidence strategy | Unit/integration | `npm run test:integration` | Ledger is weak against tampering claims |
| Wire user/admin audit views | User sees own events; admin sees authorized operational events | E2E + rules | `npm run test:e2e && npm run test:emulators` | Audit UI not usable |
| Log denied attempts and admin reads | Admin and denied sensitive actions create safe audit entries | Integration | `npm run test:integration` | Abuse/access review blind spots |

## Phase 3 — User data rights: export, delete, correct, revoke

### Outcome

User rights are operational, not just promised.

### Files likely affected

- `app/privacy-center/export/page.tsx`
- `app/privacy-center/delete/page.tsx`
- `app/privacy-center/page.tsx`
- `functions/src/index.ts`
- `storage.rules`
- `firestore.rules`
- `src/lib/privacy-workflows.ts`
- `docs/DATA_RIGHTS_RUNBOOK.md`
- `docs/DATA_EXPORT_STANDARD.md`
- `docs/RETENTION_AND_DELETION.md`

### Work items

| Item | Acceptance criteria | Tests required | Verification command | Production risk if skipped |
|---|---|---|---|---|
| Export package generator | Builds real user export with manifest, checksums, excluded internal fields, record counts | Integration + storage | `npm run test:integration && npm run test:emulators` | False portability compliance |
| Export status and download UI | User can request, track, and download private export when ready | E2E | `npm run test:e2e` | User cannot exercise export right |
| Expiring/signed access strategy | Export downloads expire and are private | Storage emulator/integration | `npm run test:emulators` | Sensitive data exposure |
| Deletion dry-run executor | Admin/system can preview exactly what will be deleted/retained | Unit + integration | `npm run test:integration` | Unsafe destructive delete |
| Deletion destructive executor | Idempotent deletion across user data, derived data, storage refs, legal holds, proof | Integration + dry-run fixture | `npm run test:integration` | False deletion compliance |
| Correction/update flow | User can request correction or update supported profile/privacy data | E2E + rules | `npm run test:e2e` | Missing user-rights capability |

## Phase 4 — Security rules, RBAC, admin controls

### Outcome

Access control is enforced server-side and proven with emulator tests.

### Files likely affected

- `middleware.ts`
- `firebase/firebase.ts`
- `functions/src/index.ts`
- `firestore.rules`
- `storage.rules`
- `app/admin/*`
- `tests/rules/*`
- `tests/integration/*`
- `docs/ADMIN_PRIVACY_RUNBOOK.md`

### Work items

| Item | Acceptance criteria | Tests required | Verification command | Production risk if skipped |
|---|---|---|---|---|
| Add route-level user/admin guards | `/privacy-center/*` requires auth; `/admin/*` requires admin | E2E | `npm run test:e2e` | Protected pages exposed |
| Add emulator Firestore rules tests | Owner/admin/unauthenticated allow/deny matrix passes | Firestore emulator | `npm run test:emulators` | Security rules unproven |
| Add emulator Storage rules tests | Export/evidence paths prove private behavior | Storage emulator | `npm run test:emulators` | Export/evidence leakage |
| Harden callable Functions validation | Zod or equivalent validation, safe errors, rate/App Check posture | Unit/integration | `npm run test:integration` | Abuse or malformed writes |
| Admin console live wiring | Admin can process requests, view ledger, view policies, all actions logged | E2E/integration | `npm run test:e2e` | Admin tool remains static preview |

## Phase 5 — Privacy-preserving processing and minimization

### Outcome

The repo provides reusable enforcement for minimization, de-identification, retention, and purpose limitation.

### Files likely affected

- `src/lib/privacy-types.ts`
- `src/lib/privacy-workflows.ts`
- `functions/src/index.ts`
- `docs/ANONYMIZATION_STANDARD.md`
- `docs/DATA_CLASSIFICATION.md`
- `docs/DATA_COLLECTION_BOUNDARIES.md`
- `docs/PRIVACY_ARCHITECTURE.md`
- `tests/unit/*`

### Work items

| Item | Acceptance criteria | Tests required | Verification command | Production risk if skipped |
|---|---|---|---|---|
| Data minimization helpers | Export/API paths redact internal/secrets/sensitive fields by policy | Unit tests | `npm run test:unit` | Overexposure of sensitive data |
| De-identification telemetry contract | Analytics/telemetry cannot include raw PII without consent | Unit/schema tests | `npm run test` | PII leakage in analytics |
| Retention enforcement job design | Retention windows have executable or scheduled enforcement plan | Integration/manual | `npm run test:integration` | Data retained beyond policy |
| Purpose limitation checks | Processing events require purpose and consent status | Unit/integration | `npm run test` | Silent data-use escalation |

## Phase 6 — Observability, incident response, audit evidence

### Outcome

Operations can detect, investigate, and respond to privacy failures.

### Files likely affected

- `functions/src/index.ts`
- `docs/INCIDENT_RESPONSE_PRIVACY.md`
- `docs/ADMIN_PRIVACY_RUNBOOK.md`
- `docs/PRIVACY_RELEASE_CHECKLIST.md`
- `.github/workflows/*`
- `scripts/*`

### Work items

| Item | Acceptance criteria | Tests required | Verification command | Production risk if skipped |
|---|---|---|---|---|
| Structured logging without PII | Functions logs include request/action IDs, no raw sensitive payloads | Unit/static review | `npm run security:gate` | PII in logs |
| Privacy incident runbook | Breach/incident detection, triage, notification, rollback documented | Manual review | Checklist signoff | Slow/unsafe incident handling |
| Evidence capture script | Release command output, URLs, smoke results captured in docs | Script smoke | `bash scripts/verify-release.sh` | No proof of readiness |
| Rollback drill | Rollback path verified and documented | Manual/staging test | Release checklist | Unrecoverable bad deploy |

## Phase 7 — QA, CI, deployment, documentation

### Outcome

Every production claim has automated and manual verification evidence.

### Files likely affected

- `.github/workflows/ci.yml`
- `.github/workflows/release-verifier.yml`
- `tests/e2e/*`
- `tests/integration/*`
- `tests/rules/*`
- `docs/PRIVACY_QA_CHECKLIST.md`
- `docs/PRIVACY_RELEASE_CHECKLIST.md`
- `docs/URAI_PRIVACY_PRODUCTION_VERIFICATION.md`

### Work items

| Item | Acceptance criteria | Tests required | Verification command | Production risk if skipped |
|---|---|---|---|---|
| CI full gate | lint/typecheck/unit/integration/rules/e2e/build/security all run | CI | GitHub Actions green | Broken code can merge |
| Accessibility QA | Core pages meet keyboard, screen reader, contrast requirements | Axe/Lighthouse/manual | `npm run test:e2e` + QA checklist | Accessibility failure |
| Documentation completion | Architecture, consent, data rights, admin, incident, env, API, schema docs current | Doc review | Checklist signoff | Operators cannot run system |
| Production verification doc | Real results recorded; blockers explicit | Manual evidence | `docs/URAI_PRIVACY_PRODUCTION_VERIFICATION.md` | False readiness claims |

## Phase 8 — Production launch gate

### Outcome

Only after this phase can the repo be called production-ready.

### Files likely affected

- `.firebaserc` or CI secret config outside committed secrets
- `docs/LOCK.md`
- `docs/URAI_PRIVACY_PRODUCTION_VERIFICATION.md`
- `docs/PRIVACY_RELEASE_CHECKLIST.md`
- `docs/FINAL_SYSTEM_REPORT.md`

### Work items

| Item | Acceptance criteria | Tests required | Verification command | Production risk if skipped |
|---|---|---|---|---|
| Staging deployment | Staging Firebase app/functions/rules deployed and smoke-tested | Deploy smoke | Firebase preview/staging commands | Production defects not caught |
| Production deployment | Production deploy succeeds with locked commit and env | Deploy smoke | Firebase deploy + smoke | Not actually live |
| Post-deploy smoke | Public routes, protected routes, callables, rules, export/delete request creation verified | Smoke/E2E | Production smoke script | Broken live privacy system |
| Legal/security/product signoff | Qualified signoffs with evidence, dates, commit | Manual | Release checklist | Legal/security exposure |
| Final lock | `docs/LOCK.md` records exact commit, command results, URLs, approver, rollback | Manual/evidence | Checklist | No auditable launch record |

## Immediate next implementation order

1. Create deterministic lockfile and run/record clean baseline verification.
2. Align schema names across docs, API, rules, Functions, and TypeScript.
3. Add Firebase client/Auth layer and protected route middleware.
4. Wire privacy-center consent/export/delete pages to live callables.
5. Add emulator-backed Firestore and Storage rules tests.
6. Implement real export package generation and private delivery.
7. Implement deletion dry-run/destructive execution with legal hold safeguards.
8. Wire admin console to live request and audit collections.
9. Add integration and E2E tests for user/admin critical paths.
10. Complete docs and release evidence.
11. Deploy staging and record smoke evidence.
12. Complete legal/security/product signoff.
13. Deploy production and record lock.

## Production-ready definition

`urai-privacy` is production-ready only when all of the following are true:

- Clean deterministic install passes.
- Lint passes.
- Typecheck passes.
- Unit tests pass.
- Callable integration tests pass.
- Firestore and Storage emulator rules tests pass.
- E2E privacy/admin flows pass.
- Production build passes.
- Security gate passes.
- Export package generation works and is private.
- Deletion execution works, is idempotent, and respects legal holds.
- Consent enforcement gates downstream processing.
- Admin routes and Functions enforce server-side authorization.
- Legal review is recorded.
- Staging and production deployment evidence exists.
- Release lock exists with exact commit, commands, URLs, smoke results, approver, and rollback plan.

Until then, the official status remains: **NOT PRODUCTION READY**.