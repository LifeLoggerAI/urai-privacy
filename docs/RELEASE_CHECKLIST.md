# Release Checklist

Last updated: 2026-05-10

## Local verification

Run:

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run test:rules
npm run test:e2e
npm run build
python tools/run_validation.py
bash scripts/verify-release.sh
```

Do not mark staging-ready unless every command passes in a clean checkout.

## Firebase verification

Run after Firebase CLI and project setup:

```bash
firebase emulators:start
npm run test:emulators
```

Before production, add real emulator-backed assertions for:

- user can read own records
- user cannot read another user’s records
- user can create own pending export/deletion request
- user cannot approve own request as admin
- admin can update request status
- audit logs cannot be updated or deleted
- policy versions cannot be deleted
- export storage paths are user/admin scoped
- evidence vault is admin-only

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

**NOT READY** until the verifier and Firebase emulator/deploy evidence are actually run and recorded.
