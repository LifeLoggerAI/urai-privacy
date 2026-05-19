# AAA Privacy Production Audit - 2026-05-19

Branch: `audit/aaa-privacy-hardening-2026-05-19`
Repo: `LifeLoggerAI/urai-privacy`

## Launch verdict

- LAUNCH VERDICT: NO
- CONFIDENCE: 70 percent repo-side confidence, pending clean checkout verification and Firebase environment evidence
- MOST IMPORTANT BLOCKER: Production identity, admin authorization, legal approval, live Firebase evidence, and destructive deletion execution are not fully proven.

This audit does not mark the repo production-ready. The repository still identifies itself as a staging scaffold / operational draft governance package, and the runtime must prove clean install, lint, typecheck, tests, rules, build, Firebase deploy, legal review, admin custom claims, monitoring, rollback, and live smoke before production launch.

## What changed in this branch

### Hardened AuthGate

`components/AuthGate.tsx` was changed to remove anonymous auto sign-in and remove the public admin email gate.

New behavior:

- Signed-out users see an explicit sign-in requirement.
- Privacy exports, deletion requests, consent updates, and audit logs require an explicit signed-in account.
- Admin-only routes require Firebase Auth token claims: `admin === true` or `role === "admin"`.
- A public environment variable is no longer accepted as proof of admin authorization.
- Loading, signed-out, forbidden, and error states are explicit.
- Forbidden and error states include accessible alert semantics.

### Constrained client Firestore subscriptions

`src/lib/firebase-privacy-client.ts` now rejects unsupported user/admin collection names before constructing Firestore queries.

New behavior:

- User-scoped subscriptions are limited to supported user privacy collections.
- Admin subscriptions are limited to known privacy/admin collections.
- Misuse fails loudly with `UNSUPPORTED_PRIVACY_COLLECTION:<name>`.
- Firestore rules remain the source of truth; this is a client-side guardrail, not a substitute for rules.

### Improved global accessibility styles

`app/globals.css` now includes:

- visible `:focus-visible` outlines,
- styling for a keyboard skip link,
- disabled button affordance,
- reduced-motion protections for users who request reduced motion.

Note: the matching root-layout skip-link markup patch was blocked by the GitHub connector safety layer during this audit session. The CSS is ready, but `app/layout.tsx` still needs the skip-link anchor and `main` target in a follow-up commit.

## Evidence reviewed

- `package.json` identifies the app as `0.2.0-staging-scaffold` and has a broad preflight command path.
- `README.md` identifies the governance version as `0.1.0-draft` and says legal templates/regulatory mappings require qualified legal review before public production launch.
- `components/AuthGate.tsx` previously signed in anonymously and used `NEXT_PUBLIC_URAI_ADMIN_EMAIL` for admin route access.
- `functions/src/index.ts` contains real callable workflows for export, deletion request, consent update, audit logging, and admin health report.
- `functions/src/index.ts` deletion processing creates a deletion plan and marks the user for deletion; it does not perform final destructive deletion.
- `app/privacy-center/export/page.tsx`, `delete/page.tsx`, and `consent/page.tsx` provide live authenticated user-facing workflow surfaces.
- `app/admin/privacy-requests/page.tsx` provides operator workflow surfaces, but production use depends on Firebase admin claims and rules evidence.
- `firestore.rules` defines owner/admin read boundaries and append-only audit-style collections.
- `tests/rules/firestore.rules.test.ts` has emulator-backed rule tests, but they still need clean-run evidence from a local or CI environment.

## Production-readiness matrix

| Area | Exists | UX complete | Secure | Accessible | Tested | Production-ready | Notes/blockers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Privacy dashboard | Partial | Partial | Partial | Partial | Unverified | No | Core pages exist, but production evidence and live smoke are missing. |
| Consent | Yes | Partial | Partial | Partial | Unverified | No | Callable exists and UI exists; needs rules/emulator and end-to-end evidence. |
| Export | Yes | Partial | Partial | Partial | Unverified | No | Callable writes export package/manifest, but access/expiry/download UX and live verification remain required. |
| Deletion | Partial | Partial | Partial | Partial | Unverified | No | Request and admin plan exist; final destructive executor is not complete. |
| Retention | Partial | Partial | Partial | N/A | Unverified | No | Retention policies exist in code/docs; enforcement evidence required. |
| Settings | Partial | Partial | Partial | Partial | Unverified | No | Consent settings exist; broader privacy settings remain incomplete. |
| Support/contact | Yes | Partial | N/A | Partial | Unverified | No | Static/support docs exist; production contact SLA and legal linkage need evidence. |
| Legal/policy alignment | Partial | Partial | Partial | N/A | Unverified | No | Legal templates require counsel approval. |
| Auth/security | Improved | Partial | Partial | Partial | Unverified | No | This branch removes anonymous privacy sessions and public email admin proof, but rules/claims must be verified. |
| Admin/operator flows | Partial | Partial | Partial | Partial | Unverified | No | Admin pages exist; custom claim seeding and operator runbook evidence required. |
| Mobile | Partial | Partial | N/A | Unverified | Unverified | No | Responsive classes exist; device smoke and visual QA missing. |
| Accessibility | Improved | Partial | N/A | Partial | Unverified | No | Focus/reduced-motion CSS improved; root skip-link markup still needs to land. |
| Performance | Unknown | Unknown | N/A | N/A | Unverified | No | Next build and Lighthouse evidence missing. |
| Tests | Partial | N/A | N/A | N/A | Unverified | No | Scripts and rule tests exist; this branch needs clean-run evidence. |
| Release/rollback/monitoring | Partial | N/A | Partial | N/A | Missing | No | Release scripts exist; no production deployment, monitoring, rollback, or signoff evidence attached. |

## P0 must fix before preview

1. Run clean checkout validation: install, lint, typecheck, unit tests, rules static/emulated tests, smoke routes, audits, build.
2. Attach Firebase staging env evidence without secrets.
3. Prove Auth provider configuration and admin custom claim seed.
4. Prove Firestore and Storage rules block unauthorized user/admin reads.
5. Add preview smoke evidence for export, deletion request, consent update, admin denied, and admin allowed flows.
6. Add skip-link markup in `app/layout.tsx` to pair with the new `.skip-link` styles.

## P1 must fix before production

1. Implement or explicitly gate final destructive deletion executor with legal-hold safeguards and audit evidence.
2. Implement export download access controls, expiry, and user-facing retrieval path.
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

## Release decision

Do not deploy this repo as production from this branch alone. Merge only after clean command evidence is attached, then continue preview hardening. Production remains blocked until legal, Firebase, monitoring, rollback, and smoke evidence are complete.
