# User Rights Intake Specification

Status: required for public launch.

## Purpose

URAI users need a clear, reliable way to request privacy actions. Email-only contact is not enough for a polished production system.

## Required request types

- Export my data
- Delete my data
- Revoke consent
- Delete biometric or identity-linked data
- Explain a sensitive insight or inference
- Correct inaccurate data
- Opt out of data-sharing or monetization where applicable
- Report a privacy or security concern

## Minimum user flow

1. User opens the privacy request page from uraiprivacy.com or account settings.
2. User selects a request type.
3. User authenticates or completes secure identity verification.
4. System creates a request ID.
5. User receives confirmation and expected response window.
6. Request enters an internal privacy operations queue.
7. Authorized staff or automated jobs process the request.
8. System records audit events.
9. User receives completion, rejection, or escalation notice.

## Minimum fields

```yaml
request_id: string
user_id: string | null
requester_email: string
request_type: export | delete | revoke_consent | delete_biometric | explain | correct | opt_out | incident
status: received | verifying | in_progress | completed | rejected | escalated
policy_version: string
created_at: timestamp
updated_at: timestamp
completed_at: timestamp | null
assigned_team: privacy | security | legal | support | engineering
verification_status: pending | verified | failed | not_required
audit_event_ids: string[]
```

## Required audit events

- privacy.request.created
- privacy.request.verified
- privacy.request.rejected
- privacy.request.escalated
- privacy.request.completed
- privacy.export.requested
- privacy.export.completed
- privacy.deletion.requested
- privacy.deletion.completed
- privacy.consent.revoked
- privacy.explanation.requested
- privacy.biometric_deletion.requested
- privacy.biometric_deletion.completed

## Public page requirements

The public request page must include:

- plain-language explanation of available rights
- expected response timing
- warning not to submit secrets or unnecessary sensitive data
- authenticated request path for signed-in users
- fallback contact route for users who cannot sign in
- confirmation screen with request ID
- link to privacy policy and relevant notices

## Admin requirements

The internal queue must include:

- request type
- identity verification status
- user/account link
- SLA deadline
- assigned owner
- escalation route
- notes
- audit log
- completion evidence

## Launch gate

URAI Privacy is not public-ready until at least export, deletion, consent revocation, biometric deletion where applicable, and explanation requests can be submitted, tracked, processed, and audited end to end.
