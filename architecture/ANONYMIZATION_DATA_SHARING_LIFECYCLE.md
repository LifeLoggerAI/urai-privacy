# Anonymization and Data-Sharing Lifecycle

This lifecycle defines how URAI approves, generates, audits, and releases anonymized data-sharing products.

```mermaid
flowchart TD
  A[Proposed data product] --> B[Classify source fields]
  B --> C{Any prohibited use?}
  C -- Yes --> X[Block release]
  C -- No --> D[Confirm C8 opt-in eligibility]
  D --> E[Apply transformations]
  E --> F[Check cohort size]
  F --> G{Minimum cohort met?}
  G -- No --> X
  G -- Yes --> H[Run re-identification review]
  H --> I{Risk acceptable?}
  I -- No --> X
  I -- Yes --> J[Create anonymizationBatches record]
  J --> K[Write monetization/data-sharing ledger events]
  K --> L[Audit data_sharing.batch_approved]
  L --> M[Release approved data product]
```

## Required Records

- `anonymizationBatches`
- `monetizationLedger`
- `dataAccessLogs`
- `consentEvents` / `userConsent` for C8 eligibility

## Required Controls

- C8 consent required for participation
- Minimum cohort size of 100 unless stricter threshold applies
- Re-identification review required
- Raw biometric, raw transcript, raw image, and user-linked sensitive records prohibited
- Opt-out stops future inclusion
- Data product must document fields, transformations, cohort size, and approval owner

## Failure Modes

- Missing C8 consent: exclude user or block product
- Cohort below threshold: block release
- Re-identification risk too high: suppress/generalize or block
- Prohibited data class or use: block release
