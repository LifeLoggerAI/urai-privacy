# URAI Privacy Authenticated Live Workflow Proof Gate

Status: required before full production lock.

This checklist exists because public route smoke is not enough to prove privacy operations. A route can return HTTP 200 while export, deletion, consent, admin authorization, legal-hold behavior, or cross-user denial is still broken. Do not mark `urai-privacy` READY for full authenticated privacy operations until every row below has redacted proof.

## Scope

Run this against the intended deployed Firebase project and hosting target only after local release verification passes.

Required local verification first:

```bash
npm ci
npm ci --prefix functions
npm run preflight
npm run test:emulators
npm run verify:release
```

Required public live route smoke:

```bash
URAI_PRIVACY_BASE_URL="https://uraiprivacy.com" URAI_PRIVACY_REQUIRE_LIVE=1 npm run test:smoke:live
```

Required strict authenticated proof verification after the real redacted proof artifact is attached:

```bash
URAI_PRIVACY_REQUIRE_AUTH_LIVE_PROOF=1 npm run test:live-auth-proof
```

The strict command must fail closed while the proof matrix remains incomplete, stale, synthetic, or not bound to the intended deployed Firebase project and tested commit SHA. Do not replace the required proof artifact with route reachability, emulator evidence, documentation, or a source-only test result.

## Required live-auth test identities

| Identity | Purpose | Proof required |
| --- | --- | --- |
| Owner test user A | Own export, deletion, consent, audit | UID redacted, provider, timestamp, environment |
| Owner test user B | Cross-user denial checks | UID redacted, provider, timestamp, environment |
| Admin test user | Admin processing and live health checks | UID redacted, custom-claim or role-doc proof location |
| Anonymous/no-auth session | Public/sign-in denial behavior | Browser/session proof without cookies or tokens |

Do not commit tokens, cookies, raw service-account JSON, private keys, full UID/email values, export package contents, or personal data.

## Workflow proof matrix

| # | Workflow | Required result | Redacted proof location / SHA | Status |
| --- | --- | --- | --- | --- |
| 1 | Public route smoke | All required routes return rendered app HTML and no secret-looking material | pending | BLOCKED |
| 2 | Owner creates export request | `privacyRequests` and `exportJobs` records created for owner UID only | pending | BLOCKED |
| 3 | Admin processes export job | Export package and manifest written to private Storage path | pending | BLOCKED |
| 4 | Owner retrieves signed export URL | Owner receives short-lived signed URL only after completion | pending | BLOCKED |
| 5 | Cross-user export access denied | User B cannot access User A export job or signed URL | pending | BLOCKED |
| 6 | Owner creates deletion request | `deletionRequests` record created and audit event written | pending | BLOCKED |
| 7 | Admin deletion dry-run | Plan and current plan hash returned; no destructive deletion yet | pending | BLOCKED |
| 8 | Stale deletion hash fails | Execute with stale/missing plan hash fails closed | pending | BLOCKED |
| 9 | Legal hold blocks deletion | Active hold prevents destructive deletion and writes audit evidence | pending | BLOCKED |
| 10 | Admin executes deletion with current hash | Supported user-scoped records deleted; retained evidence remains | pending | BLOCKED |
| 11 | Consent grant/deny/revoke | `consentRecords`, `consentEvents`, and `auditLogs` update correctly | pending | BLOCKED |
| 12 | User audit log | Owner sees only own target/actor audit events | pending | BLOCKED |
| 13 | Anonymous access denied | Privacy-center operations require sign-in | pending | BLOCKED |
| 14 | Admin route denied without claim | Non-admin signed-in user cannot view/mutate admin data | pending | BLOCKED |
| 15 | Admin route allowed with claim | Admin can process allowed workflows and every action is audited | pending | BLOCKED |
| 16 | Storage owner/admin scope | Export paths are not public; owner/admin only | pending | BLOCKED |
| 17 | Firestore deny-by-default | Unknown collections and cross-user reads/writes fail | pending | BLOCKED |
| 18 | Monitoring/rollback evidence | Dashboard/alert/rollback locations recorded | pending | BLOCKED |

## Evidence package requirements

For each passed row, attach a redacted proof artifact in `release-evidence/` or `launch-proof/` containing:

- command or manual test name;
- deploy host and Firebase project alias;
- tested commit SHA;
- timestamp;
- operator;
- redacted UID/email values;
- expected result;
- actual result;
- screenshot/log excerpt with secrets removed;
- Firestore/Storage/function path names only when safe;
- rollback impact if the test fails.

## Final rule

If any row remains `pending`, `BLOCKED`, `not recorded`, or blank, the final production verdict for authenticated privacy operations is `NO SHIP`. A narrow public trust-center launch may still be allowed only if public copy does not claim completed export/deletion/compliance behavior beyond verified evidence.
