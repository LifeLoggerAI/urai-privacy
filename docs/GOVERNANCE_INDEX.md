# URAI Privacy Governance Index

This repo is the binding privacy and data governance layer for the URAI ecosystem. Product, admin, analytics, monetization, AI, and export systems must conform to this package before release.

## Operational Modules

1. [Data Classification](./DATA_CLASSIFICATION.md)
2. [Data Collection Boundaries](./DATA_COLLECTION_BOUNDARIES.md)
3. [Consent Tiers](./CONSENT_TIERS.md)
4. [Retention and Deletion](./RETENTION_AND_DELETION.md)
5. [Data Export Standard](./DATA_EXPORT_STANDARD.md)
6. [Anonymization Standard](./ANONYMIZATION_STANDARD.md)
7. [Regulatory Alignment](./REGULATORY_ALIGNMENT.md)
8. [Incident Response](./INCIDENT_RESPONSE.md)
9. [Audit Logging Standard](./AUDIT_LOGGING_STANDARD.md)
10. [Privacy Review Checklist](./PRIVACY_REVIEW_CHECKLIST.md)

## Implementation Contracts

- [Firestore Privacy Schema](../schemas/firestore-privacy-schema.json)
- [Privacy API Contract](../api/privacy-api.yaml)
- [Legal Templates](../legal/)
- [CI Validator](../tools/validate_privacy_package.py)

## Release Gate

A URAI repo is privacy-ready only when it can answer all of the following:

- What data classes does it collect, infer, store, export, or monetize?
- What consent tier authorizes each data class?
- What retention class applies to each stored field?
- Can the user export, delete, revoke, or understand the data use?
- Are admin and automated accesses logged?
- Does the feature avoid silent escalation of collection or inference?
- Does anonymized monetization use the required cohort and re-identification controls?

If any answer is missing, the feature must not ship.
