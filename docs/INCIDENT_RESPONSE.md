# Incident and Breach Response Playbook

URAI privacy incidents must be handled quickly, audibly, and with user protection as the first priority.

## Incident Severity

| Severity | Description | Examples |
|---|---|---|
| S0 | Near miss | blocked unauthorized access attempt |
| S1 | Low | internal misconfiguration with no user exposure |
| S2 | Moderate | limited exposure of L1-L2 data |
| S3 | High | exposure of L3-L5 data, consent bypass, or deletion failure |
| S4 | Critical | large-scale breach, biometric exposure, monetization misuse, or crisis/safety data exposure |

## Response Stages

1. Detect and preserve evidence.
2. Assign incident owner.
3. Contain the issue.
4. Classify affected data classes and users.
5. Determine legal/regulatory notification duties.
6. Notify users when required or appropriate.
7. Remediate root cause.
8. Verify containment.
9. Publish internal postmortem.
10. Update this governance package if needed.

## Incident Record Fields

- `incidentId`
- `severity`
- `detectedAt`
- `containedAt`
- `resolvedAt`
- `affectedDataClasses`
- `affectedUserCountEstimate`
- `rootCause`
- `containmentActions`
- `notificationRequired`
- `notificationSentAt`
- `postmortemUrl`
- `policyVersion`

## Notification Principle

URAI should notify users in plain language when an incident materially affects their privacy, data rights, sensitive inferences, biometric records, monetization status, or safety.

## Critical Incident Freeze

For S3 and S4 incidents, dependent data processing pipelines should be paused until containment is verified.

## Postmortem Requirements

Every S2+ incident requires a postmortem covering:

- timeline
- impact
- root cause
- what worked
- what failed
- corrective actions
- owner and due dates
