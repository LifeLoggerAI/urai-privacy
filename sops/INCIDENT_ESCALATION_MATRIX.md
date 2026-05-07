# Incident Escalation Matrix SOP

This SOP defines how URAI escalates privacy, security, consent, deletion, export, biometric, and data-sharing incidents.

## Severity Matrix

| Severity | Description | Examples | Escalation |
|---|---|---|---|
| S0 | Near miss | blocked unauthorized access, failed but contained job | Log and review in cadence |
| S1 | Low | isolated process failure with no user exposure | Owner review |
| S2 | Moderate | limited L1-L2 exposure, repeated deletion/export failure | Privacy + Engineering |
| S3 | High | L3-L5 exposure, consent bypass, admin misuse, data-sharing control failure | Privacy + Security + Leadership |
| S4 | Critical | large-scale breach, biometric exposure, crisis/safety data exposure, unlawful data sharing | Executive escalation + legal review |

## Escalation Triggers

Escalate immediately when any of the following occur:

- unauthorized admin access
- break-glass access without audit record
- consent bypass or silent escalation
- deletion failure affecting multiple users
- export exposing another user's data
- L5 biometric exposure or deletion failure
- L4 crisis, trauma, mental health, deception, or relationship inference exposure
- C8 data-sharing participation without opt-in
- cohort threshold violation
- vendor misuse or processor breach
- law enforcement request mishandling

## Required First Hour Actions for S3/S4

1. Assign incident owner.
2. Preserve evidence.
3. Contain affected pipeline or access path.
4. Identify data classes involved.
5. Estimate affected users.
6. Start incident report.
7. Determine whether legal review is required.
8. Decide whether user notification is likely required.

## Required Owners

- Privacy owner: governs user rights, consent, notices, and regulatory impact.
- Security owner: governs containment, access, credentials, and technical controls.
- Engineering owner: governs remediation, logs, jobs, pipelines, and code fixes.
- Product owner: governs user-facing impact and feature changes.
- Legal reviewer: reviews notification, government request, and regulatory duties.

## Post-Incident Requirements

For S2+ incidents:

- postmortem required
- corrective actions required
- owner and due date required
- governance update considered
- launch readiness impact assessed

For S3/S4 incidents:

- dependent processing should pause until containment is verified
- legal review should occur before public statements
- user notification decision must be documented
