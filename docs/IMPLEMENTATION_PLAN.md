# Implementation Plan

Last updated: 2026-05-10

## Goal

Convert `urai-privacy` from a governance/static documentation package into a real standalone Firebase + Next.js privacy product while preserving existing governance, legal, schema, website, and validation assets.

## Implemented in this staging scaffold

1. Root Next.js/React/TypeScript package configuration.
2. Public product routes:
   - `/`
   - `/privacy`
3. User privacy center routes:
   - `/privacy-center`
   - `/privacy-center/export`
   - `/privacy-center/delete`
   - `/privacy-center/retention`
   - `/privacy-center/consent`
   - `/privacy-center/audit-log`
4. Admin routes:
   - `/admin`
   - `/admin/privacy-requests`
   - `/admin/audit-log`
   - `/admin/retention`
   - `/admin/policies`
5. Shared TypeScript privacy domain types.
6. Testable privacy workflow helpers for auth guards, export requests, deletion requests, consent updates, request status transitions, audit logs, retention policies, and privacy health reports.
7. Firebase configuration scaffold:
   - `firebase.json`
   - `.firebaserc.example`
   - `firestore.rules`
   - `storage.rules`
   - `firestore.indexes.json`
8. Firebase Functions scaffold:
   - `functions/package.json`
   - `functions/tsconfig.json`
   - `functions/src/index.ts`
9. Unit tests for critical privacy workflow behavior.
10. Static route and rules verifiers.
11. Release verifier script.
12. GitHub Actions CI and release verifier workflows.

## Still required before production

1. Run the full verifier in CI or a local checkout with Node/npm/Python available.
2. Add committed lockfile after dependency install.
3. Add Firebase emulator integration tests with real Auth/Firestore rule assertions.
4. Wire UI forms to callable functions through Firebase client SDK.
5. Replace demo-rendered records with authenticated live reads.
6. Add deployment project IDs through `.firebaserc` outside the example file.
7. Configure staging and production Firebase projects.
8. Add post-deploy verification evidence.
9. Complete qualified legal review of public templates and regulatory mappings.

## Release posture

Current posture: **READY FOR LOCAL/STAGING VERIFICATION, NOT PRODUCTION READY**.

The scaffold is intentionally honest: it adds executable code and checks, but does not claim live deployment or production readiness until `bash scripts/verify-release.sh` passes in a clean environment and Firebase emulator/deploy verification is recorded.
