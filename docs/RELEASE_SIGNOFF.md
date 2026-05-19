# URAI Privacy Release Signoff

Use this file as the deploy-time release evidence ledger. Do not paste secrets.

## Code verification

- Release SHA:
- Verification command: `npm run verify:release`
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

## Legal and privacy approvals

- Privacy policy approved: yes/no
- Retention schedule approved: yes/no
- Subprocessors approved: yes/no
- Deletion scope approved: yes/no
- Legal-hold behavior approved: yes/no
- Support/privacy contact approved: yes/no
- Approver:
- Approval timestamp:

## Monitoring and rollback

- Error monitoring configured: yes/no
- Incident route configured: yes/no
- Rollback SHA:
- Rollback command/path:
- Rollback smoke plan confirmed: yes/no

## Final release decision

- Ship / No ship:
- Release owner:
- Timestamp:
- Notes:
