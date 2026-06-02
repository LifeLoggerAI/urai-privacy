# URAI Spatial XR Privacy Evidence Gate

This file records privacy evidence required before `LifeLoggerAI/urai-spatial` or native XR clients may claim production AR/VR/XR readiness.

## Current status

- Dependency status: `required-before-production-xr`.
- Canonical consumer: `LifeLoggerAI/urai-spatial` and future native XR clients.
- Sensitive surfaces: headset pose/session data, camera/session permission flows, biometrics/body signals, memory grounding, exports, deletion, consent, admin audit, and provider-backed processing.
- Production XR claim status: blocked until consent, export, deletion, audit, redaction, and provider-specific privacy evidence are recorded.

## Required XR privacy evidence

| Gate | Required evidence | Result | Notes |
| --- | --- | --- | --- |
| Explicit consent | Consent copy and runtime proof for XR session data, camera/session access, biometrics/body signals, and memory grounding | Not recorded | Required before provider-backed XR data collection. |
| Revocation | Proof that consent can be revoked and downstream processing stops | Not recorded | Required before live provider claims. |
| Export | User export evidence including XR/session/provider records where applicable | Not recorded | Required before production launch. |
| Deletion | Destructive deletion evidence covering XR/session/provider records where applicable | Not recorded | Required before production launch. |
| Audit trail | Admin/user audit entries for access, export, deletion, revocation, and provider operations | Not recorded | Required before admin operations. |
| Redaction | Evidence that logs, screenshots, diagnostics, and release artifacts redact identifiers and sensitive payloads | Not recorded | Required before attaching evidence packets. |
| Legal hold boundary | Proof destructive deletion respects legal-hold safeguards without leaking private data | Not recorded | Required before production launch. |
| Provider review | Privacy review for each provider-backed XR integration | Not recorded | Required per provider before enabling claims. |

## Integration contract for URAI Spatial

`urai-spatial` must keep AR/VR/XR privacy/provider rows as `Not recorded` or `Not validated` until this repo records:

1. Consent and revocation evidence.
2. Export and deletion evidence.
3. Audit and redaction evidence.
4. Provider-specific privacy review.
5. Evidence artifact safety review.

## Release decision

Do not use this file to mark privacy production complete by itself. It is a cross-repo XR dependency ledger. Authoritative privacy readiness remains in this repo's release checks, evidence files, and operational runbooks.
