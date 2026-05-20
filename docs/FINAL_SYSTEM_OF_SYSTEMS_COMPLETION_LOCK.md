# URAI Privacy Final System-of-Systems Completion Lock

Status: `implementation-lock`
Date: 2026-05-20
Owner: URAI Labs / LifeLoggerAI
Repo: `LifeLoggerAI/urai-privacy`

This document is the binding completion lock for `urai-privacy` as both a standalone privacy product and the privacy control plane for the URAI system of systems.

## What this repo now owns

`urai-privacy` owns the canonical privacy contract for every URAI repo that collects, derives, infers, exports, deletes, shares, monetizes, audits, or administers user-linked data.

The repo is complete only when privacy is not a promise in copy, but an enforceable release condition:

- public privacy surfaces are deployed and smoke-tested;
- user privacy center flows exist for export, deletion, consent, audit visibility, and retention visibility;
- Firebase Functions implement export, deletion, consent, admin audit, and health-report workflows;
- Firestore and Storage rules enforce owner/admin boundaries;
- release gates block deployment when privacy evidence is incomplete;
- all Tier-One system repos adopt this contract or are blocked from production release.

## Standalone system lock

The standalone `urai-privacy` product must ship as a self-contained system with the following surfaces:

1. `/` public trust landing page.
2. `/privacy` public privacy statement.
3. `/privacy-center` authenticated user privacy center.
4. `/privacy-center/export` authenticated export request and download flow.
5. `/privacy-center/delete` authenticated deletion request flow.
6. `/privacy-center/consent` authenticated consent management flow.
7. `/privacy-center/audit-log` authenticated user-facing audit/evidence view.
8. `/privacy-center/retention` authenticated retention visibility page.
9. `/admin` verified-admin landing surface.
10. `/admin/privacy-requests` verified-admin privacy request queue.
11. `/admin/audit-log` verified-admin audit/evidence review.
12. `/admin/policies` verified-admin policy/version surface.
13. `/admin/retention` verified-admin retention/legal-hold surface.

No standalone release is complete until `npm run verify:release` passes and live smoke evidence is captured against the deployed host.

## System-of-systems lock

Every Tier-One URAI repo must satisfy these controls before production release:

- consent lookup and enforcement;
- export contribution;
- deletion or anonymization contribution;
- retention policy behavior;
- audit/evidence writing;
- admin access by server-verified role or claim;
- data minimization;
- incident response evidence;
- banned public-claim protection;
- privacy manifest or equivalent data inventory coverage.

The canonical Tier-One adoption registry is `privacy/system-of-systems/registry.json`.

## Required commands

Run these from the repo root before merging any release branch:

```bash
npm ci
npm ci --prefix functions
npm run preflight
npm run test:emulators
npm run verify:release
```

Run this after staging/prod deployment:

```bash
URAI_PRIVACY_BASE_URL="https://<deployed-host>" URAI_PRIVACY_REQUIRE_LIVE=1 npm run test:smoke:live
```

## Hard blockers

Release remains blocked if any item below is true:

- privacy reviewer is still `TBD` for a production release;
- live Firebase staging/prod credentials are unavailable;
- admin custom-claim proof has not been captured;
- export, deletion, consent, admin-audit, or rules tests fail;
- `npm audit` issues lack a disposition;
- legal/counsel review is not recorded for public legal templates;
- a Tier-One repo ships user-linked data behavior without adoption evidence;
- public copy claims diagnosis, lie detection, betrayal detection, crisis prediction, AI therapy, certainty about a person, or sale of sensitive emotional data.

## Final completion definition

`urai-privacy` is complete when the repo has:

1. Passing local preflight.
2. Passing emulator-backed rules/integration tests.
3. Passing release verification.
4. Recorded live smoke evidence.
5. Recorded admin claim proof.
6. Recorded legal/counsel approval.
7. Recorded privacy reviewer approval.
8. Tier-One registry coverage for URAI app, production app, admin, analytics, communications, studio, spatial, foundation, B2B, and asset factory.
9. A clear rollback path and incident owner.
10. Cross-repo CI/adoption guide available for every dependent repo.

Until all ten are true, status is `implementation-lock`, not `production-approved`.

## Operating principle

Nothing ships if it violates this repo.

Memory, identity, consent, deletion, export, and audit are not marketing concepts in URAI. They are release gates.
