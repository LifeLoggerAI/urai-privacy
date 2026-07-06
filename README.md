# URAI Privacy & Data Governance

Public target: **https://uraiprivacy.com**  
Governance version: **0.2.0-staging-scaffold**

`LifeLoggerAI/urai-privacy` is the privacy control-plane repository for the URAI ecosystem. It contains a Next.js/Firebase privacy application, callable backend functions, Firestore and Storage rules, consent/export/deletion scaffolding, governance standards, and fail-closed release gates.

## Canonical URAI authority

The canonical public product is:

- repository: `LifeLoggerAI/urai-spatial`;
- runtime root: `urai-tier1`;
- branch: `main`;
- public domain: `https://urai.app`.

`LifeLoggerAI/UrAi`, `UrAi-Dev`, and `UrAiProd` are legacy, development, reference, migration, or rollback surfaces. They must not compete with or deploy over the canonical Spatial product.

Privacy owns privacy decisions, consent, export/deletion orchestration, retention policy, provenance requirements, and privacy evidence. It does **not** own the canonical public route experience or silently grant other systems access to user data.

## Production boundary

Current machine-readable status: [`PRODUCTION_LOCK_STATUS.json`](./PRODUCTION_LOCK_STATUS.json).

Repository implementation is substantial, but authenticated production readiness is **not verified** until all of the following exist for the intended environment:

- exact deployed commit and rollback commit;
- Firebase project, Auth, Functions, Firestore, and Storage deployment receipt;
- live public-route smoke;
- authenticated owner and cross-user denial evidence;
- consent grant/deny/revoke enforcement evidence;
- complete export evidence;
- complete deletion-orchestration evidence;
- retention/expiry evidence;
- monitoring, alerting, backup, restore, incident, and rollback evidence;
- required privacy and legal approval.

Strict production lock:

```bash
URAI_PRIVACY_BASE_URL="https://uraiprivacy.com" npm run final:production-lock
```

The command fails closed unless the required live and authenticated evidence artifacts are present. A passing repository build alone is not production proof.

## Repository role

1. **Privacy application** — public privacy pages, authenticated privacy center, export/deletion/consent/audit surfaces, and protected admin privacy operations.
2. **Firebase backend** — callable functions, Firestore/Storage rules, export processing, signed retrieval, deletion planning/execution, legal-hold safeguards, and audit evidence.
3. **Governance package** — data classification, collection boundaries, consent tiers, retention, export, anonymization, incident response, audit standards, and release signoff.
4. **Verification package** — unit/integration/rules tests, static validation, live smoke, authenticated-workflow proof verification, security gates, CI, and production readiness assertions.

## Product surfaces

Public and user routes:

- `/`
- `/privacy`
- `/privacy-center`
- `/privacy-center/export`
- `/privacy-center/delete`
- `/privacy-center/consent`
- `/privacy-center/audit-log`
- `/privacy-center/retention`

Protected admin routes:

- `/admin`
- `/admin/privacy-requests`
- `/admin/audit-log`
- `/admin/policies`
- `/admin/retention`

Route existence does not prove the corresponding cross-system workflow is complete.

## Implemented in the repository

- Firebase Auth-gated privacy-center surfaces.
- Custom-claim/role-gated admin surfaces.
- Consent records and consent-event structures.
- Export requests/jobs, private export packages, and authorized download-link handling.
- Deletion requests, dry-run plans, current-plan-hash checks, legal-hold blocking, retained evidence, and audit events.
- Firestore owner/admin rules and Storage export/evidence rules.
- Append-only evidence and admin-action record structures.
- Retention-policy surfaces and lifecycle guidance.
- Live-route smoke and authenticated-workflow proof verification scripts.
- Release signoff and production-lock ledgers.

## Critical incomplete work

The following remain open production gates and must not be represented as complete:

- shared runtime consent-decision API and downstream fail-closed guard;
- revocation propagation with consumer acknowledgement;
- cross-system, paginated, checksum-backed export completeness;
- end-to-end deletion across Firebase Auth, Firestore, Storage, providers, analytics, caches, vectors, backups, and every registered URAI service;
- scheduled retention and verified expiry jobs;
- one versioned API/schema/claim contract that matches exported handlers;
- exact staging and production deployment, monitoring, backup/restore, incident, and rollback receipts.

Canonical tracking includes issues #83–#87 and the staging/live-evidence gate in issue #59.

## Design requirements

- Data minimization and purpose limitation.
- Explicit, versioned, revocable consent.
- Unknown or stale consent fails closed.
- No dark patterns or silent escalation.
- Sensitive inference and biometric identity require separate explicit consent.
- Sharing or monetization requires separate opt-in.
- Export, deletion, revocation, and retention must be operational and receipted.
- Admin access is least-privilege, claim/role-gated, and audited.
- Destructive deletion requires a dry run, legal-hold evaluation, current-plan-hash validation, idempotent execution, verification, and a user-visible receipt.
- Public claims must distinguish repository implementation from verified live behavior.

## Integration boundaries

- `urai-spatial`: canonical public product; consumes privacy decisions and exposes Passport/privacy journeys without owning privacy policy.
- `urai-jobs`: executes resumable export/deletion/retention work with retries, leases, idempotency, dead-letter handling, and audit correlation.
- `urai-admin`: protected operator review and recovery; every sensitive action must be attributable.
- `urai-analytics`: receives allow-listed aggregate events only; no raw memories, prompts, private story text, or unnecessary identifiers.
- `asset-factory`: stores provider/asset provenance and obeys deletion, retention, cost, and consent decisions.
- `urai-studio`, `urai-content`, `urai-storytime`, `urai-communications`, `urai-marketing`, `B2Bportal`, and future services: must call the versioned privacy decision boundary before protected processing and must register export/deletion contributors.
- `urai-staging`: integration environment only, never production authority.

Nothing is production-ready merely because it imports this repository or repeats privacy language.

## Key documentation

- [`docs/GOVERNANCE_INDEX.md`](./docs/GOVERNANCE_INDEX.md)
- [`docs/PRODUCTION_READINESS.md`](./docs/PRODUCTION_READINESS.md)
- [`docs/RELEASE_SIGNOFF.md`](./docs/RELEASE_SIGNOFF.md)
- [`docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`](./docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md)
- [`docs/system-of-systems/URAI_PRIVACY_MATRIX.md`](./docs/system-of-systems/URAI_PRIVACY_MATRIX.md)
- [`docs/release-gates/V1_PRIVACY_RELEASE_GATE.md`](./docs/release-gates/V1_PRIVACY_RELEASE_GATE.md)
- [`docs/release-gates/USER_DATA_RIGHTS_AND_LIFECYCLE.md`](./docs/release-gates/USER_DATA_RIGHTS_AND_LIFECYCLE.md)
- [`docs/DATA_CLASSIFICATION.md`](./docs/DATA_CLASSIFICATION.md)
- [`docs/DATA_COLLECTION_BOUNDARIES.md`](./docs/DATA_COLLECTION_BOUNDARIES.md)
- [`docs/CONSENT_TIERS.md`](./docs/CONSENT_TIERS.md)
- [`docs/RETENTION_AND_DELETION.md`](./docs/RETENTION_AND_DELETION.md)
- [`docs/DATA_EXPORT_STANDARD.md`](./docs/DATA_EXPORT_STANDARD.md)
- [`docs/INCIDENT_RESPONSE.md`](./docs/INCIDENT_RESPONSE.md)
- [`docs/AUDIT_LOGGING_STANDARD.md`](./docs/AUDIT_LOGGING_STANDARD.md)

## Local setup

Requirements:

- Node.js `>=20.19.0`;
- npm;
- Java 17 for Firebase emulator tests;
- Firebase CLI for emulator/deployment work;
- Python 3.11+ only for legacy governance tools.

```bash
npm ci
npm ci --prefix functions
npm run preflight
npm run test:emulators
```

Functions package:

```bash
cd functions
npm run build
npm run typecheck
npm test
```

Full repository verification:

```bash
npm run verify:release
```

Live smoke after an authorized deployment:

```bash
URAI_PRIVACY_BASE_URL="https://<host>" \
URAI_PRIVACY_REQUIRE_LIVE=1 \
npm run test:smoke:live
```

Authenticated proof verification:

```bash
URAI_PRIVACY_REQUIRE_AUTH_LIVE_PROOF=1 npm run test:live-auth-proof
```

## Secret and evidence handling

Do not commit `.env` files, service-account JSON, private keys, tokens, credentials, signed export URLs, or private user content. Public Firebase client configuration is not an admin authorization mechanism. Admin access must be enforced through trusted authentication claims and/or role records.

Every production completion claim must identify the exact repository SHA, environment, deployment, test/workflow artifact, runtime evidence, rollback SHA, and remaining caveats.
