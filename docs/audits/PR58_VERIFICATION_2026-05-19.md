# PR #58 Verification Notes - 2026-05-19

Branch: `hardening/preview-blockers-2026-05-19`
PR: #58

## Latest branch evidence supplied by operator

The operator ran verification commands on the PR #58 branch after earlier fixes.

### Passed

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

### Still needed before merging PR #58

- Re-run root `npm run preflight` from `~/urai-privacy` on branch `hardening/preview-blockers-2026-05-19` after `scripts/clean-legacy.sh` was restored.
- Confirm `npm run build` no longer emits the Next workspace-root warning after `next.config.mjs` received an explicit ESM-safe Turbopack root.
- Attach the preflight output to the PR or audit ledger.

### Still needed before production

- Firebase staging deployment evidence.
- Auth provider and admin custom-claim proof.
- Staging smoke evidence for export request, export signed URL, deletion request, consent update, admin denied, and admin allowed flows.
- Legal/counsel approval.
- Monitoring/error routing evidence.
- Rollback/signoff evidence.
- Production destructive deletion executor with legal-hold safeguards, dry-run, retry/error handling, audit evidence, and tests.
- Npm audit disposition for the 5 moderate root findings.
