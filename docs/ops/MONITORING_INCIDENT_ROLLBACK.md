# Monitoring, Incident Routing, and Rollback Runbook

Date: 2026-05-19
Owner: URAI Privacy / Release Owner
Status: production release evidence requirement.

## Purpose

This runbook turns monitoring, incident routing, and rollback from vague launch requirements into a deployable checklist. It is required before `urai-privacy` can be marked production-ready.

## Required monitors

### Application availability

- Public privacy home route responds successfully.
- Privacy center routes respond successfully.
- Admin routes require authentication/admin access.
- Live smoke command passes against the hosted base URL.

Command:

```bash
URAI_PRIVACY_BASE_URL="https://<host>" URAI_PRIVACY_REQUIRE_LIVE=1 npm run test:smoke:live
```

### Firebase Functions

Monitor callable failures and latency for:

- `createExportRequest`
- `processExportRequest`
- `getExportDownloadUrl`
- `createDeletionRequest`
- `processDeletionRequest`
- `executeDeletionRequest`
- `updateConsent`
- `writeAuditLog`
- `recordAdminAction`
- `getPrivacyHealthReport`

Alert on:

- error-rate spike
- p95 latency spike
- repeated permission-denied events from admin paths
- repeated failed deletion execution
- signed URL generation failures
- missing audit event writes

### Firestore/Storage rules

Monitor:

- denied anonymous access attempts
- denied cross-user reads
- denied unknown collection/path access
- denied Storage export access
- unexpected admin role changes
- legal-hold record updates

Denied access is not automatically bad. It is expected during tests and abuse attempts. Alert only on unusual volume or sensitive target patterns.

### Privacy operations health

Monitor:

- open export requests
- open deletion requests
- deletion requests stuck in `processing`
- export jobs stuck in `processing`
- legal-hold blocked deletion attempts
- audit write failures

`getPrivacyHealthReport` returns a basic operational health payload and should be expanded into dashboard/alert wiring in the selected monitoring platform.

## Incident routing

### Severity levels

| Severity | Example | Response |
| --- | --- | --- |
| SEV0 | private data public exposure, cross-user export access, destructive deletion bug | stop deploys, disable affected function/route if needed, preserve logs, legal/security escalation |
| SEV1 | export/deletion/consent broken in production | rollback or hotfix, notify support, preserve audit evidence |
| SEV2 | admin dashboard degraded, monitoring degraded | triage same day, no production launch while unresolved |
| SEV3 | docs/copy/minor UI issue | backlog unless it affects compliance/trust |

### Required responders

- release owner
- privacy/legal owner
- security owner
- engineering owner
- support owner

### First 15 minutes

1. Declare severity.
2. Freeze production deploys.
3. Preserve logs and audit evidence.
4. Identify affected function/route/data class.
5. Decide rollback vs hotfix.
6. Start incident record.

### Privacy-specific incident checks

- Was user data exposed?
- Was cross-user access possible?
- Was destructive deletion incorrect, incomplete, or applied to the wrong user?
- Were audit logs tampered with or missing?
- Were legal-hold records bypassed?
- Were export signed URLs over-broad or long-lived?
- Were provider/vendor payloads involved?
- Is user/regulator notice required?

## Rollback procedure

1. Identify last known-good SHA.
2. Confirm matching Firebase rules/functions/hosting state if available.
3. Re-run release verification on rollback SHA where practical:

```bash
npm run verify:release
```

4. Deploy rollback SHA to hosting/functions/rules.
5. Run live smoke:

```bash
URAI_PRIVACY_BASE_URL="https://<host>" URAI_PRIVACY_REQUIRE_LIVE=1 npm run test:smoke:live
```

6. Verify privacy flows:
   - export request
   - signed export retrieval
   - deletion dry-run
   - legal-hold blocked deletion
   - consent update
   - admin denied without claim
   - admin allowed with claim
7. Record rollback SHA, command, operator, timestamp, and result in `docs/RELEASE_SIGNOFF.md` or incident record.

## Production release minimum evidence

- `npm run verify:release` passed.
- Firebase project and hosting target confirmed.
- Auth provider confirmed.
- Admin custom claim seeded and verified.
- Firestore rules deployed.
- Storage rules deployed.
- Live smoke passed.
- Monitoring dashboards/alerts linked.
- Incident responders identified.
- Rollback SHA/path confirmed.
- Legal/privacy/security/support signoff recorded.

## Non-negotiables

- Do not delete audit logs or legal-hold records during incident response.
- Do not bypass plan-hash checks for destructive deletion.
- Do not use public env variables as admin proof.
- Do not paste credentials into issues, PRs, docs, or release signoff.
- Do not mark production-ready without live Firebase evidence.