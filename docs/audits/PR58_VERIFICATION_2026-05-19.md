# PR #58 Verification Notes - 2026-05-19

Branch: `hardening/preview-blockers-2026-05-19`
PR: #58

## Latest branch evidence supplied by operator

The operator ran verification commands on the PR #58 branch after earlier fixes.

### Passed

- `npm run preflight`
  - `clean:legacy` passed and removed generated legacy/build artifacts.
  - `lint` passed, with an ESLintRC deprecation warning.
  - `typecheck` passed.
  - `test:unit` passed: 1 test file, 8 tests.
  - `test:rules:static` passed.
  - `test:e2e` route smoke passed.
  - `audit:privacy` passed.
  - `audit:tier-one` passed.
  - `build` passed and prerendered all expected app routes.
  - The earlier Next workspace-root warning did not appear in this preflight output after the explicit Turbopack root patch.
- `npm run test:emulators`
  - Firestore rules suite passed: 7 tests.
  - Storage rules suite passed: 4 tests.
  - Total rules test files passed: 2.
  - Total rules tests passed: 11.
  - Integration smoke suite passed: 2 tests.
  - Emulator command exited successfully with code 0.
- Functions package checks from `~/urai-privacy/functions`:
  - `npm run build` passed.
  - `npm run typecheck` passed.
  - `npm test` passed, delegating to `npm run typecheck`.

### Expected stderr during rules tests

The Firestore `PERMISSION_DENIED` stderr output is expected for negative authorization tests. Those tests intentionally verify that blocked writes, blocked updates, blocked deletes, anonymous access, and unknown collections are denied. The suite result is the authority: all rule tests passed.

### Remaining preview gate

- Deploy PR #58 to Firebase preview/staging.
- Smoke the real hosted flows:
  - export request,
  - export signed URL retrieval,
  - deletion request,
  - consent update,
  - admin denied,
  - admin allowed.
- Attach redacted Firebase staging environment evidence and custom-claim proof.

### Still needed before production

- Firebase staging deployment evidence.
- Auth provider and admin custom-claim proof.
- Staging smoke evidence for export request, export signed URL, deletion request, consent update, admin denied, and admin allowed flows.
- Legal/counsel approval.
- Monitoring/error routing evidence.
- Rollback/signoff evidence.
- Production destructive deletion executor with legal-hold safeguards, dry-run, retry/error handling, audit evidence, and tests.
- Npm audit disposition for the 5 moderate root findings.
