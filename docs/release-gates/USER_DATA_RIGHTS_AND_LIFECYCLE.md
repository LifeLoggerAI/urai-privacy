# User Data Rights and Lifecycle

Date: 2026-05-19
Owner: URAI Privacy
Status: operational guidance for export, deletion, correction, retention, redaction, vendor review, incident response, and release signoff.

## User rights process

### Access/export

1. User opens privacy center export flow or contacts privacy support.
2. System creates `privacyRequests` record and `exportJobs` record.
3. Admin or backend processor runs `processExportRequest`.
4. Export package is written to private Storage under `exports/{uid}/{jobId}/`.
5. User retrieves export through `getExportDownloadUrl`, which requires owner/admin access and returns a short-lived signed URL.
6. Audit event records request, processing, and signed URL creation.

Required evidence:

- request id
- export job id
- actor uid
- target uid
- manifest hash
- package hash
- signed URL creation audit
- completion timestamp

### Deletion

1. User opens privacy center deletion flow or contacts privacy support.
2. System creates `deletionRequests` record with retained and deleted data declarations.
3. Admin runs dry-run through `executeDeletionRequest` with `mode=dryRun`.
4. System produces deletion plan and plan hash.
5. Legal hold is checked from `users/{uid}.legalHold` and active `legalHoldRecords`.
6. If legal hold is active, execution is blocked and audited.
7. If legal hold is clear, admin executes with `mode=execute` and the current plan hash.
8. Supported user-scoped collections are deleted in batches.
9. User document is deleted after scoped data deletion completes.
10. Retained evidence remains in audit/legal/retention collections.

Retained by default:

- `auditLogs`
- `policyVersions`
- `adminActions`
- `retentionPolicies`
- `deletionRequests`
- `legalHoldRecords`

Deleted by default when in scope and not legally held:

- `users`
- `privacyRequests`
- `exportJobs`
- `consentRecords`
- `dataAccessEvents`

### Correction/update

1. User submits correction through product support or account/profile UI.
2. Owner-scoped profile/public fields may be updated by the owner where product rules allow.
3. Admin corrections require custom claim/role access and audit evidence.
4. Correction does not mutate append-only audit records; it adds new correction evidence.

## Retention policy guidance

| Data class | Default retention class | Guidance |
| --- | --- | --- |
| Waitlist/contact | R2/R3 | Keep only while useful for launch/customer communication; delete/anonymize stale contacts after approved window. |
| Telemetry/analytics | R1/R2 aggregate, R3 raw | Prefer aggregate. Raw user-scoped telemetry must have retention and export/delete handling. |
| Companion/chat/memory | R3/R4 | Consent-gated. Delete user-scoped records on deletion unless legal hold applies. |
| Generated assets/manifests | R3/R4 | Retain ownership/rights evidence. Delete unpublished user-scoped assets on deletion unless legally retained. |
| Export packages | R2 | Short-lived private storage, owner/admin signed retrieval only. |
| Deletion requests | R5 | Retained as legal/privacy evidence. |
| Audit logs/admin actions | R5/R6 | Append-only, retained for security/legal evidence. |
| Legal hold records | R6 | Admin-managed retained evidence. |

## Data minimization checklist

- [ ] Collect only fields needed for the stated purpose.
- [ ] Do not collect raw sensitive data where aggregate/derived data is enough.
- [ ] Avoid storing provider tokens, secrets, raw credentials, or private keys.
- [ ] Avoid public exposure of private/passive/memory/relationship data.
- [ ] Separate public profile data from private account data.
- [ ] Prefer short-lived signed URLs over public files.
- [ ] Define retention class before storing a new data class.

## Sensitive-field redaction checklist

Redact or exclude before exports, logs, dashboards, support views, and provider payloads unless explicitly required and approved:

- password
- token
- secret
- apiKey
- privateKey
- refreshToken
- idToken
- session cookie
- payment card
- SSN/tax identifier
- biometric identifier
- raw health data
- private relationship context
- private memory or journal content
- raw transcript content where summary is enough

## Vendor/provider review checklist

- [ ] Provider purpose documented.
- [ ] Data sent to provider documented.
- [ ] Data class and sensitivity documented.
- [ ] Retention/deletion behavior documented.
- [ ] Subprocessor/legal approval completed.
- [ ] Secrets stored outside repo.
- [ ] Provider failures and retries audited.
- [ ] User export/deletion implications documented.

## Incident response privacy checklist

- [ ] Incident owner assigned.
- [ ] Affected data classes identified.
- [ ] Affected users or tenants identified.
- [ ] Exposure window identified.
- [ ] Logs/audit evidence preserved.
- [ ] Legal/privacy/security notified.
- [ ] User/regulator notification need assessed.
- [ ] Remediation and rollback documented.
- [ ] Follow-up controls created.

## Release signoff template

Use `docs/RELEASE_SIGNOFF.md` for deployment evidence. Required approvals:

- release owner
- product owner
- privacy/legal owner
- security owner
- support owner

A release may not be marked production-ready while any of these are missing:

- Firebase environment proof
- live smoke evidence
- admin custom claim proof
- monitoring route
- rollback path
- legal approval
- npm audit disposition

## Definition of done

User data rights are operationally ready when:

- export flow is implemented and verified,
- deletion dry-run and execute are implemented and verified,
- legal hold blocks destructive deletion,
- retained evidence remains append-only,
- correction/update path is documented,
- retention classes are defined,
- redaction checklist exists,
- vendor/provider review checklist exists,
- incident response checklist exists,
- release signoff template exists.