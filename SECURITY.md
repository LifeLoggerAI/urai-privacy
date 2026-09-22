# Security Policy

URAI Privacy governs sensitive data-handling rules for the URAI ecosystem. Security reports involving privacy, consent, deletion, export, audit logging, biometric processing, data-sharing, or user rights should be treated as high priority.

## Reporting Security or Privacy Issues

The intended private URAI security/privacy mailboxes are not yet independently verified for delivery. Until a private route is activated, do not send vulnerability details, credentials, exploit payloads, private user data, biometric data, or specific privacy-rights material through public forms or public GitHub issues.

The current public security/privacy contact state is published at https://uraiprivacy.com/contact.html.

## High-Risk Report Categories

A private reporting route is required for issues involving:

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

Once the private reporting route is active, URAI should acknowledge credible reports promptly, preserve evidence, contain affected systems, and follow the incident response lifecycle when user privacy may be affected.

## Public Disclosure

Please do not publicly disclose vulnerabilities before a private reporting route is available and URAI has had a reasonable opportunity to investigate, contain, and remediate the issue.
