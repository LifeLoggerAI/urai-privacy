# Audit Review Cadence SOP

This SOP defines how URAI reviews privacy-relevant audit logs and governance signals on a recurring basis.

## Purpose

Audit review ensures that consent, deletion, export, admin access, data-sharing, biometric processing, and incident response activities are working as governed.

## Review Cadence

| Area | Cadence | Owner |
|---|---|---|
| Admin access to L3-L6 data | Monthly | Privacy / Security |
| Break-glass access | Within 24 hours | Privacy / Security |
| Deletion failures | Weekly | Backend / Privacy |
| Export failures | Weekly | Backend / Privacy |
| Consent revocation failures | Weekly | Product / Privacy |
| Biometric access or deletion | Monthly | Privacy / Security |
| Data-sharing batches | Before every release | Privacy / Analytics |
| Vendor access | Quarterly | Privacy / Operations |
| Privacy incidents | Every incident and monthly summary | Privacy / Security |

## Required Review Questions

- Were any admin accesses missing a valid purpose?
- Did any access involve L4, L5, or L6 data unexpectedly?
- Did deletion or export jobs fail or stall?
- Were revoked users excluded from future processing?
- Did data-sharing batches meet C8 and cohort requirements?
- Were any vendor accesses outside approved scope?
- Did any repeated failure pattern require a governance update?

## Review Outputs

Each review should produce:

- review date
- reviewer
- systems reviewed
- anomalies found
- incidents opened
- corrective actions
- follow-up owner
- next review date

## Escalation

Any suspected unauthorized access, consent bypass, deletion failure affecting multiple users, biometric exposure, or data-sharing violation must escalate under `INCIDENT_ESCALATION_MATRIX.md`.
