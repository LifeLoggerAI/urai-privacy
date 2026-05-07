# Consent Lifecycle

This lifecycle defines how URAI consent is presented, recorded, enforced, revoked, and audited.

```mermaid
flowchart TD
  A[Feature requests data or inference] --> B[Classify data L0-L7]
  B --> C[Map required consent C0-C8]
  C --> D{Consent already granted?}
  D -- Yes --> E[Allow processing]
  D -- No --> F[Show granular consent prompt]
  F --> G{User decision}
  G -- Grant --> H[Write consent event]
  G -- Deny --> I[Disable or degrade feature]
  H --> J[Update current consent state]
  J --> K[Audit consent.changed]
  K --> E
  E --> L{User revokes later?}
  L -- Yes --> M[Stop future processing]
  M --> N[Queue deletion or de-identification if required]
  N --> O[Audit consent.changed]
```

## Required Records

- `userConsent`
- `consentEvents`
- `dataAccessLogs`
- dependent `deletionJobs` when revocation invalidates stored data

## Required Controls

- Granular consent per tier
- No bundled consent for C4, C5, C6, or C8
- Revocation for non-essential consent
- Consent event evidence hash
- Policy version attached to every consent event

## Failure Modes

- Missing consent tier: block feature
- Revoked consent: stop future processing
- Unknown policy version: block feature until migrated
- Consent prompt unavailable: feature must degrade gracefully
