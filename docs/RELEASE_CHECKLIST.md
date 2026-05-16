# Release Checklist

Last updated: 2026-05-16

## Local verification

Run:

```bash
npm install
npm run lint
npm run typecheck
npm run test:unit
npm run test:rules:static
npm run test:e2e
npm run build
python tools/run_validation.py
```

Do not mark staging-ready unless every command passes in a clean checkout and results are recorded.

## Firebase emulator verification

The repo now includes emulator-backed Firestore, Storage, and callable Functions tests.

Run after Firebase CLI and project setup:

```bash
firebase emulators:exec --only auth,firestore,storage,functions "npm run test:emulators"
```

The emulator-backed rules suite covers:

- user can read own records
- user cannot read another user’s records
- user can create own pending export/deletion request
- user cannot approve own request as admin
- admin can update request status
- audit logs cannot be updated or deleted
- anonymous access is denied
- deny-default unknown Firestore paths are denied
- export storage paths are user/admin scoped
- evidence vault is admin-only
- storage deletes are denied
- deny-default unknown Storage paths are denied

The callable Functions integration suite covers:

- unauthenticated users cannot create export requests
- authenticated users can create export requests
- authenticated users can update consent
- authenticated users can create deletion requests
- non-admin users cannot call admin-only functions
- admins can read privacy health reports
- admins can process existing export jobs
- admins can process existing deletion requests

## Release verifier

Run the combined verifier only when Firebase emulators are available:

```bash
bash scripts/verify-release.sh
```

The verifier now runs unit tests, static rules checks, route smoke checks, emulator-backed Firestore/Storage rules tests, callable Functions integration tests, security gate, production-readiness assertions, and the Next.js build.

## Staging release gate

Staging may be considered only after:

- verifier passes
- CI passes
- Firebase emulator tests pass
- staging Firebase project is configured
- callable functions deploy to staging
- privacy center can create real requests
- admin console can update real request statuses
- audit logs are written for every sensitive action
- emulator and staging evidence are recorded in `docs/URAI_PRIVACY_PRODUCTION_VERIFICATION.md`

## Production release gate

Production requires everything in staging plus:

- production Firebase project configured
- production deploy evidence recorded
- post-deploy smoke tests recorded
- legal review status documented
- data export package expiry behavior verified
- deletion workflow destructive behavior verified with legal-hold safeguards
- incident rollback plan verified
- `docs/LOCK.md` created with exact commit, Node/npm, Firebase CLI, command results, staging URL, production URL, and approver

## Current verdict

**NOT READY** until the verifier, Firebase emulator tests, staging deploy, production deploy, legal review, and production lock evidence are actually run and recorded.