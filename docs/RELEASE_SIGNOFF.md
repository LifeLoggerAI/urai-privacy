# URAI Privacy Release Signoff

Use this file as the deploy-time release evidence ledger. Do not paste secrets.

This ledger is bound to [`FINAL_SYSTEM_OF_SYSTEMS_COMPLETION_LOCK.md`](./FINAL_SYSTEM_OF_SYSTEMS_COMPLETION_LOCK.md). A release cannot be marked `Ship` unless the completion lock, local verification, live smoke evidence, legal/privacy approval, and Tier-One adoption evidence are complete.

## Code verification

- Release SHA:
- Verification command: `npm ci && npm ci --prefix functions && npm run preflight && npm run test:emulators && npm run verify:release`
- Verification result:
- Verification operator:
- Verification timestamp:

## Firebase environment

- Firebase project ID:
- Hosting URL:
- Functions region:
- Firestore rules deployed: yes/no
- Storage rules deployed: yes/no
- Auth provider verified: yes/no
- Admin custom claim seeded and verified: yes/no

## Staging deployment evidence

Generate the redacted staging evidence template after staging deploy and smoke validation:

```bash
URAI_PRIVACY_REQUIRE_LIVE=1 npm run release:evidence:staging
```

- Evidence file path:
- Evidence generated: yes/no
- Evidence reviewed: yes/no
- Evidence contains no secrets: yes/no
- Evidence owner:
- Evidence timestamp:

## Live smoke

Run:

```bash
URAI_PRIVACY_BASE_URL="https://<host>" URAI_PRIVACY_REQUIRE_LIVE=1 npm run test:smoke:live
```

Evidence:

- Public routes smoke passed: yes/no
- Owner export request passed: yes/no
- Export signed URL retrieval passed: yes/no
- Owner deletion request passed: yes/no
- Admin deletion dry run passed: yes/no
- Admin deletion execute passed with current plan hash: yes/no
- Legal hold blocks deletion: yes/no
- Consent update passed: yes/no
- Admin denied without claim: yes/no
- Admin allowed with claim: yes/no
- Anonymous access denied: yes/no
- Cross-user data access denied: yes/no

## Tier-One system-of-systems adoption evidence

For each Tier-One repo in `privacy/system-of-systems/registry.json`, record the adoption proof before production approval.

| Repo | Adoption CI present | Data inventory current | Manifests current | Export/delete contribution tested | Consent enforcement tested | Banned-copy scan passed | Evidence link / SHA |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `LifeLoggerAI/UrAi` | yes/no | yes/no | yes/no | yes/no | yes/no | yes/no | |
| `LifeLoggerAI/UrAiProd` | yes/no | yes/no | yes/no | yes/no | yes/no | yes/no | |
| `LifeLoggerAI/urai-admin` | yes/no | yes/no | yes/no | yes/no | yes/no | yes/no | |
| `LifeLoggerAI/urai-analytics` | yes/no | yes/no | yes/no | yes/no | yes/no | yes/no | |
| `LifeLoggerAI/urai-communications` | yes/no | yes/no | yes/no | yes/no | yes/no | yes/no | |
| `LifeLoggerAI/urai-studio` | yes/no | yes/no | yes/no | yes/no | yes/no | yes/no | |
| `LifeLoggerAI/urai-spatial` | yes/no | yes/no | yes/no | yes/no | yes/no | yes/no | |
| `LifeLoggerAI/urai-foundation` | yes/no | yes/no | yes/no | yes/no | yes/no | yes/no | |
| `LifeLoggerAI/B2Bportal` | yes/no | yes/no | yes/no | yes/no | yes/no | yes/no | |
| `LifeLoggerAI/asset-factory` | yes/no | yes/no | yes/no | yes/no | yes/no | yes/no | |

## Legal and privacy approvals

- Privacy policy approved: yes/no
- Retention schedule approved: yes/no
- Subprocessors approved: yes/no
- Deletion scope approved: yes/no
- Legal-hold behavior approved: yes/no
- Support/privacy contact approved: yes/no
- Public banned-claim scan approved: yes/no
- Privacy reviewer:
- Legal/counsel approver:
- Approval timestamp:

## Monitoring and rollback

- Error monitoring configured: yes/no
- Incident route configured: yes/no
- Incident owner:
- Rollback SHA:
- Rollback command/path:
- Rollback smoke plan confirmed: yes/no

## Final release decision

- Completion lock satisfied: yes/no
- Ship / No ship:
- Release owner:
- Timestamp:
- Notes:

If any row above remains `no` or blank for a production dependency, the final release decision must be `No ship` unless the release owner documents a narrow, time-bound exception approved by privacy and legal reviewers.
