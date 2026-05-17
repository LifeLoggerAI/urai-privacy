# URAI Privacy Production Readiness

This document is the release operator checklist for `LifeLoggerAI/urai-privacy`.

## Firebase project

The code release gate verifies Firebase configuration files are present and internally consistent:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `functions/package.json`
- `functions/src/index.ts`

Before any live deploy, the operator must confirm the intended Firebase project ID, hosting target, and environment variables outside the repository. Do not deploy production when the Firebase project or hosting target is uncertain.

## Required environment variables

Public client variables are documented in `.env.example`. Real values must be set in local `.env.local` or hosting configuration and must not be committed.

Required public Firebase variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional:

- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_URAI_ADMIN_EMAIL`

Admin UI gating is not a substitute for Firebase Auth custom claims or Firestore/Storage rules.

## Verification command

Run:

```bash
export JAVA_HOME="$HOME/.local/java"
export PATH="$JAVA_HOME/bin:$PATH"
npm run verify:release
```

The release gate covers:

- deterministic install
- lint
- typecheck
- unit tests
- static rules validation
- route smoke validation
- Next production build
- Functions build and typecheck
- emulator-backed Firestore and Storage rules tests
- security gate
- production readiness assertions

## Smoke test plan

After staging deploy, verify:

1. `/` renders.
2. `/privacy` renders policy-level privacy surface.
3. `/privacy-center` renders owner privacy center.
4. `/privacy-center/export` creates or displays export request flow without demo-only data.
5. `/privacy-center/delete` creates or displays deletion request flow without bypassing auth.
6. `/privacy-center/consent` displays consent controls.
7. `/privacy-center/audit-log` displays user-visible audit evidence.
8. `/admin/privacy-requests` requires admin access.
9. `/admin/audit-log` requires admin access.
10. Unknown routes fall back safely.

## Security validation

Required before production:

- Firestore rules deny unknown collections.
- Storage rules deny unknown paths.
- Audit logs are append-only.
- Storage export and evidence objects are not delete-open.
- User paths are owner- or admin-scoped.
- Admin authority is enforced by custom claims or verified role documents.
- No service account JSON, private keys, Firebase private keys, or credentials are committed.

## Rollback

Rollback must be available before deploy:

1. Identify last known-good Git commit.
2. Re-run `npm run verify:release` on last known-good commit if practical.
3. Re-deploy hosting/functions/rules from last known-good commit.
4. Confirm smoke test plan passes.
5. Record incident, deploy SHA, rollback SHA, and user impact.

## Live deployment status

This repository-level gate can verify code readiness, but it does not prove live production readiness by itself. Production remains blocked until a human operator verifies:

- correct Firebase project
- correct hosting target
- correct env/secrets
- branch protection/CI status
- staging smoke test evidence
- rollback target
- production deploy authorization
