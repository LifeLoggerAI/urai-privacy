# Firebase Setup

## Files added

- `firebase.json`
- `.firebaserc.example`
- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`
- `functions/package.json`
- `functions/tsconfig.json`
- `functions/src/index.ts`

## Project IDs

Copy `.firebaserc.example` to `.firebaserc` locally and replace example IDs with real staging/production Firebase project IDs. Do not commit real project IDs unless the release process explicitly approves them.

## Firestore collections

The scaffold uses these production-facing collections:

- `users`
- `privacyRequests`
- `exportJobs`
- `deletionRequests`
- `consentRecords`
- `retentionPolicies`
- `auditLogs`
- `adminActions`
- `dataAccessEvents`
- `policyVersions`

## Authorization model

Firestore and Functions recognize admins through either:

1. Firebase Auth custom claim: `admin: true`
2. `users/{uid}.role == "admin"`

Users can read their own privacy data. Admins can review privacy operations. Audit logs and policy history are immutable by rule.

## Storage model

- `exports/{uid}/...` is readable by that user or an admin and writable only by admins/functions.
- `evidence/...` is admin-only.
- Fallback storage paths deny read/write.

## Functions implemented

- `createExportRequest`
- `processExportRequest`
- `createDeletionRequest`
- `processDeletionRequest`
- `updateConsent`
- `writeAuditLog`
- `recordAdminAction`
- `getPrivacyHealthReport`

## Remaining Firebase blockers

- Full emulator-backed security rules tests.
- Real Firebase project configuration.
- Callable function UI integration.
- Storage export package writer.
- Production deployment evidence.
