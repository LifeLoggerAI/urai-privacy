# URAI Privacy Repo Map

Last audited: 2026-05-10

## Framework and runtime

- App framework: Next.js App Router scaffold under `app/`.
- UI runtime: React 18 + TypeScript.
- Package manager: npm via root `package.json`.
- Governance runtime: Python 3.11+ via `requirements.txt` and `tools/run_validation.py`.
- Public legacy website: static HTML under `website/` for `uraiprivacy.com`.
- Governance version: `0.1.0-draft`.
- Product scaffold version: `0.2.0-staging-scaffold`.

## Deploy target

- Static website: GitHub Pages, configured through `website/`, `CNAME`, `website/CNAME`, `.github/workflows/pages.yml`, and `website/PUBLISHING.md`.
- Next.js app: Firebase Hosting framework scaffold via `firebase.json`.
- Firebase Functions: `functions/` codebase named `privacy`.
- Firestore and Storage: rules and indexes are present.

## Firebase project assumptions

No real Firebase project IDs are committed. `.firebaserc.example` documents local/staging/production placeholders. Real project IDs must be configured locally or in CI/CD secrets and reviewed before production.

Firebase infrastructure files now present:

- `firebase.json`
- `.firebaserc.example`
- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`
- `functions/package.json`
- `functions/tsconfig.json`
- `functions/src/index.ts`

## Public routes

Current Next.js product routes:

- `/` -> `app/page.tsx`
- `/privacy` -> `app/privacy/page.tsx`

Current legacy static website routes remain in `website/`:

- `/` -> `website/index.html` for GitHub Pages legacy publishing
- `/principles.html`
- `/rights.html`
- `/governance.html`
- `/legal.html`
- `/request.html`
- `/contact.html`
- `/status.html`
- `/404.html`

## Protected / user-facing routes

Privacy center routes now exist as Next.js pages:

- `/privacy-center`
- `/privacy-center/export`
- `/privacy-center/delete`
- `/privacy-center/retention`
- `/privacy-center/consent`
- `/privacy-center/audit-log`

Current limitation: pages render workflow-backed previews and route contracts. Live client-side Firebase Auth and callable Function wiring remains required before staging signoff.

## Admin routes

Admin console routes now exist as Next.js pages:

- `/admin`
- `/admin/privacy-requests`
- `/admin/audit-log`
- `/admin/retention`
- `/admin/policies`

Current authorization model is implemented in shared workflow helpers, Firestore rules, and Functions. Route middleware/session enforcement is still required before production.

## API routes / Functions

Executable Firebase callable Functions scaffold now exists in `functions/src/index.ts`:

- `createExportRequest`
- `processExportRequest`
- `createDeletionRequest`
- `processDeletionRequest`
- `updateConsent`
- `writeAuditLog`
- `recordAdminAction`
- `getPrivacyHealthReport`

OpenAPI contract remains in `api/privacy-api.yaml`.

## Firestore collections

Implementation scaffold uses these collections:

- `users`
- `privacyRequests`
- `exportJobs`
- `deletionRequests`
- `consentRecords`
- `retentionPolicies`
- `auditLogs`
- `adminActions`
- `dataAccessEvents`
- `policyVersions`

Existing schema contract remains at `schemas/firestore-privacy-schema.json` and still needs a follow-up alignment pass to fully reconcile legacy schema names with the new executable collection names.

## Storage buckets / paths

Storage rules define:

- `exports/{uid}/...` user/admin readable and admin/function writable.
- `evidence/...` admin-only.
- deny-by-default fallback for all other paths.

Actual export package writing and signed/expiring download behavior remain implementation blockers.

## Security rules

Firestore rules now include:

- deny-by-default fallback
- owner-scoped reads
- user-created pending export/deletion requests
- admin-only status updates
- admin-only export job writes
- append-only audit logs
- immutable delete behavior for policy/audit/admin evidence
- public read for policy versions

Storage rules now include:

- private export paths
- admin-only evidence vault
- deny-by-default fallback

## Scripts and checks

Root npm scripts now include:

- `lint`
- `typecheck`
- `test`
- `test:unit`
- `test:integration`
- `test:e2e`
- `test:rules`
- `test:smoke`
- `test:emulators`
- `build`
- `preflight`
- `preflight:production`
- `security:gate`
- `deploy`
- `verify:production`
- `verify:release`

Primary combined verifier:

```bash
bash scripts/verify-release.sh
```

Existing governance verifier remains:

```bash
python tools/run_validation.py
```

## CI workflows

New workflows:

- `.github/workflows/ci.yml`
- `.github/workflows/release-verifier.yml`

Existing governance/static website workflows are preserved.

## Tests

Added:

- `tests/unit/privacy-workflows.test.ts`
- `scripts/smoke-routes.mjs`
- `scripts/validate-rules.mjs`

Existing Python tests remain preserved.

Missing before production:

- real Firebase emulator security rules tests
- callable Functions integration tests against emulator
- live Auth route middleware tests
- export package integrity tests
- destructive deletion dry-run/destructive-run tests
- storage signed URL expiry tests

## Environment variables

Still required before staging/production:

- `.env.example`
- `.env.production.example`
- Firebase web app config variables
- Firebase Admin/runtime secret handling
- staging and production project IDs outside committed secrets

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

The repo now has a Firebase + Next.js staging scaffold and verifiable local command path. It is not production-ready until dependencies are installed, verifier output passes, Firebase emulator tests are expanded and recorded, live route auth is wired, UI forms call Functions, export package generation is implemented, destructive deletion safeguards are implemented, Firebase projects are configured, and deployment evidence is recorded.
