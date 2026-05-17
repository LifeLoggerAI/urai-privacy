# URAI Privacy Implementation Plan

Status: **staging hardening**
Owner: URAI Privacy Control Plane
Branch: `harden-release-verification`

This plan turns `urai-privacy` from a staging scaffold into a cohesive production privacy control plane for the URAI ecosystem.

## Phase 0: Release verification baseline

Goal: make the repository deterministic, verifiable, and honest about readiness.

Required work:

1. Keep root and Functions `package-lock.json` files committed.
2. Run `npm ci` at the root and in `functions/`.
3. Run lint, typecheck, unit tests, static rules checks, route smoke checks, Next build, and Functions build/typecheck.
4. Run `npm run audit:tier-one` to confirm Tier-One privacy evidence exists.
5. Install Java 17+ and run Firebase emulator-backed tests.
6. Run `npm run security:gate`.
7. Run `bash scripts/assert-production-ready.sh`.
8. Record evidence in `docs/LOCK.md`.

Acceptance criteria:

- `bash scripts/verify-release.sh` exits successfully in a clean checkout.
- `docs/LOCK.md` records exact command evidence.
- Any remaining vulnerabilities are documented with severity and mitigation.

## Phase 1: Canonical privacy contract

Goal: one source of truth for collections, consent tiers, data classes, retention classes, export/deletion behavior, and audit actions.

Required work:

1. Add or maintain a canonical TypeScript privacy contract under `src/lib/`.
2. Align `src/lib/privacy-types.ts`, `src/lib/privacy-workflows.ts`, Firebase Functions, Firestore rules, Storage rules, docs, tests, and OpenAPI/schema artifacts to the same names.
3. Ensure Tier 2 passive context and Tier 3 sensitive emotional/relationship processing require explicit consent.
4. Ensure admin/system collections are never client-writable.
5. Ensure audit evidence is immutable.

Acceptance criteria:

- Canonical contract unit tests pass.
- No duplicate divergent collection allowlists remain in critical runtime code unless documented as generated snapshots.
- Functions and rules reference the same collection and data-rights model.

## Phase 2: User privacy center wiring

Goal: users can exercise privacy rights from live authenticated UI flows.

Required work:

1. Wire `/privacy-center/export` to `createExportRequest`.
2. Wire `/privacy-center/delete` to `createDeletionRequest`.
3. Wire `/privacy-center/consent` to `updateConsent`.
4. Show authenticated user request status from Firestore.
5. Show consent receipt hashes and event history.
6. Show retention summaries and audit history.

Acceptance criteria:

- Authenticated users can create export/deletion requests.
- Users can grant, deny, and revoke consent by purpose.
- Users can only see their own privacy records.
- E2E tests cover success and denied-access paths.

## Phase 3: Export package fulfillment

Goal: export fulfillment is real, private, auditable, and verifiable.

Required work:

1. Generate export JSON for covered user-scoped collections.
2. Redact credentials and operational secrets.
3. Write export package and manifest to private Firebase Storage.
4. Store manifest checksum, package checksum, record count, and paths on the export job.
5. Audit request creation and processing.
6. Add expiry/revocation behavior for export artifacts.

Acceptance criteria:

- Export manifest contains checksum, record count, generated timestamp, and excluded field list.
- Export files are private and readable only by the owner/admin path intended by rules.
- Storage emulator tests prove no public access.

## Phase 4: Deletion planner and executor

Goal: deletion is operational, not merely promised.

Required work:

1. Generate a deletion plan before destructive execution.
2. Respect legal hold and security-retention exceptions.
3. Support dry-run and destructive modes.
4. Make deletion idempotent and retry-safe.
5. Record deleted, retained, anonymized, and skipped data categories.
6. Write immutable audit evidence.

Acceptance criteria:

- Deletion request has a signed/hashable plan.
- Destructive deletion cannot run without admin/system authorization.
- Retained data is explicitly documented.
- Emulator/integration tests cover dry-run, completion, and failure states.

## Phase 5: Admin privacy console

Goal: admins can manage requests with least privilege and full audit trails.

Required work:

1. Enforce admin route guards.
2. Wire admin request queues to live Firestore/Functions.
3. Require notes for sensitive request actions.
4. Record admin actions and audit logs.
5. Display health report and stuck request warnings.

Acceptance criteria:

- Non-admin users cannot access admin pages or callable admin functions.
- Admin actions are recorded in both `adminActions` and `auditLogs` where applicable.
- E2E and rules tests cover admin/non-admin boundaries.

## Phase 6: Cross-repo adoption

Goal: every URAI product honors `urai-privacy` before release.

Required work:

1. Add adoption evidence for URAI core, Admin, Analytics, Communications, Studio, Spatial, Foundation, B2B Portal, and Asset Factory.
2. Require every new data collection to declare data class, consent tier, retention behavior, export behavior, deletion behavior, and audit behavior.
3. Add release-blocking checks where feasible.

Acceptance criteria:

- `docs/LOCK.md` records adoption status for each Tier-One repo.
- Product releases that add data collection cannot claim production readiness without privacy mapping.

## Phase 7: Deployment and legal lock

Goal: ship only after technical, operational, and legal evidence are complete.

Required work:

1. Deploy staging Firebase project.
2. Smoke-test staging URLs and callable Functions.
3. Deploy production Firebase project.
4. Smoke-test production URLs and callable Functions.
5. Record reviewer/signoff evidence for privacy policy, legal notices, export, deletion, incident response, and data monetization if applicable.

Acceptance criteria:

- `docs/LOCK.md` verdict changes from BLOCKED to LOCKED only after all evidence is complete.
