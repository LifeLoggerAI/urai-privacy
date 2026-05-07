# Deletion Lifecycle

This lifecycle defines how URAI handles record, category, date-range, biometric-only, and account deletion.

```mermaid
flowchart TD
  A[User submits deletion request] --> B[Authenticate and validate scope]
  B --> C[Create privacyRequests record]
  C --> D[Create deletionJobs record]
  D --> E[Delete primary records]
  E --> F[Delete or recompute derived insights]
  F --> G[Schedule backup expiry]
  G --> H[Write audit event]
  H --> I{All stages complete?}
  I -- Yes --> J[Mark completed]
  I -- No --> K[Mark failed_with_reason]
```

## Required Records

- `privacyRequests`
- `deletionJobs`
- `dataAccessLogs`

## Required Controls

- Deletion scope must be explicit.
- L3-L5 data requires deletion support.
- Biometric-only deletion must be supported where L5 is processed.
- Derived data must be deleted or recomputed without deleted source data.
- Backup expiry must be documented.

## Required Deletion Stages

1. `requested`
2. `validated`
3. `queued`
4. `primary_store_deleted`
5. `derived_records_deleted_or_recomputed`
6. `backup_expiry_scheduled`
7. `completed`
8. `failed_with_reason`

## Failure Modes

- Unknown user: reject with safe error
- Invalid scope: request clarification
- Legal hold: document and narrow scope
- Derived data failure: mark failed and retry
- Backup expiry unknown: block launch readiness
