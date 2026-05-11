# URAI Privacy & Data Governance

Public website: **https://uraiprivacy.com**

This repository defines the binding privacy, consent, data governance, legal notice, and enforcement framework for the URAI ecosystem.

URAI is designed with **privacy-by-architecture**, **user sovereignty**, **minimal data exposure**, and **no silent escalation** as first-class system constraints.

## Current Implementation Status

Current release verdict: **NOT READY — BLOCKERS REMAIN**.

This repo now contains two layers:

1. The original governance package: policy registries, legal templates, static website, schemas, OpenAPI contracts, SOPs, architecture docs, and Python validators.
2. A new staging scaffold for a standalone Firebase + Next.js privacy product: app routes, TypeScript domain types, auditable workflow helpers, Firebase rules/config, callable Functions, tests, CI, and a release verifier.

Do not claim production readiness until `bash scripts/verify-release.sh` passes in a clean checkout and Firebase emulator/deploy evidence is recorded.

## Product Routes

Implemented Next.js routes:

- `/`
- `/privacy`
- `/privacy-center`
- `/privacy-center/export`
- `/privacy-center/delete`
- `/privacy-center/retention`
- `/privacy-center/consent`
- `/privacy-center/audit-log`
- `/admin`
- `/admin/privacy-requests`
- `/admin/audit-log`
- `/admin/retention`
- `/admin/policies`

## Firebase Infrastructure

Added scaffold files:

- `firebase.json`
- `.firebaserc.example`
- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`
- `functions/package.json`
- `functions/tsconfig.json`
- `functions/src/index.ts`

Implemented callable Functions:

- `createExportRequest`
- `processExportRequest`
- `createDeletionRequest`
- `processDeletionRequest`
- `updateConsent`
- `writeAuditLog`
- `recordAdminAction`
- `getPrivacyHealthReport`

## Governance Version

Current governance version: **0.1.0-draft**

See [`VERSION.md`](./VERSION.md) and [`CHANGELOG.md`](./CHANGELOG.md).

## Website

The public-facing privacy governance landing page lives in [`website/`](./website/) and is configured for the custom domain `uraiprivacy.com` via [`CNAME`](./CNAME).

The new Next.js product surface lives under [`app/`](./app/) and is separate from the legacy static website content.

## Launch and Integration Work

URAI Privacy is not considered complete until it is live, legally reviewed, adopted by production repos, and wired into user-rights, consent, export, deletion, admin, support, audit, and monitoring workflows.

Start here for launch execution:

- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md)
- [`docs/LOCAL_DEVELOPMENT.md`](./docs/LOCAL_DEVELOPMENT.md)
- [`docs/FIREBASE_SETUP.md`](./docs/FIREBASE_SETUP.md)
- [`docs/PRIVACY_WORKFLOWS.md`](./docs/PRIVACY_WORKFLOWS.md)
- [`docs/RELEASE_CHECKLIST.md`](./docs/RELEASE_CHECKLIST.md)
- [`docs/FINAL_SYSTEM_REPORT.md`](./docs/FINAL_SYSTEM_REPORT.md)
- [`LAUNCH_READINESS.md`](./LAUNCH_READINESS.md)
- [`docs/INTEGRATION_BACKLOG.md`](./docs/INTEGRATION_BACKLOG.md)
- [`docs/USER_RIGHTS_INTAKE_SPEC.md`](./docs/USER_RIGHTS_INTAKE_SPEC.md)

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
- Firebase rules and Functions scaffold
- Next.js user and admin routes
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
- [`src/lib/privacy-types.ts`](./src/lib/privacy-types.ts)
- [`src/lib/privacy-workflows.ts`](./src/lib/privacy-workflows.ts)
- [`functions/src/index.ts`](./functions/src/index.ts)
- [`legal/`](./legal/)
- [`policy/`](./policy/)
- [`examples/`](./examples/)
- [`tools/run_validation.py`](./tools/run_validation.py)
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
7. Route, rule, Function, build, and release verification evidence when executable code is changed.

## Local Setup

Install app dependencies:

```bash
npm install
```

Install Python governance dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Validation

Run app checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:rules
npm run test:e2e
npm run build
```

Run governance checks:

```bash
python tools/run_validation.py
```

Run the combined verifier:

```bash
bash scripts/verify-release.sh
```

## Safe Configuration

Do not commit real `.env` files, private keys, local credentials, service-account JSON, tokens, real `.firebaserc` project bindings, or generated build/cache artifacts. Use local environment variables or the deployment platform's secret manager for private operational values.

## Status

This repository is now an operational draft governance package plus a Firebase/Next.js staging scaffold. Legal templates and regulatory mappings require qualified legal review before public production launch. Full production readiness remains blocked until clean verification, emulator tests, live Firebase project configuration, callable UI wiring, export package generation, deletion execution safeguards, and deployment evidence are complete.
