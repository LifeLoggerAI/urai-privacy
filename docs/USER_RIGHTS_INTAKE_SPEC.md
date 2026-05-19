# URAI User Rights Intake Specification

Status: **staging hardening**

This specification defines how URAI receives, validates, tracks, fulfills, and audits user privacy-rights requests.

## Supported request types

| Request type | User route | Backend record | Callable Function | Status |
|---|---|---|---|---|
| Data export | `/privacy-center/export` | `privacyRequests`, `exportJobs` | `createExportRequest`, `processExportRequest` | staging |
| Account/data deletion | `/privacy-center/delete` | `deletionRequests` | `createDeletionRequest`, `processDeletionRequest` | staging |
| Consent update | `/privacy-center/consent` | `consentRecords`, `consentEvents` | `updateConsent` | staging |
| Audit access | `/privacy-center/audit-log` | `auditLogs` | read/query path TBD | staging |
| Retention explanation | `/privacy-center/retention` | `retentionPolicies` | read/query path TBD | staging |

## Intake channels

Primary channel:

1. Authenticated Privacy Center route.
2. Firebase callable Function.
3. Firestore request/status records.
4. Immutable audit log.

Fallback/manual channel:

1. Support receives privacy-rights request.
2. Support verifies account ownership using approved support procedure.
3. Admin creates or updates the appropriate request in the admin console.
4. Admin action is recorded and audited.

## Identity and authorization requirements

### Authenticated users

- Request must include Firebase Auth context.
- Request UID must match target UID unless actor is admin/system.
- User-created requests may only target the requesting user.

### Admin users

- Admin status must be proven by custom claim or trusted server-side role lookup.
- Admin access must be least-privilege.
- Admin action must be recorded in `adminActions` and/or `auditLogs`.

### Unauthenticated requests

Unauthenticated requests are not fulfilled directly. They must go through a manual verification process before any user data is disclosed, deleted, or changed.

## Request status model

Allowed statuses:

- `pending`
- `approved`
- `processing`
- `completed`
- `rejected`
- `failed`

Status rules:

1. User-created requests begin as `pending`.
2. Admin/system processors may transition to `approved` or `processing`.
3. `completed`, `rejected`, and `failed` are terminal unless reopened by an approved admin workflow.
4. Every status change must update `updatedAt` and write audit evidence.

## Data export intake

Required input:

- Authenticated user context.

Created records:

- `privacyRequests/{requestId}` with `type: export`.
- `exportJobs/{jobId}` linked by `requestId`.
- `auditLogs/{auditId}` with action `export_request_created`.

Processing output:

- Private Storage export JSON.
- Private Storage manifest JSON.
- Manifest checksum.
- Export checksum.
- Record count.
- Completed request/job status.
- Audit action `export_processed`.

User-visible status:

- Request status.
- Created/updated timestamps.
- Record count when complete.
- Download availability when secure delivery is enabled.

## Deletion intake

Required input:

- Authenticated user context.
- User-provided reason or confirmation string.

Created records:

- `deletionRequests/{requestId}`.
- `auditLogs/{auditId}` with action `deletion_request_created`.

Processing output:

- Deletion plan.
- Plan hash.
- Retained data categories.
- Deleted/anonymized data categories.
- Status update.
- Audit action `deletion_processed`.

User-visible status:

- Request status.
- Created/updated timestamps.
- Retained data explanation.
- Completion/failure result when available.

Production note:

Destructive deletion must remain blocked until legal hold, retention exceptions, idempotency, and emulator/integration evidence are complete.

## Consent intake

Required input:

- Authenticated user context.
- Purpose.
- Consent tier.
- Status: `granted`, `denied`, or `revoked`.

Created/updated records:

- `consentRecords/{uid}_{purpose}`.
- `consentEvents/{eventId}`.
- `auditLogs/{auditId}` with consent action.

User-visible status:

- Purpose.
- Consent tier.
- Current status.
- Policy version.
- Updated timestamp.
- Receipt hash.

Production note:

Tier 2 passive context and Tier 3 sensitive relationship/emotional processing must check consent before processing and must stop future processing after revocation.

## Audit access intake

Required input:

- Authenticated user context.

Expected behavior:

- User sees only audit events where they are the target user or actor, depending on the permitted ledger model.
- Admin/system-only metadata is redacted where necessary.
- Viewing audit records must not expose other users or internal secrets.

## Retention inquiry intake

Required input:

- Authenticated user context for personalized retention status.
- Public access may show general retention policy summaries.

Expected behavior:

- Show collection/category summary.
- Show retention class.
- Show retention window where applicable.
- Explain legal hold/security exceptions.

## SLA targets

These are operational targets and may require legal review before publishing.

| Request | Target internal handling time | Notes |
|---|---:|---|
| Export request | 7 days | Faster when automated export is stable |
| Deletion request | 30 days | Legal hold/security exceptions may extend |
| Consent update | Immediate | Downstream systems must respect latest state |
| Retention inquiry | 7 days | Automated UI summaries should be immediate |
| Audit access | 7 days | Redaction may be required |

## Required audit actions

- `export_request_created`
- `export_processed`
- `deletion_request_created`
- `deletion_plan_generated`
- `deletion_processed`
- `consent_updated`
- `admin_viewed_request`
- `admin_changed_request_status`
- `policy_version_changed`

## Intake validation checklist

- [ ] Request has authenticated actor or verified manual identity.
- [ ] Target UID is authorized.
- [ ] Input is validated and bounded.
- [ ] Request record is created or updated.
- [ ] Audit evidence is written.
- [ ] User-visible status is available.
- [ ] Admin/system processing path is tested.
- [ ] Retention/legal exceptions are documented.
- [ ] Completion evidence is recorded.
