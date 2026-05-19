# AAA Privacy Production Audit - 2026-05-19

Branch: `hardening/preview-blockers-2026-05-19`
Repo: `LifeLoggerAI/urai-privacy`

## Launch verdict

- LAUNCH VERDICT: NO
- CONFIDENCE: 73 percent repo-side confidence, pending clean checkout verification and Firebase environment evidence
- MOST IMPORTANT BLOCKER: Live Firebase staging evidence, clean command evidence, legal approval, monitoring/rollback evidence, and a verified destructive deletion executor are still missing.

This audit does not mark the repo production-ready. The repository still identifies itself as a staging scaffold / operational draft governance package, and the runtime must prove clean install, lint, typecheck, tests, rules, build, Firebase deploy, legal review, admin custom claims, monitoring, rollback, and live smoke before production launch.

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

## Evidence reviewed

- `package.json` identifies the app as `0.2.0-staging-scaffold` and has a broad preflight command path.
- `functions/package.json` identifies the functions package as `0.2.0-staging-scaffold` with build/typecheck scripts.
- `README.md` identifies the governance version as `0.1.0-draft` and says legal templates/regulatory mappings require qualified legal review before public production launch.
- `functions/src/index.ts` contains callable workflows for export, export download URL, deletion request, deletion hard-gating, consent update, audit logging, and admin health report.
- `app/privacy-center/export/page.tsx`, `delete/page.tsx`, and `consent/page.tsx` provide live authenticated user-facing workflow surfaces.
- `app/admin/privacy-requests/page.tsx` provides operator workflow surfaces, but production use depends on Firebase admin claims and rules evidence.
- `firestore.rules` defines owner/admin read boundaries and append-only audit-style collections.
- `storage.rules` keeps export packages readable by owner/admin and denies unknown Storage paths.
- `tests/rules/firestore.rules.test.ts` has emulator-backed rule tests, but they still need clean-run evidence from a local or CI environment.

## Production-readiness matrix

| Area | Exists | UX complete | Secure | Accessible | Tested | Production-ready | Notes/blockers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Privacy dashboard | Partial | Partial | Partial | Improved | Unverified | No | Core pages exist, but production evidence and live smoke are missing. |
| Consent | Yes | Partial | Partial | Partial | Unverified | No | Callable exists and UI exists; needs rules/emulator and end-to-end evidence. |
| Export | Improved | Improved | Improved | Partial | Unverified | No | Signed URL retrieval added; needs emulator/live proof and expiry smoke. |
| Deletion | Improved | Improved | Improved | Partial | Unverified | No | Request workflow exists; completion is hard-gated until destructive executor is verified. |
| Retention | Partial | Partial | Partial | N/A | Unverified | No | Retention policies exist in code/docs; enforcement evidence required. |
| Settings | Partial | Partial | Partial | Partial | Unverified | No | Consent settings exist; broader privacy settings remain incomplete. |
| Support/contact | Yes | Partial | N/A | Partial | Unverified | No | Static/support docs exist; production contact SLA and legal linkage need evidence. |
| Legal/policy alignment | Partial | Partial | Partial | N/A | Unverified | No | Legal templates require counsel approval. |
| Auth/security | Improved | Partial | Improved | Partial | Unverified | No | Anonymous privacy sessions removed and claim-based admin check exists; claims/rules need live proof. |
| Admin/operator flows | Partial | Partial | Partial | Partial | Unverified | No | Admin pages exist; custom claim seeding and operator runbook evidence required. |
| Mobile | Partial | Partial | N/A | Unverified | Unverified | No | Responsive classes exist; device smoke and visual QA missing. |
| Accessibility | Improved | Partial | N/A | Improved | Unverified | No | Skip link, focus, disabled states, and reduced-motion CSS added; manual/automated a11y pass still required. |
| Performance | Unknown | Unknown | N/A | N/A | Unverified | No | Next build and Lighthouse evidence missing. |
| Tests | Partial | N/A | N/A | N/A | Unverified | No | Scripts and rule tests exist; this branch needs clean-run evidence. |
| Release/rollback/monitoring | Partial | N/A | Partial | N/A | Missing | No | Release scripts exist; no production deployment, monitoring, rollback, or signoff evidence attached. |

## P0 must fix before preview

1. Run clean checkout validation: install, lint, typecheck, unit tests, rules static/emulated tests, smoke routes, audits, build.
2. Attach Firebase staging env evidence without secrets.
3. Prove Auth provider configuration and admin custom claim seed.
4. Prove Firestore and Storage rules block unauthorized user/admin reads.
5. Add preview smoke evidence for export request, export download URL, deletion request, consent update, admin denied, and admin allowed flows.
6. Confirm the admin deletion UI no longer implies destructive completion once this branch is reviewed; backend completion is already hard-gated.

## P1 must fix before production

1. Implement the production destructive deletion executor with legal-hold safeguards, dry-run support, retry/error handling, audit evidence, and tests.
2. Prove export download access controls, signed URL expiry, owner/admin behavior, and cross-user denial in emulator/live smoke.
3. Attach counsel-approved privacy policy, retention schedule, subprocessors, deletion workflow, and support/privacy contacts.
4. Add monitoring/error reporting and incident-response routing.
5. Record rollback SHA/path and owner/legal/security signoffs.

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

Do not deploy this repo as production from this branch alone. Merge only after clean command evidence is attached, then continue preview hardening. Production remains blocked until legal, Firebase, monitoring, rollback, destructive deletion executor, and smoke evidence are complete.
