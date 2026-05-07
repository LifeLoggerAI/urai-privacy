# Security Policy

URAI Privacy governs sensitive data-handling rules for the URAI ecosystem. Security reports involving privacy, consent, deletion, export, audit logging, biometric processing, data-sharing, or user rights should be treated as high priority.

## Reporting Security or Privacy Issues

Please report security or privacy concerns to:

- privacy@urai.app
- security@urai.app

Do not open a public GitHub issue for vulnerabilities, exposed secrets, authentication bypasses, sensitive data exposure, or privacy-impacting incidents.

## High-Risk Report Categories

Report privately if the issue involves:

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

URAI should acknowledge credible reports promptly, preserve evidence, contain affected systems, and follow the incident response lifecycle when user privacy may be affected.

## Public Disclosure

Please do not publicly disclose vulnerabilities until URAI has had a reasonable opportunity to investigate, contain, and remediate the issue.
