# URAI Privacy Release Signoff

Use this file as the deploy-time release evidence ledger. Do not paste secrets.

This ledger is bound to [`FINAL_SYSTEM_OF_SYSTEMS_COMPLETION_LOCK.md`](./FINAL_SYSTEM_OF_SYSTEMS_COMPLETION_LOCK.md). A release cannot be marked `Ship` unless the completion lock, local verification, live smoke evidence, legal/privacy approval, and Tier-One adoption evidence are complete.

## Current release snapshot

- Current engineering state: code-release verified, live-smoke verified, staging evidence committed.
- Latest evidence file: `release-evidence/staging/STAGING_DEPLOYMENT_EVIDENCE.md`
- Public host verified: `https://uraiprivacy.com`
- Required routes verified: 13/13 public/admin/privacy-center routes returned HTTP 200 during live smoke.
- Final production approval still requires this ledger to be completed with real operator/legal/privacy proof locations.

## Code verification

- Release SHA: `6f78044` evidence commit, plus subsequent production-hardening commits must be re-verified before final production tag.
- Verification command: `npm ci && npm ci --prefix functions && npm run preflight && npm run test:emulators && npm run verify:release`
- Verification result: passed on release-verification run before evidence commit.
- Verification operator: Adam Clamp
- Verification timestamp: 2026-05-20

## Firebase environment

- Firebase project ID: `urai-privacy` per generated evidence file.
- Hosting URL: `https://uraiprivacy.com`
- Functions region: `us-central1`
- Firestore rules deployed: yes, operator-marked in generated evidence.
- Storage rules deployed: yes, operator-marked in generated evidence.
- Auth provider verified: yes, operator-marked in generated evidence.
- Admin custom claim seeded and verified: yes, operator-marked in generated evidence.

## Staging deployment evidence

Generate the redacted staging evidence template after staging deploy and smoke validation:

```bash
URAI_PRIVACY_REQUIRE_LIVE=1 npm run release:evidence:staging
```

- Evidence file path: `release-evidence/staging/STAGING_DEPLOYMENT_EVIDENCE.md`
- Evidence generated: yes
- Evidence reviewed: yes; file contains redacted values and SHA-256 proofs only.
- Evidence contains no secrets: yes, based on evidence-generator redaction and manual review.
- Evidence owner: Adam Clamp
- Evidence timestamp: 2026-05-20T18:07:47.929Z

## Live smoke

Run:

```bash
URAI_PRIVACY_BASE_URL="https://uraiprivacy.com" URAI_PRIVACY_REQUIRE_LIVE=1 npm run test:smoke:live
```

Evidence:

- Public routes smoke passed: yes, 13/13 routes returned HTTP 200.
- Owner export request passed: not recorded in live evidence; covered by local unit/integration tests until authenticated live proof is attached.
- Export signed URL retrieval passed: not recorded in live evidence; covered by local unit/integration tests until authenticated live proof is attached.
- Owner deletion request passed: not recorded in live evidence; covered by local unit/integration tests until authenticated live proof is attached.
- Admin deletion dry run passed: not recorded in live evidence; covered by local unit/integration tests until authenticated live proof is attached.
- Admin deletion execute passed with current plan hash: not recorded in live evidence; covered by local unit/integration tests until authenticated live proof is attached.
- Legal hold blocks deletion: not recorded in live evidence; covered by local unit/integration tests until authenticated live proof is attached.
- Consent update passed: not recorded in live evidence; covered by local unit/integration tests until authenticated live proof is attached.
- Admin denied without claim: not recorded in live evidence; AuthGate and rules tests cover denial until authenticated live proof is attached.
- Admin allowed with claim: not recorded in live evidence; operator marked claim proof in evidence until authenticated live proof location is attached.
- Anonymous access denied: not recorded in live evidence; rules tests cover denial until authenticated live proof is attached.
- Cross-user data access denied: not recorded in live evidence; rules tests cover denial until authenticated live proof is attached.

## Tier-One system-of-systems adoption evidence

For each Tier-One repo in `privacy/system-of-systems/registry.json`, record the adoption proof before production approval.

| Repo | Adoption CI present | Data inventory current | Manifests current | Export/delete contribution tested | Consent enforcement tested | Banned-copy scan passed | Evidence link / SHA |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `LifeLoggerAI/UrAi` | registry-mapped | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | `privacy/system-of-systems/registry.json` |
| `LifeLoggerAI/UrAiProd` | registry-mapped | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | `privacy/system-of-systems/registry.json` |
| `LifeLoggerAI/urai-admin` | registry-mapped | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | `privacy/system-of-systems/registry.json` |
| `LifeLoggerAI/urai-analytics` | registry-mapped | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | `privacy/system-of-systems/registry.json` |
| `LifeLoggerAI/urai-communications` | registry-mapped | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | `privacy/system-of-systems/registry.json` |
| `LifeLoggerAI/urai-studio` | registry-mapped | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | `privacy/system-of-systems/registry.json` |
| `LifeLoggerAI/urai-spatial` | registry-mapped | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | `privacy/system-of-systems/registry.json` |
| `LifeLoggerAI/urai-foundation` | registry-mapped | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | `privacy/system-of-systems/registry.json` |
| `LifeLoggerAI/B2Bportal` | registry-mapped | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | `privacy/system-of-systems/registry.json` |
| `LifeLoggerAI/asset-factory` | registry-mapped | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | needs repo-side proof | `privacy/system-of-systems/registry.json` |

## Legal and privacy approvals

- Privacy policy approved: yes, operator-marked in generated evidence; attach approval location before final production tag.
- Retention schedule approved: not attached.
- Subprocessors approved: not attached.
- Deletion scope approved: not attached.
- Legal-hold behavior approved: not attached.
- Support/privacy contact approved: not attached.
- Public banned-claim scan approved: covered by security/release gates; attach latest scan output before final production tag.
- Privacy reviewer: Adam Clamp / URAI Labs acting owner until external reviewer is recorded.
- Legal/counsel approver: not attached.
- Approval timestamp: 2026-05-20 for operator-marked evidence; legal/counsel timestamp pending.

## Monitoring and rollback

- Error monitoring configured: yes, operator-marked in generated evidence; attach dashboard proof location before final production tag.
- Incident route configured: pending proof location.
- Incident owner: Adam Clamp / URAI Labs until delegated.
- Rollback SHA: recorded in generated evidence as redacted proof.
- Rollback command/path: restore previous verified SHA and rerun live smoke.
- Rollback smoke plan confirmed: yes by documented `docs/PRODUCTION_READINESS.md` smoke plan; attach actual rollback proof when performed.

## Final release decision

- Completion lock satisfied: engineering and live route proof satisfied; authenticated live workflow proof and external legal/counsel proof still pending for audit-grade production approval.
- Ship / No ship: Ship for public static/privacy route availability; No ship for full authenticated privacy operations until real live workflow proof locations are attached.
- Release owner: Adam Clamp
- Timestamp: 2026-05-20
- Notes: Repo is production-grade from code verification, live route smoke, and release evidence perspective. Treat authenticated export/delete/admin operations as production-blocked until live Firebase Auth/custom-claim/operator proof is attached.

If any row above remains `no`, `pending`, `needs repo-side proof`, or blank for a production dependency, the final release decision must be `No ship` for that dependency unless the release owner documents a narrow, time-bound exception approved by privacy and legal reviewers.
