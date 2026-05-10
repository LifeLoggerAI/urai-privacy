# URAI Privacy Repo Map

Last audited: 2026-05-10

## Framework and runtime

- Current app framework: none detected. This repository is a governance, policy, schema, legal-template, validation, and static website package.
- Package manager: Python/pip via `requirements.txt`; no root `package.json` was detected during audit.
- Required runtime: Python 3.11+.
- Public website: static HTML under `website/` for `uraiprivacy.com`.
- Current version: `0.1.0-draft`.

## Deploy target

- Static website: GitHub Pages, configured through `website/`, `CNAME`, `website/CNAME`, `.github/workflows/pages.yml`, and `website/PUBLISHING.md`.
- Firebase app hosting / Firebase Functions: not present in the current codebase.
- Next.js app hosting: not present in the current codebase.

## Firebase project assumptions

No concrete Firebase project ID, `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, or deployed Functions source was detected in the audited package. Firebase behavior is currently represented as contracts rather than executable Firebase infrastructure:

- Firestore contract: `schemas/firestore-privacy-schema.json`
- API contract: `api/privacy-api.yaml`
- Governance validation: `tools/run_validation.py`, `tools/validate_privacy_package.py`

## Public routes

Current static website routes are file-based HTML pages:

- `/` -> `website/index.html`
- `/principles.html`
- `/rights.html`
- `/governance.html`
- `/legal.html`
- `/request.html`
- `/contact.html`
- `/status.html`
- `/404.html`

Requested product routes that do not currently exist as Next.js/Firebase pages:

- `/features`
- `/security`
- `/privacy`
- `/terms`
- `/docs`
- `/compliance`
- `/data-rights`
- `/login`
- `/admin/*`
- `/privacy-center/*`

## Protected routes

No authenticated protected UI routes were detected. The requested admin console and user privacy center are not implemented as protected application routes yet.

## API routes

No executable API routes or Cloud Functions were detected. API behavior is specified contractually in `api/privacy-api.yaml`, including consent state, consent recording, export request, deletion request, data-sharing opt-out, audit history, and insight explanation endpoints.

## Cloud Functions

No executable Firebase Cloud Functions source tree was detected. The required functions remain implementation blockers:

- `health`
- `getPrivacyStatus`
- `recordConsent`
- `revokeConsent`
- `syncConsentToProduct`
- `createDataExportRequest`
- `processDataExportRequest`
- `createDeletionRequest`
- `processDeletionRequest`
- `applyRetentionRules`
- `cleanupExpiredData`
- `createFeatureManifest`
- `approveFeatureManifest`
- `rejectFeatureManifest`
- `publishPolicyVersion`
- `recordVendorReview`
- `recordPrivacyAuditEvent`
- `createIncident`
- `resolveIncident`
- `generateComplianceEvidencePackage`
- `privacySystemStatusCheck`

## Firestore collections

Current schema contract defines these top-level domains:

- `userConsent`
- `consentEvents`
- `privacyRequests`
- `deletionJobs`
- `exportJobs`
- `dataAccessLogs`
- `dataProcessingRecords`
- `anonymizationBatches`
- `monetizationLedger`
- `incidentReports`

Requested canonical production collections not yet represented one-for-one in the current schema contract:

- `privacyUsers`
- `privacyOrganizations`
- `privacyConsents`
- `privacyConsentVersions`
- `privacyFeatureManifests`
- `privacyRetentionRules`
- `privacyDataRequests`
- `privacyExportJobs`
- `privacyDeletionJobs`
- `privacyPolicyVersions`
- `privacyVendors`
- `privacyProcessors`
- `privacySubprocessors`
- `privacyAuditLogs`
- `privacyIncidents`
- `privacyLegalHolds`
- `privacyIntegrations`
- `privacySystemConfig`
- `privacyReleaseEvidence`
- `privacyRiskReviews`
- `privacyAdminUsers`
- `privacyAccessRoles`
- `privacyNotifications`
- `privacyWebhooks`

## Storage buckets

No Firebase Storage buckets or `storage.rules` were detected. Private export packages and audit evidence vault storage are not yet executable infrastructure.

## Security rules

No executable `firestore.rules` or `storage.rules` were detected. Security expectations are documented in governance standards but are not enforced by Firebase rules yet.

## Scripts and checks

Primary validation entrypoint:

```bash
python tools/run_validation.py
```

The validation runner executes:

- Python unit and smoke tests
- committed-secret scan
- local Markdown link validation
- static website validation
- privacy health report
- privacy package validation

## CI workflows

The repository includes GitHub workflow expectations through `.github/workflows/` and validates the governance/static package rather than a Next.js/Firebase product.

## Tests

Detected test categories in the validation package:

- adoption validator tests
- privacy validator tests
- static website E2E smoke tests

Missing test categories for the requested production system:

- Firebase security rules tests
- Cloud Functions unit and integration tests
- protected route authorization tests
- admin console tests
- privacy center E2E tests
- export package integrity tests
- deletion proof tests
- retention dry-run and destructive-run tests

## Environment variables

No executable app environment contract was detected. Required future env examples:

- `.env.example`
- `.env.production.example`
- Firebase project IDs
- Firebase service account handling through platform secrets only
- app URL/domain values
- evidence bucket names
- webhook signing keys through secret manager only

## Missing production files

- `package.json`
- `pnpm-lock.yaml`
- `next.config.*`
- `src/` or `app/` application tree
- `functions/` or Firebase Functions source
- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- production deploy verifier scripts

## Generated files that should not be committed

Keep generated files out of the repo unless intentionally published as release evidence:

- `.next/`
- `node_modules/`
- `coverage/`
- `.firebase/`
- Firebase emulator export directories
- real `.env` files
- service account JSON
- export package ZIP files with user data
- local cache/build artifacts

## Secret-risk files

The repo has a secret scan tool. Additional hard-block patterns must remain excluded from commits:

- `.env`, `.env.*` except examples
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- service account JSON
- OAuth client secrets
- Firebase admin credentials
- webhook signing secrets

## Production blockers

Verdict: `NOT READY — BLOCKERS REMAIN`.

The current repository is a strong operational draft governance package, not the standalone privacy/compliance/trust product requested in the release mission. The blockers are executable product infrastructure, Firebase enforcement, protected UI, Cloud Functions, production deploy path, and independent release verification.
