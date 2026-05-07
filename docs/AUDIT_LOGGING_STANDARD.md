# Audit Logging Standard

URAI must log privacy-relevant actions in a way that supports investigation, user rights, compliance, and governance review.

## Events That Must Be Logged

- Consent grant, denial, revocation, renewal, or expiration
- Privacy policy or consent copy version shown to user
- Data export request, creation, download, expiration, and failure
- Deletion request, queueing, completion, and failure
- Admin access to user data
- Automated access to L3-L6 data
- Biometric enrollment, matching, deletion, and failure
- Monetization opt-in, opt-out, batch inclusion, and revenue ledger events
- Data product anonymization approvals
- Incident creation, severity change, containment, and closure
- Model or inference pipeline changes affecting sensitive outputs

## Required Fields

- `eventId`
- `eventType`
- `actorType`: user, admin, system, service, partner
- `actorId`
- `targetUserId`
- `dataClasses`
- `purpose`
- `policyVersion`
- `timestamp`
- `sourceRepo`
- `sourceService`
- `ipHash` when applicable
- `requestId` or correlation ID
- `outcome`

## Integrity Controls

Audit logs should be append-only, access-restricted, and protected from product-level deletion except where legally required.

## User-Visible Audit History

Users should be able to see meaningful privacy history, including consent changes, exports, deletion requests, and monetization participation.

## Admin Access Rule

Every admin access to user data must have a declared reason and must be reviewable later. Curiosity access is prohibited.
