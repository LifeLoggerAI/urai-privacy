# URAI Privacy Workflows

Status: **staging hardening**

This document defines the operational workflows that `urai-privacy` must support before production launch.

## Workflow principles

1. No privacy workflow is considered complete unless it is authenticated, authorized, audited, tested, and documented.
2. User-facing rights flows must work from the Privacy Center, not only through support email.
3. Admin/system actions must be least-privilege and immutable-audited.
4. Sensitive processing must not silently escalate beyond the user's consent tier.
5. Export, deletion, and consent revocation must be operational actions, not policy-only promises.

## Consent workflow

### User action

1. User opens `/privacy-center/consent`.
2. User chooses a purpose and consent tier.
3. User grants, denies, or revokes consent.
4. Client calls `updateConsent`.
5. Function validates auth and input.
6. Function writes/updates `consentRecords/{uid}_{purpose}`.
7. Function appends `consentEvents/{eventId}`.
8. Function writes an immutable audit log.
9. UI shows status, policy version, timestamp, and receipt hash.

### Required records

- `consentRecords`
- `consentEvents`
- `auditLogs`

### Production requirements

- Every Tier 2 passive context process checks active consent before processing.
- Every Tier 3 sensitive relationship/emotional inference checks heightened consent before processing.
- Revocation prevents future processing and triggers downstream stop/delete/anonymize logic where required.

## Export workflow

### User action

1. User opens `/privacy-center/export`.
2. User requests a data export.
3. Client calls `createExportRequest`.
4. Function creates `privacyRequests` and `exportJobs` records.
5. Function writes audit evidence.
6. Admin/system processor calls `processExportRequest`.
7. Processor collects user-scoped records, redacts secrets, writes export JSON to Storage, writes manifest JSON to Storage, and updates job/request status.
8. User sees status and, when enabled, secure download access.

### Required records

- `privacyRequests`
- `exportJobs`
- `auditLogs`
- Storage path: `exports/{uid}/{jobId}/export.json`
- Storage path: `exports/{uid}/{jobId}/manifest.json`

### Production requirements

- Export artifacts are private.
- Export artifacts include checksums and manifest metadata.
- Export artifacts expire or can be revoked.
- Export process is idempotent and retry-safe.

## Deletion workflow

### User action

1. User opens `/privacy-center/delete`.
2. User submits a deletion request with a reason/confirmation.
3. Client calls `createDeletionRequest`.
4. Function writes `deletionRequests` and audit evidence.
5. Admin/system processor reviews legal hold and safety/security-retention exceptions.
6. Processor generates a deletion plan and plan hash.
7. Processor runs dry-run validation.
8. Processor executes destructive deletion only when authorized.
9. Processor records retained, deleted, anonymized, and skipped categories.
10. Processor writes immutable audit evidence.

### Required records

- `deletionRequests`
- `auditLogs`
- retained legal/security records where applicable

### Production requirements

- Legal hold must block destructive deletion when required.
- Audit logs, policy versions, admin actions, and security records may be retained when law/security requires.
- Deletion execution must be idempotent and retry-safe.
- User must be able to see status.

## Audit workflow

### System action

1. Any sensitive user-rights, admin, export, deletion, consent, retention, policy, or system-security action calls the audit logger.
2. Audit record includes actor, role, action, target user, request ID, source, metadata, timestamp, and integrity hash where available.
3. Audit records are immutable by client rules.
4. Users may view their own relevant privacy ledger entries.
5. Admins may view operational audit entries through admin routes.

### Required records

- `auditLogs`
- `adminActions` when the actor is an admin

### Production requirements

- Audit records cannot be modified or deleted by clients.
- Admin access to audit logs is itself auditable.
- Sensitive metadata must be minimized and must not include secrets.

## Retention workflow

### System action

1. Retention policies define collection, retention class, time window, and legal hold behavior.
2. Retention jobs identify expired data.
3. Jobs delete, anonymize, or retain records according to policy.
4. Jobs write audit evidence.
5. Admin console shows retention health and exceptions.

### Required records

- `retentionPolicies`
- `auditLogs`

### Production requirements

- Retention jobs must be dry-run capable.
- Retention exceptions must be explainable.
- Policy changes must be versioned and audited.

## Admin workflow

### Admin action

1. Admin authenticates with admin claims or admin role.
2. Admin opens `/admin` routes.
3. Admin reviews privacy requests, audit logs, retention state, and policy versions.
4. Admin actions call admin-only callable Functions.
5. Every action writes `adminActions` and/or `auditLogs`.

### Production requirements

- Non-admin users are denied by route guards, Functions, and rules.
- Admin actions require notes for sensitive operations.
- Admin access is visible in audit evidence.

## Incident workflow

1. Security/privacy incident is detected.
2. Incident record is created in the appropriate server-only collection.
3. Affected systems and data classes are identified.
4. Retainment, breach notification, and remediation duties are assessed.
5. Incident is closed only after mitigation and review evidence are complete.

## Workflow test matrix

| Workflow | Unit | Emulator | E2E | Deployment smoke |
|---|---:|---:|---:|---:|
| Consent update | Required | Required | Required | Required |
| Export request | Required | Required | Required | Required |
| Export processing | Required | Required | Optional admin/system | Required |
| Deletion request | Required | Required | Required | Required |
| Deletion processing | Required | Required | Optional admin/system | Required |
| Audit logging | Required | Required | Required | Required |
| Admin access | Required | Required | Required | Required |
| Retention policy | Required | Recommended | Recommended | Required |
