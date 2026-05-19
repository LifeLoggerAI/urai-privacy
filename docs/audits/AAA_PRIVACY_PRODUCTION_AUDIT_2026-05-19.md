# AAA Privacy Production Audit - 2026-05-19

Branch: `hardening/preview-blockers-2026-05-19`
Repo: `LifeLoggerAI/urai-privacy`

## Launch verdict

- LAUNCH VERDICT: NO
- CONFIDENCE: 82 percent repo-side confidence after uploaded verification evidence, pending PR #58 re-run after restoring `scripts/clean-legacy.sh`, Firebase staging evidence, legal approval, monitoring/rollback evidence, and a verified destructive deletion executor.
- MOST IMPORTANT BLOCKER: `npm run preflight` previously failed because `scripts/clean-legacy.sh` was referenced but missing. This branch restores that script, but preflight still needs to be re-run on the updated branch.

This audit does not mark the repo production-ready. It does show that the repo is much closer to preview readiness: the uploaded verification log shows lint, typecheck, unit tests, static rules, route smoke, privacy audit, tier-one audit, Next build, Java check, emulator-backed rules/integration, and functions build/typecheck all passed before the preflight cleanup-script failure. Production still requires Firebase deploy/staging evidence, legal review, admin custom claim proof, monitoring, rollback, live smoke, and a verified destructive deletion executor.

## Uploaded verification evidence from 2026-05-19

Passing in the uploaded log:

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

Warnings / failures from the uploaded log:

- Root install reported 5 moderate npm audit findings.
- Root install warned that `eslint-visitor-keys@5.0.1` requires Node `^20.19.0 || ^22.13.0 || >=24`, while the run used Node `20.11.1`.
- ESLint emitted an `.eslintrc` deprecation warning.
- Next build warned that workspace root inference found multiple lockfiles and selected `/home/user/package-lock.json` rather than only `/home/user/urai-privacy/package-lock.json`.
- `npm run preflight` failed because `scripts/clean-legacy.sh` did not exist.
- Firebase emulator run succeeded, but warned about IPv6 `::1` port checks, functions emulator production-adjacent services not running, Admin SDK config fetch, firebase-functions package age, Node 20 requested while host used Node 18, and failed function definition parsing. The script still exited successfully because the rule/integration tests passed.

Branch response to that evidence:

- Added `scripts/clean-legacy.sh` to restore the missing preflight dependency.
- Preflight must be re-run on this branch after the script addition.

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
| Privacy dashboard | Partial | Partial | Partial | Improved | Partially verified | No | Routes/build verified; live preview evidence still missing. |
| Consent | Yes | Partial | Partial | Partial | Partially verified | No | Unit/integration evidence exists; live Firebase proof still missing. |
| Export | Improved | Improved | Improved | Partial | Partially verified | No | Signed URL retrieval added; needs branch re-run and live expiry/cross-user proof. |
| Deletion | Improved | Improved | Improved | Partial | Partially verified | No | Request workflow exists; completion is hard-gated until destructive executor is verified. |
| Retention | Partial | Partial | Partial | N/A | Partially verified | No | Retention policies exist; enforcement/live evidence required. |
| Settings | Partial | Partial | Partial | Partial | Partially verified | No | Consent settings exist; broader privacy settings remain incomplete. |
| Support/contact | Yes | Partial | N/A | Partial | Unverified | No | Static/support docs exist; production contact SLA and legal linkage need evidence. |
| Legal/policy alignment | Partial | Partial | Partial | N/A | Unverified | No | Legal templates require counsel approval. |
| Auth/security | Improved | Partial | Improved | Partial | Partially verified | No | Anonymous sessions removed; claims/rules need live proof. |
| Admin/operator flows | Partial | Partial | Partial | Partial | Partially verified | No | Admin pages exist; custom claim seeding and operator runbook evidence required. |
| Mobile | Partial | Partial | N/A | Unverified | Unverified | No | Responsive classes exist; device smoke and visual QA missing. |
| Accessibility | Improved | Partial | N/A | Improved | Partially verified | No | Skip link/focus/reduced motion added; manual/automated a11y pass still required. |
| Performance | Partial | Unknown | N/A | N/A | Partially verified | No | Build passed; Lighthouse/Core Web Vitals evidence missing. |
| Tests | Improved | N/A | N/A | N/A | Partially verified | No | Most checks passed; preflight needs re-run after cleanup script restoration. |
| Release/rollback/monitoring | Partial | N/A | Partial | N/A | Missing | No | No production deployment, monitoring, rollback, or signoff evidence attached. |

## P0 must fix before preview

1. Re-run `npm run preflight` on this branch after `scripts/clean-legacy.sh` was restored.
2. Attach Firebase staging env evidence without secrets.
3. Prove Auth provider configuration and admin custom claim seed.
4. Prove Firestore and Storage rules block unauthorized user/admin reads in the target staging environment, not only emulators.
5. Add preview smoke evidence for export request, export download URL, deletion request, consent update, admin denied, and admin allowed flows.
6. Confirm the admin deletion UI no longer implies destructive completion once this branch is reviewed; backend completion is already hard-gated.

## P1 must fix before production

1. Implement the production destructive deletion executor with legal-hold safeguards, dry-run support, retry/error handling, audit evidence, and tests.
2. Prove export download access controls, signed URL expiry, owner/admin behavior, and cross-user denial in emulator/live smoke.
3. Attach counsel-approved privacy policy, retention schedule, subprocessors, deletion workflow, and support/privacy contacts.
4. Add monitoring/error reporting and incident-response routing.
5. Record rollback SHA/path and owner/legal/security signoffs.
6. Address or explicitly accept the 5 moderate root npm audit findings.
7. Resolve the Node engine mismatch and Next workspace-root warning before production release.

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

Run from a clean checkout before merging:

```bash
npm install
npm run lint
npm run typecheck
npm run test:unit
npm run test:rules:static
npm run test:smoke
npm run audit:privacy
npm run audit:tier-one
npm run build
npm run preflight
```

Run with emulators when Java/Firebase tools are available:

```bash
npm run check:java
npm run test:emulators
```

Run function package checks:

```bash
cd functions
npm install
npm run build
npm run typecheck
npm test
```

## Release decision

Do not deploy this repo as production from this branch alone. Merge only after preflight is re-run successfully on this branch and Firebase staging evidence is attached. Production remains blocked until legal, Firebase, monitoring, rollback, destructive deletion executor, live smoke, npm audit disposition, and signoff evidence are complete.
