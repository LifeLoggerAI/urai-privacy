# URAI Privacy & Data Governance

Public website: **https://uraiprivacy.com**

This repository defines the binding privacy, consent, data governance, legal notice, and enforcement framework for the URAI ecosystem.

URAI is designed with **privacy-by-architecture**, **user sovereignty**, **minimal data exposure**, and **no silent escalation** as first-class system constraints.

## Governance Version

Current version: **0.1.0-draft**

See [`VERSION.md`](./VERSION.md) and [`CHANGELOG.md`](./CHANGELOG.md).

## Website

The public-facing privacy governance landing page lives in [`website/`](./website/) and is configured for the custom domain `uraiprivacy.com` via [`CNAME`](./CNAME).

The website is a plain-language entry point for users, partners, reviewers, and contributors. It links back to the governance repo, governance index, and legal/privacy templates.

## Scope

This repository covers:

- Data classification and collection boundaries
- Consent tiers and user control
- Anonymization and aggregation guarantees
- Retention and deletion rules
- Data export and portability guarantees
- Regulatory alignment guidance
- Incident and breach response standards
- Audit logging and governance review
- Legal notice templates
- Firestore schema and API contracts
- CI validation for the privacy package

## Operational Package

Start here: [`docs/GOVERNANCE_INDEX.md`](./docs/GOVERNANCE_INDEX.md)

Core standards:

- [`docs/DATA_CLASSIFICATION.md`](./docs/DATA_CLASSIFICATION.md)
- [`docs/DATA_COLLECTION_BOUNDARIES.md`](./docs/DATA_COLLECTION_BOUNDARIES.md)
- [`docs/CONSENT_TIERS.md`](./docs/CONSENT_TIERS.md)
- [`docs/RETENTION_AND_DELETION.md`](./docs/RETENTION_AND_DELETION.md)
- [`docs/DATA_EXPORT_STANDARD.md`](./docs/DATA_EXPORT_STANDARD.md)
- [`docs/ANONYMIZATION_STANDARD.md`](./docs/ANONYMIZATION_STANDARD.md)
- [`docs/REGULATORY_ALIGNMENT.md`](./docs/REGULATORY_ALIGNMENT.md)
- [`docs/INCIDENT_RESPONSE.md`](./docs/INCIDENT_RESPONSE.md)
- [`docs/AUDIT_LOGGING_STANDARD.md`](./docs/AUDIT_LOGGING_STANDARD.md)
- [`docs/PRIVACY_REVIEW_CHECKLIST.md`](./docs/PRIVACY_REVIEW_CHECKLIST.md)

Implementation contracts:

- [`schemas/firestore-privacy-schema.json`](./schemas/firestore-privacy-schema.json)
- [`api/privacy-api.yaml`](./api/privacy-api.yaml)
- [`legal/`](./legal/)
- [`policy/`](./policy/)
- [`examples/`](./examples/)
- [`tools/validate_privacy_package.py`](./tools/validate_privacy_package.py)

## Design Principles

- Data minimization
- Purpose limitation
- User-first consent
- Transparent explainability
- No dark patterns
- No silent escalation of data use
- Sensitive inference requires explicit consent
- Biometric identity requires separate explicit consent
- Data-sharing or monetization requires separate opt-in
- Deletion, export, and revocation must be operational, not just promised

## Relationship to Other Repos

- `urai-labs-llc`: product and infrastructure
- `urai-foundation`: ethics, research, and public good
- `urai-ip-holdings`: IP ownership and licensing
- `urai-admin`: admin access must obey audit and least-privilege rules
- `urai-analytics`: analytics must obey classification, anonymization, and consent rules
- `urai-privacy`: **the rules everything else must obey**

Nothing ships if it violates this repo.

## Release Gate

A URAI feature is not release-ready unless it has:

1. Data classes for every collected or derived field.
2. Consent tiers for every collection, inference, sharing, and monetization purpose.
3. Retention and deletion behavior.
4. Export and explainability behavior where user-facing data or insights are created.
5. Audit logs for admin, system, sensitive, biometric, and monetization actions.
6. Privacy review approval.

## Validation

Run:

```bash
pip install -r requirements.txt
python tools/validate_privacy_package.py
```

The GitHub Actions workflow validates the governance package, policy registries, examples, and invalid fixtures on pull requests and pushes.

## Status

This repository is now an operational draft governance package. All changes are versioned and auditable. Legal templates and regulatory mappings require qualified legal review before public production launch.
