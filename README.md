# URAI Privacy & Data Governance

Public website: **https://uraiprivacy.com**

This repository is the URAI privacy control plane: a deployable Next.js/Firebase privacy product plus the binding privacy, consent, data governance, legal notice, and release-gate framework for the URAI ecosystem.

URAI is designed with **privacy-by-architecture**, **user sovereignty**, **minimal data exposure**, and **no silent escalation** as first-class system constraints.

## Production lock status

Current machine-readable status: [`PRODUCTION_LOCK_STATUS.json`](./PRODUCTION_LOCK_STATUS.json)

Strict final production lock command:

```bash
URAI_PRIVACY_BASE_URL="https://uraiprivacy.com" npm run final:production-lock
```

The strict final command fails closed unless live route smoke is required, authenticated live workflow proof is required, and the redacted proof artifact passes the verifier.

Full authenticated privacy operations are not READY unless `npm run final:production-lock` passes against the intended deployment host and the real proof artifact at `release-evidence/authenticated-live/AUTHENTICATED_LIVE_WORKFLOW_PROOF.json` has been attached.

## Release Gate

Nothing may be represented as production-ready until the repository package validator, release verification, emulator/rules tests, live route smoke, authenticated export/deletion/consent/admin-denial proof, monitoring, rollback, privacy review, and legal approval all pass for the same intended deployment. Missing or stale evidence keeps the gate closed; documentation, route reachability, or a green source build alone cannot open it.

## Repository role

`urai-privacy` is no longer docs-only. It is now a hybrid operational package:

1. **Deployable privacy app** — Next.js app routes for public privacy pages, user privacy center, export/deletion/consent/audit surfaces, and admin privacy operations.
2. **Firebase privacy backend** — callable functions, Firestore rules, Storage rules, export processing, signed export retrieval, destructive deletion executor, legal-hold safeguards, and audit evidence.
3. **Governance and release-gate package** — privacy standards, V1 release gates, user data rights lifecycle, cross-repo system-of-systems privacy matrix, legal/policy templates, and signoff evidence.
4. **Verification package** — unit/integration/rules tests, static rule validation, release verification, live smoke script, authenticated live workflow proof verifier, security gate, CI workflow, and production readiness assertions.

## Governance Version

Current version: **0.2.0-staging-scaffold**

See [`VERSION.md`](./VERSION.md), [`CHANGELOG.md`](./CHANGELOG.md), [`docs/PRODUCTION_READINESS.md`](./docs/PRODUCTION_READINESS.md), and [`docs/RELEASE_SIGNOFF.md`](./docs/RELEASE_SIGNOFF.md).

## Product surfaces

Public/user routes:

- `/`
- `/privacy`
- `/privacy-center`
- `/privacy-center/export`
- `/privacy-center/delete`
- `/privacy-center/consent`
- `/privacy-center/audit-log`
- `/privacy-center/retention`

Admin routes:

- `/admin`
- `/admin/privacy-requests`
- `/admin/audit-log`
- `/admin/policies`
- `/admin/retention`

## Implemented privacy control-plane capabilities

- Firebase Auth-gated privacy center.
- Firebase custom-claim/role-gated admin surfaces.
- Consent records and consent events.
- Export requests, export jobs, private export packages, and owner/admin-authorized export download links.
- Deletion requests, dry-run deletion plan, current-plan-hash guarded destructive execution, legal-hold blocking, retained evidence, and audit events.
- Firestore owner/admin rules and Storage export/evidence rules.
- Append-only audit evidence and admin action records.
- Retention policy surfaces and lifecycle guidance.
- Live route smoke verification script.
- Authenticated live workflow proof verifier.
- Release signoff ledger.

## Operational package

Start here:

- [`website/`](./website/) — static public governance and rights pages.
- [`docs/GOVERNANCE_INDEX.md`](./docs/GOVERNANCE_INDEX.md)
- [`docs/PRODUCTION_READINESS.md`](./docs/PRODUCTION_READINESS.md)
- [`docs/RELEASE_SIGNOFF.md`](./docs/RELEASE_SIGNOFF.md)
- [`docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`](./docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md)
- [`docs/system-of-systems/URAI_PRIVACY_MATRIX.md`](./docs/system-of-systems/URAI_PRIVACY_MATRIX.md)
- [`docs/release-gates/V1_PRIVACY_RELEASE_GATE.md`](./docs/release-gates/V1_PRIVACY_RELEASE_GATE.md)
- [`docs/release-gates/USER_DATA_RIGHTS_AND_LIFECYCLE.md`](./docs/release-gates/USER_DATA_RIGHTS_AND_LIFECYCLE.md)

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

- [`functions/src/index.ts`](./functions/src/index.ts)
- [`firestore.rules`](./firestore.rules)
- [`storage.rules`](./storage.rules)
- [`schemas/firestore-privacy-schema.json`](./schemas/firestore-privacy-schema.json)
- [`api/privacy-api.yaml`](./api/privacy-api.yaml)
- [`legal/`](./legal/)
- [`policy/`](./policy/)
- [`examples/`](./examples/)
- [`tools/validate_privacy_package.py`](./tools/validate_privacy_package.py)

## Design principles

- Data minimization.
- Purpose limitation.
- User-first consent.
- Transparent explainability.
- No dark patterns.
- No silent escalation of data use.
- Sensitive inference requires explicit consent.
- Biometric identity requires separate explicit consent.
- Data-sharing or monetization requires separate opt-in.
- Deletion, export, and revocation must be operational, not just promised.
- Admin access must be claim/role-gated and audited.
- Destructive deletion must dry-run first, check legal hold, use current plan hash, and retain audit/legal evidence.

## Relationship to other repos

- `urai-spatial` / `urai-tier1` / `main`: canonical public product authority and the only production application candidate.
- `UrAi`: older V1 demo/reference application; it must not be treated as current production authority.
- `UrAi-Dev`: staging/demo reference work that must not be treated as production truth.
- `B2Bportal`: enterprise/partner portal with strict public-surface minimization.
- `asset-factory`: generated assets, provider metadata, manifests, and release evidence.
- `urai-admin`: operator/admin cockpit; must obey custom-claim, least-privilege, and audit rules.
- `urai-analytics`: must use aggregate/privacy-safe analytics where possible.
- `urai-jobs`: must audit retries/failures/background destructive work.
- `urai-content`, `urai-studio`, `urai-communications`, `urai-marketing`, `urai-staging`, and `UrAiProd`: must follow the cross-repo privacy matrix and current authority register.

Nothing ships if it violates this repo.

A URAI feature is not release-ready unless it has:

1. Data classes for every collected or derived field.
2. Consent tiers for every collection, inference, sharing, and monetization purpose.
3. Retention and deletion behavior.
4. Export and explainability behavior where user-facing data or insights are created.
5. Audit logs for admin, system, sensitive, biometric, deletion, export, and monetization actions.
6. Privacy review approval.
7. Live smoke evidence where the feature touches production or staging infrastructure.
8. Rollback and incident response path.
9. Authenticated live workflow proof for export, deletion, consent, admin authorization, storage scope, Firestore scope, and cross-user denial.

## Local setup

Required runtime:

- Node.js `>=20.19.0`
- npm
- Java 17 for Firebase emulator-backed rules/integration tests
- Firebase CLI for emulator/deploy flows
- Python 3.11+ only for legacy governance validation tools

Install:

```bash
npm ci
npm ci --prefix functions
```

Optional legacy governance tools:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Verification

Fast repo preflight:

```bash
npm run preflight
```

Full release verification:

```bash
npm run verify:release
```

Strict final production lock:

```bash
URAI_PRIVACY_BASE_URL="https://uraiprivacy.com" npm run final:production-lock
```

Emulator-backed rules and integration tests:

```bash
npm run test:emulators
```

Functions package:

```bash
cd functions
npm run build
npm run typecheck
npm test
```

Live route smoke after staging/prod deploy:

```bash
URAI_PRIVACY_BASE_URL="https://<host>" URAI_PRIVACY_REQUIRE_LIVE=1 npm run test:smoke:live
```

Authenticated live workflow proof verifier:

```bash
URAI_PRIVACY_REQUIRE_AUTH_LIVE_PROOF=1 npm run test:live-auth-proof
```

Legacy governance checks:

```bash
python -m unittest discover -s tests -p 'test_*.py'
python tools/check_secrets.py
python tools/check_website.py
python tools/validate_privacy_package.py
```

## Safe configuration

Do not commit real `.env` files, private keys, local credentials, service-account JSON, tokens, or generated build/cache artifacts. Use local environment variables or the deployment platform's secret manager for any private operational values.

Public Firebase client env keys are documented in [`.env.example`](./.env.example). Admin access is not controlled by public env variables; it is enforced by Firebase Auth custom claims and/or role documents.

## Deployment status

Repo-side implementation and release gates are substantially complete, but full authenticated production readiness still requires external evidence:

- Firebase staging/prod credentials and deployment proof.
- Admin custom-claim proof in live Firebase.
- Live smoke evidence.
- Authenticated live workflow proof artifact.
- Legal/counsel approval.
- Monitoring/error routing and rollback proof.
- npm audit disposition.
