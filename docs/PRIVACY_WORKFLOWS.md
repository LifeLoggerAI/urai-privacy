# Privacy Workflows

Last updated: 2026-05-10

## Export request

1. Authenticated user opens `/privacy-center/export`.
2. User creates an export request through `createExportRequest`.
3. System writes:
   - `privacyRequests/{requestId}`
   - `exportJobs/{jobId}`
   - `auditLogs/{auditId}` with `export_request_created`
4. Admin or trusted backend process calls `processExportRequest`.
5. Export job moves to `completed` or `failed`.
6. Export metadata points to `exports/{uid}/{jobId}/manifest.json`.

Current scaffold behavior: function records metadata and manifest path. Actual ZIP/package generation and signed URL expiration are remaining implementation work.

## Deletion request

1. Authenticated user opens `/privacy-center/delete`.
2. User creates a deletion request through `createDeletionRequest`.
3. System writes:
   - `deletionRequests/{requestId}`
   - `auditLogs/{auditId}` with `deletion_request_created`
4. Admin reviews request in `/admin/privacy-requests`.
5. Admin or trusted backend process calls `processDeletionRequest`.
6. Request transitions through `approved`, `processing`, `completed`, `rejected`, or `failed`.
7. When processing/completed, `users/{uid}` is marked with `markedForDeletion` and `deletionMarkedAt`.

Current scaffold behavior: marks the user for deletion and records the request/audit trail. Actual destructive deletion jobs, legal-hold checks, and backup expiry tracking remain production blockers.

## Consent update

1. Authenticated user opens `/privacy-center/consent`.
2. User updates a purpose/tier/status through `updateConsent`.
3. System writes or merges `consentRecords/{uid}_{purpose}`.
4. System writes `auditLogs/{auditId}` with `consent_updated`.

## Audit logging

Every sensitive action must write an audit log with:

- `actorUid`
- `actorRole`
- `action`
- `targetUid`
- `timestamp`
- `requestId` when applicable
- `metadata`
- `source`

Firestore rules make audit logs append-only by denying update and delete.

## Admin review

Admin routes require admin custom claim or role document:

- `/admin`
- `/admin/privacy-requests`
- `/admin/audit-log`
- `/admin/retention`
- `/admin/policies`

Current scaffold behavior: pages render typed workflow previews and admin-only intent. Live Firebase reads/writes from the UI remain a blocker.

## Retention

Retention policies are represented in TypeScript defaults and `retentionPolicies` Firestore collection. Production cleanup jobs must be added before production readiness.

## Policy publishing

Policy versions are readable publicly. Published historical policy versions must remain immutable. Admin publishing actions must write `policy_version_changed` audit evidence.
