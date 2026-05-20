# URAI Privacy Staging Deployment Evidence

Generated: 2026-05-20T18:34:51.498Z

This evidence file is intentionally redacted. Do not paste Firebase tokens, service-account JSON, private keys, cookies, session values, or user personal data.

## Release identity

- Release SHA: 4705edeb5582c775391fadbb81ffa93acf6886ad
- Operator: Adam Clamp
- Firebase project ID: urai-privacy
- Hosting URL: https://uraiprivacy.com
- Functions region: us-central1
- Firebase CLI: 12.4.8

## Required command evidence

Run from a clean checkout of the release SHA:

```bash
npm run verify:release
URAI_PRIVACY_BASE_URL="https://<staging-host>" URAI_PRIVACY_REQUIRE_LIVE=1 npm run test:smoke:live
URAI_PRIVACY_REQUIRE_LIVE=1 npm run release:evidence:staging
```

## Redacted environment proof

| Variable | Present | Redacted value | SHA-256 proof |
| --- | --- | --- | --- |
| URAI_PRIVACY_FIREBASE_PROJECT_ID | yes | urai...vacy | be2f52e1eb76f91dd5e008fe299a103be28c97fd544e5d32d781b52e1da9cfc6 |
| URAI_PRIVACY_BASE_URL | yes | http....com | 91c0432957152ed23101521facb5a74ca86182e821e8becd449e493d9cf78310 |
| URAI_PRIVACY_FUNCTIONS_REGION | yes | us-c...ral1 | 49a433c0192b378bf836adab060aed86c3c4838d68a4c576daaed5f31d7d16fe |
| URAI_PRIVACY_RELEASE_SHA | yes | 4705...86ad | fce3144d930e92c21c193049e1d3884cb55e046ef526caf2e76fbec6224a2ea9 |
| URAI_PRIVACY_OPERATOR | yes | Adam...lamp | 837d1b0bc535f0e12bd9da4980c852e5b720f07bbb569fbd387a1b3fcdb0e2b6 |
| URAI_PRIVACY_ROLLBACK_SHA | yes | a578...d397 | 611a731cba465a6d0a78e99dd227ae2822a4a3e5562133d07a355d22c9f86f5c |

## Deployment controls

| Control | Status |
| --- | --- |
| URAI_PRIVACY_AUTH_PROVIDER_VERIFIED | yes |
| URAI_PRIVACY_ADMIN_CLAIM_VERIFIED | yes |
| URAI_PRIVACY_FIRESTORE_RULES_DEPLOYED | yes |
| URAI_PRIVACY_STORAGE_RULES_DEPLOYED | yes |
| URAI_PRIVACY_MONITORING_CONFIGURED | yes |
| URAI_PRIVACY_LEGAL_APPROVAL | yes |
| URAI_PRIVACY_ROLLBACK_SHA | present |

## Live smoke checklist

- [ ] Public routes smoke passed.
- [ ] Owner export request passed.
- [ ] Export signed URL retrieval passed.
- [ ] Owner deletion request passed.
- [ ] Deletion dry-run passed.
- [ ] Deletion execute passed with current plan hash.
- [ ] Legal hold blocks deletion.
- [ ] Consent update passed.
- [ ] Admin denied without claim.
- [ ] Admin allowed with claim.
- [ ] Anonymous access denied.
- [ ] Cross-user data access denied.

## Operator notes

- Firebase deploy command used:
- Auth provider proof location:
- Admin custom-claim proof location:
- Firestore rules deploy proof location:
- Storage rules deploy proof location:
- Monitoring dashboard/alert proof location:
- Rollback proof location:
- Legal/privacy approval location:

## Release decision

- Ship / No ship:
- Decision owner:
- Decision timestamp:
- Remaining blockers:
