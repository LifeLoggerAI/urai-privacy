# URAI Privacy Release Signoff

Use this file as the deploy-time release evidence ledger. Do not paste secrets.

This ledger is bound to [`FINAL_SYSTEM_OF_SYSTEMS_COMPLETION_LOCK.md`](./FINAL_SYSTEM_OF_SYSTEMS_COMPLETION_LOCK.md). A release cannot be marked `Ship` for full authenticated privacy operations unless the completion lock, local verification, live smoke evidence, authenticated workflow proof, legal/privacy approval, monitoring/rollback proof, and Tier-One adoption evidence are complete.

## Current release snapshot

- Current engineering state: code paths exist for privacy-center routes, Firebase callable workflows, Firestore/Storage rules, and admin request processing.
- Latest generated staging evidence file: `release-evidence/staging/STAGING_DEPLOYMENT_EVIDENCE.md`.
- Latest authenticated workflow proof gate: `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.
- Public host listed in prior evidence: `https://uraiprivacy.com`.
- Public route smoke is necessary but not sufficient: route HTTP 200 proof does not prove export, deletion, consent, admin authorization, legal-hold behavior, or cross-user denial.
- Final production approval still requires this ledger to be completed with real operator/legal/privacy proof locations.

## Code verification

- Release SHA: `6f78044` evidence commit was previously recorded; all subsequent production-hardening commits must be re-verified before final production tag.
- Verification command: `npm ci && npm ci --prefix functions && npm run preflight && npm run test:emulators && npm run verify:release`.
- Verification result: stale / must be re-run after latest commits.
- Verification operator: pending current proof.
- Verification timestamp: pending current proof.

## Firebase environment

- Firebase project ID: `urai-privacy` per generated evidence file.
- Hosting URL: `https://uraiprivacy.com` per generated evidence file.
- Functions region: `us-central1` per generated evidence file.
- Firestore rules deployed: prior operator-marked evidence exists; attach current deploy proof before final production tag.
- Storage rules deployed: prior operator-marked evidence exists; attach current deploy proof before final production tag.
- Auth provider verified: prior operator-marked evidence exists; attach current proof before final production tag.
- Admin custom claim seeded and verified: prior operator-marked evidence exists; attach current redacted proof before final production tag.

## Staging / production deployment evidence

Generate the redacted staging or production evidence template after deploy and smoke validation:

```bash
URAI_PRIVACY_REQUIRE_LIVE=1 npm run release:evidence:staging
```

- Evidence file path: `release-evidence/staging/STAGING_DEPLOYMENT_EVIDENCE.md`.
- Evidence generated: yes, prior file exists.
- Evidence reviewed: prior file contains redacted values and SHA-256 proofs only.
- Evidence contains no secrets: yes based on evidence-generator redaction and manual review claim; re-review before production tag.
- Evidence owner: Adam Clamp in prior evidence.
- Evidence timestamp: 2026-05-20T18:07:47.929Z in prior evidence.
- Current status: stale for final production lock until regenerated or explicitly carried forward with latest commit SHA.

## Live smoke

Run:

```bash
URAI_PRIVACY_BASE_URL="https://uraiprivacy.com" URAI_PRIVACY_REQUIRE_LIVE=1 npm run test:smoke:live
```

Evidence:

- Public routes smoke passed: prior evidence says yes, 13/13 routes returned HTTP 200; attach current command output after latest commit.
- Owner export request passed: not recorded in live evidence; required by `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.
- Export signed URL retrieval passed: not recorded in live evidence; required by `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.
- Owner deletion request passed: not recorded in live evidence; required by `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.
- Admin deletion dry run passed: not recorded in live evidence; required by `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.
- Admin deletion execute passed with current plan hash: not recorded in live evidence; required by `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.
- Legal hold blocks deletion: not recorded in live evidence; required by `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.
- Consent update passed: not recorded in live evidence; required by `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.
- Admin denied without claim: not recorded in live evidence; required by `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.
- Admin allowed with claim: not recorded in live evidence; required by `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.
- Anonymous access denied: not recorded in live evidence; required by `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.
- Cross-user data access denied: not recorded in live evidence; required by `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md`.

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

- Privacy policy approved: prior operator-marked generated evidence says yes; attach approval location before final production tag.
- Retention schedule approved: not attached.
- Subprocessors approved: not attached.
- Deletion scope approved: not attached.
- Legal-hold behavior approved: not attached.
- Support/privacy contact approved: not attached.
- Public banned-claim scan approved: covered by security/release gates; attach latest scan output before final production tag.
- Privacy reviewer: Adam Clamp / URAI Labs acting owner until external reviewer is recorded.
- Legal/counsel approver: not attached.
- Approval timestamp: 2026-05-20 for prior operator-marked evidence; legal/counsel timestamp pending.

## Monitoring and rollback

- Error monitoring configured: prior operator-marked generated evidence says yes; attach dashboard proof location before final production tag.
- Incident route configured: pending proof location.
- Incident owner: Adam Clamp / URAI Labs until delegated.
- Rollback SHA: recorded in generated evidence as redacted proof; attach current rollback target after latest release verification.
- Rollback command/path: restore previous verified SHA and rerun live smoke.
- Rollback smoke plan confirmed: documented in `docs/PRODUCTION_READINESS.md`; attach actual rollback proof when performed.

## Final release decision

- Completion lock satisfied: no for full authenticated privacy operations.
- Ship / No ship: Ship only for narrow public static/privacy route availability if current public route smoke passes and copy does not overclaim. No ship for full authenticated privacy operations until `docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md` is complete and legal/counsel proof is attached.
- Release owner: Adam Clamp unless delegated.
- Timestamp: pending current production decision.
- Notes: Treat export/delete/admin/consent operations as production-blocked until real live Firebase Auth/custom-claim/operator proof is attached.

If any row above remains `no`, `pending`, `needs repo-side proof`, `not recorded`, stale, or blank for a production dependency, the final release decision must be `No ship` for that dependency unless the release owner documents a narrow, time-bound exception approved by privacy and legal reviewers.
