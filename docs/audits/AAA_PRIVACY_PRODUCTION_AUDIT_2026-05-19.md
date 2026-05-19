# AAA Privacy Production Audit - 2026-05-19

Branch: `hardening/preview-blockers-2026-05-19`
Repo: `LifeLoggerAI/urai-privacy`

## Launch verdict

- LAUNCH VERDICT: NO
- CONFIDENCE: 88 percent repo-side confidence after successful PR #58 preflight, emulator, integration, and functions verification, pending Firebase staging evidence, legal approval, monitoring/rollback evidence, and a verified destructive deletion executor.
- MOST IMPORTANT BLOCKER: PR #58 is now repo-verification-ready for preview review, but production remains blocked by live Firebase staging proof, admin custom claim proof, legal approval, monitoring/rollback evidence, npm audit disposition, and a verified destructive deletion executor.

This audit does not mark the repo production-ready. It does show that the repo is much closer to preview readiness: the operator-supplied PR #58 branch evidence shows preflight, emulator-backed rules/integration, and functions build/typecheck/test passed. Production still requires Firebase deploy/staging evidence, legal review, admin custom claim proof, monitoring, rollback, live smoke, and a verified destructive deletion executor.

## Uploaded verification evidence from 2026-05-19

Passing in earlier uploaded logs:

- `npm install` completed, with warnings.
- `npm run lint` completed.
- `npm run typecheck` completed.
- `npm run test:unit` passed: 1 file, 8 tests.
- `npm run test:rules:static` passed.
- `npm run test:smoke` passed.
- `npm run audit:privacy` passed.
- `npm run audit:tier-one` passed.
- `npm run build` completed and rendered all expected app routes.
- `npm run check:java` passed with OpenJDK 17.
- `npm run test:emulators` completed successfully: Firestore/Storage rules tests passed, and integration smoke tests passed.
- `cd functions && npm install && npm run build && npm run typecheck && npm test` passed.

Warnings / failures from earlier logs:

- Root install reported 5 moderate npm audit findings.
- Root install warned that `eslint-visitor-keys@5.0.1` requires Node `^20.19.0 || ^22.13.0 || >=24`, while the run used Node `20.11.1`.
- ESLint emitted an `.eslintrc` deprecation warning.
- Next build warned that workspace root inference found multiple lockfiles and selected `/home/user/package-lock.json` rather than only `/home/user/urai-privacy/package-lock.json`.
- `npm run preflight` failed because `scripts/clean-legacy.sh` did not exist.
- Firebase emulator run succeeded, but warned about IPv6 `::1` port checks, functions emulator production-adjacent services not running, Admin SDK config fetch, firebase-functions package age, Node 20 requested while host used Node 18, and failed function definition parsing. The script still exited successfully because the rule/integration tests passed.

Branch response to that evidence:

- Added `scripts/clean-legacy.sh` to restore the missing preflight dependency.
- Added explicit Turbopack root config in `next.config.mjs` to address the Next workspace-root warning from multiple lockfiles.
- Aligned the admin deletion UI with the backend destructive-deletion hard gate.

Latest PR #58 branch verification supplied by operator:

- `npm run preflight` passed on branch `hardening/preview-blockers-2026-05-19`.
- `clean:legacy` passed and removed generated legacy/build artifacts.
- `lint` passed with the known ESLintRC deprecation warning.
- `typecheck` passed.
- `test:unit` passed: 1 file, 8 tests.
- `test:rules:static` passed.
- `test:e2e` route smoke passed.
- `audit:privacy` passed.
- `audit:tier-one` passed.
- `build` passed and prerendered all expected app routes.
- The earlier Next workspace-root warning did not appear in the latest preflight output.
- `npm run test:emulators` passed on the branch: Firestore rules, Storage rules, and integration smoke all passed.
- Functions package `build`, `typecheck`, and `test` passed on the branch.

## Verified current main state before this branch

- PR #57 was merged into `main`.
- `components/AuthGate.tsx` on `main` removes anonymous auto sign-in and replaces public admin email gating with Firebase Auth token claims.
- `app/layout.tsx` on `main` still lacked skip-link markup.
- `app/globals.css` on `main` still lacked visible focus, skip-link, disabled button, and reduced-motion hardening.
- `src/lib/firebase-privacy-client.ts` on `main` still accepted arbitrary collection names in user/admin subscriptions.
- Export jobs exposed Storage paths in the UI but did not provide a short-lived owner-authorized retrieval UX.
- Deletion processing could accept `completed` even though destructive deletion execution was not implemented and verified.

## What changed in this branch

### Hardened AuthGate from PR #57

`components/AuthGate.tsx` removes anonymous auto sign-in and removes the public admin email gate.

New behavior:

- Signed-out users see an explicit sign-in requirement.
- Privacy exports, deletion requests, consent updates, and audit logs require an explicit signed-in account.
- Admin-only routes require Firebase Auth token claims: `admin === true` or `role === "admin"`.
- A public environment variable is no longer accepted as proof of admin authorization.
- Loading, signed-out, forbidden, and error states are explicit.
- Forbidden and error states include accessible alert semantics.

### Added skip-link markup and accessibility styles

`app/layout.tsx` now includes:

- visible skip link targeting `#main-content`,
- `main id="main-content"`,
- `tabIndex={-1}` on the main landmark,
- an explicit brand `aria-label`.

`app/globals.css` now includes:

- visible `:focus-visible` outlines,
- styling for the keyboard skip link,
- disabled button affordance,
- reduced-motion protections for users who request reduced motion.

### Constrained client Firestore subscriptions

`src/lib/firebase-privacy-client.ts` now rejects unsupported user/admin collection names before constructing Firestore queries.

New behavior:

- User-scoped subscriptions are limited to supported user privacy collections.
- Admin subscriptions are limited to known privacy/admin collections.
- Misuse fails loudly with `UNSUPPORTED_PRIVACY_COLLECTION:<name>`.
- Firestore rules remain the source of truth; this is a client-side guardrail, not a substitute for rules.

### Added owner/admin-authorized export download callable and UX

`functions/src/index.ts` now includes `getExportDownloadUrl`, which:

- requires authentication,
- checks the export job exists,
- requires owner or admin access,
- requires the job to be completed,
- validates the export path starts with the expected `exports/{uid}/{jobId}/` prefix,
- returns a 15-minute signed Storage URL,
- writes an audit event when a download URL is created.

`app/privacy-center/export/page.tsx` now retrieves completed exports through the callable instead of exposing raw Storage paths as the retrieval path.

### Hard-gated destructive deletion completion

`functions/src/index.ts` now prevents a deletion request from being applied as `completed` through `processDeletionRequest` while no verified destructive deletion executor exists.

New behavior:

- If an admin requests `completed`, the function applies `processing` instead.
- The deletion request stores `destructiveDeletionBlocked: true` and an explicit reason.
- The audit event records requested status, applied status, plan hash, and the gate.

`app/privacy-center/delete/page.tsx` now clearly states that the user creates an auditable deletion request and that destructive erasure remains hard-gated until the final executor, legal-hold safeguards, retry handling, and release evidence are verified.

`app/admin/privacy-requests/page.tsx` no longer offers a `completed` deletion action and warns admins that completion is unavailable until destructive deletion execution has legal-hold, retry, audit, and release evidence.

### Restored preflight cleanup dependency

`scripts/clean-legacy.sh` now exists and removes generated build/cache artifacts before preflight:

- `.next`
- `out`
- `dist`
- `coverage`
- `.turbo`
- `.firebase`
- Firebase/debug logs
- `*.tsbuildinfo` outside `node_modules`

### Reduced build warning risk

`next.config.mjs` now sets an ESM-safe explicit Turbopack root using `fileURLToPath(import.meta.url)`, reducing the workspace-root inference warning caused by multiple lockfiles in the uploaded verification environment.

## Evidence reviewed

- `package.json` identifies the app as `0.2.0-staging-scaffold` and has a broad preflight command path.
- `functions/package.json` identifies the functions package as `0.2.0-staging-scaffold` with build/typecheck scripts.
- `README.md` identifies the governance version as `0.1.0-draft` and says legal templates/regulatory mappings require qualified legal review before public production launch.
- `functions/src/index.ts` contains callable workflows for export, export download URL, deletion request, deletion hard-gating, consent update, audit logging, and admin health report.
- `app/privacy-center/export/page.tsx`, `delete/page.tsx`, and `consent/page.tsx` provide live authenticated user-facing workflow surfaces.
- `app/admin/privacy-requests/page.tsx` provides operator workflow surfaces, but production use depends on Firebase admin claims and rules evidence.
- `firestore.rules` defines owner/admin read boundaries and append-only audit-style collections.
- `storage.rules` keeps export packages readable by owner/admin and denies unknown Storage paths.
- `tests/rules/firestore.rules.test.ts` has emulator-backed rule tests, and the uploaded log shows the emulator-backed rules test suite passed.

## Production-readiness matrix

| Area | Exists | UX complete | Secure | Accessible | Tested | Production-ready | Notes/blockers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Privacy dashboard | Partial | Partial | Partial | Improved | Verified in repo | No | Routes/build verified; live preview evidence still missing. |
| Consent | Yes | Partial | Partial | Partial | Verified in repo | No | Unit/integration evidence exists; live Firebase proof still missing. |
| Export | Improved | Improved | Improved | Partial | Verified in repo | No | Signed URL retrieval added; needs live expiry/cross-user proof. |
| Deletion | Improved | Improved | Improved | Partial | Verified in repo | No | Request workflow exists; completion is hard-gated until destructive executor is verified. |
| Retention | Partial | Partial | Partial | N/A | Partially verified | No | Retention policies exist; enforcement/live evidence required. |
| Settings | Partial | Partial | Partial | Partial | Verified in repo | No | Consent settings exist; broader privacy settings remain incomplete. |
| Support/contact | Yes | Partial | N/A | Partial | Unverified | No | Static/support docs exist; production contact SLA and legal linkage need evidence. |
| Legal/policy alignment | Partial | Partial | Partial | N/A | Unverified | No | Legal templates require counsel approval. |
| Auth/security | Improved | Partial | Improved | Partial | Verified in repo | No | Anonymous sessions removed; claims/rules need live proof. |
| Admin/operator flows | Improved | Partial | Improved | Partial | Verified in repo | No | Completion action removed; custom claim seeding and operator runbook evidence required. |
| Mobile | Partial | Partial | N/A | Unverified | Unverified | No | Responsive classes exist; device smoke and visual QA missing. |
| Accessibility | Improved | Partial | N/A | Improved | Partially verified | No | Skip link/focus/reduced motion added; manual/automated a11y pass still required. |
| Performance | Partial | Unknown | N/A | N/A | Partially verified | No | Build passed; Lighthouse/Core Web Vitals evidence missing. |
| Tests | Improved | N/A | N/A | N/A | Verified in repo | No | Preflight, emulator, integration, and functions checks passed on PR branch. |
| Release/rollback/monitoring | Partial | N/A | Partial | N/A | Missing | No | No production deployment, monitoring, rollback, or signoff evidence attached. |

## Remaining preview gates

1. Attach Firebase staging env evidence without secrets.
2. Prove Auth provider configuration and admin custom claim seed.
3. Prove Firestore and Storage rules block unauthorized user/admin reads in the target staging environment, not only emulators.
4. Add preview smoke evidence for export request, export download URL, deletion request, consent update, admin denied, and admin allowed flows.

## P1 must fix before production

1. Implement the production destructive deletion executor with legal-hold safeguards, dry-run support, retry/error handling, audit evidence, and tests.
2. Prove export download access controls, signed URL expiry, owner/admin behavior, and cross-user denial in emulator/live smoke.
3. Attach counsel-approved privacy policy, retention schedule, subprocessors, deletion workflow, and support/privacy contacts.
4. Add monitoring/error reporting and incident-response routing.
5. Record rollback SHA/path and owner/legal/security signoffs.
6. Address or explicitly accept the 5 moderate root npm audit findings.
7. Resolve the Node engine mismatch and Firebase emulator function-definition warning before production release.

## P2 AAA polish

1. Upgrade privacy center UI with richer empty/error/success states, progress timelines, and receipt copy.
2. Add reduced-motion and keyboard/focus QA evidence.
3. Add mobile-specific screenshots and route smoke reports.
4. Improve admin queue sorting/filtering and operator notes.
5. Add clear user explanations for retained audit/legal-hold data.

## P3 future enhancements

1. Policy version diff viewer.
2. User-facing export manifest browser.
3. Privacy health trend dashboard.
4. Cross-repo adoption status registry.
5. Automated legal template freshness reminders.

## Required verification commands

Repo checks passed on this branch according to operator-supplied output:

```bash
npm run preflight
npm run check:java
npm run test:emulators
```

Function package checks passed on this branch according to operator-supplied output:

```bash
cd functions
npm run build
npm run typecheck
npm test
```

## Release decision

PR #58 is repo-verification-ready for merge review. Do not deploy this repo as production from this branch alone. Production remains blocked until legal, Firebase staging/live smoke, monitoring, rollback, destructive deletion executor, npm audit disposition, and signoff evidence are complete.
