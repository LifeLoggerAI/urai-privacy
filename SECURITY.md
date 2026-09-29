# Security Policy

URAI Privacy governs sensitive data-handling rules for the URAI ecosystem. Security reports involving privacy, consent, deletion, export, audit logging, biometric processing, data-sharing, or user rights should be treated as high priority.

## Reporting Security or Privacy Issues

Verified private routing is available through the URAI Labs mail domain:

- Security: security@urailabs.com
- Privacy / user rights: privacy@urailabs.com
- General account support: support@urailabs.com

Routing was verified by controlled mailbox canary on 2026-09-29. The equivalent `@urai.app` role addresses are not launch-authoritative until separately proven.

Do not send credentials, raw exploit payloads, private user datasets, biometric material, or other unnecessary sensitive content in an initial report. Provide the minimum information needed to establish the issue and coordinate a safer evidence-transfer path if required.

## High-Risk Report Categories

Use the private reporting route for issues involving:

- unauthorized access to user data
- admin access misuse
- consent bypass
- deletion or export failure
- biometric or identity signal exposure
- sensitive inference exposure
- data-sharing or monetization without consent
- law enforcement request mishandling
- vendor or processor misuse
- exposed credentials, tokens, or service accounts

## Severity Reference

URAI uses the S0-S4 incident model from `docs/INCIDENT_RESPONSE.md` and `sops/INCIDENT_ESCALATION_MATRIX.md`.

- S0: Near miss
- S1: Low
- S2: Moderate
- S3: High
- S4: Critical

## Response Expectations

Mailbox delivery verification does not certify an SLA. Credible reports should be acknowledged promptly, evidence preserved, affected systems contained, and the incident response lifecycle followed when user privacy may be affected.

## Public Disclosure

Please do not publicly disclose vulnerabilities before URAI has had a reasonable opportunity to investigate, contain, and remediate the issue.
