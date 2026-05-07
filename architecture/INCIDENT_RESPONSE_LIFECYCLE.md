# Incident Response Lifecycle

This lifecycle defines how URAI detects, classifies, contains, remediates, notifies, and learns from privacy incidents.

```mermaid
flowchart TD
  A[Signal or report received] --> B[Create incidentReports record]
  B --> C[Classify severity S0-S4]
  C --> D[Assign incident owner]
  D --> E[Contain affected system or pipeline]
  E --> F[Identify data classes and users affected]
  F --> G[Determine notification and legal review]
  G --> H[Remediate root cause]
  H --> I[Verify containment]
  I --> J{User notice required?}
  J -- Yes --> K[Notify users in plain language]
  J -- No --> L[Document reason]
  K --> M[Postmortem and corrective actions]
  L --> M
  M --> N[Update governance or controls if needed]
```

## Required Records

- `incidentReports`
- `dataAccessLogs`
- related `privacyRequests`, `deletionJobs`, `exportJobs`, or `anonymizationBatches` where applicable

## Severity Levels

- S0: Near miss
- S1: Low
- S2: Moderate
- S3: High
- S4: Critical

## Required Controls

- Incident owner assigned
- Affected data classes identified
- User impact estimated
- Containment actions documented
- Notification decision documented
- Root cause documented
- Corrective actions assigned
- Postmortem required for S2+

## Failure Modes

- Unknown severity: default to higher severity until reviewed
- Sensitive or biometric exposure: treat as S3 or S4
- Uncontained issue: pause dependent processing
- Repeated incident pattern: update governance and release gates
