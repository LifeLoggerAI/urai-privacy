# R855 — Stale-worker cleanup lease and job identity fence (RELEASE HOLD)

**Date:** November 7, 2026. **Source parent:** [Privacy R854 draft PR #249](https://github.com/LifeLoggerAI/urai-privacy/pull/249) at `b58a9617fde181c82d11531639ffec92bf24fdcf`. Independent review child `review/chalk-r855-export-cleanup-stale-state-fence-20261107`; no parent branch, main, production, IAM or live data changed.

## Verified defects

R854's GCS exact-string conditional delete guarded the storage *generation* but the completed-package expiry scheduler still read a job from a paged snapshot, deleted objects, and updated the job if only `status==="completed"`. It could overwrite or misreport newly changed job identity or expiry, and its catch block used `document.ref.update` based on the stale snapshot. The attempt maintenance worker similarly claimed cleanup when due even if its parent job no longer matched or the processing lease/package had not expired. These are source-level stale-worker races; no live destructive incident is claimed.

## Committed remediation

- New pure `functions/src/export-cleanup-state-policy.ts`, Git SHA-1 `5b1111d1d146f0633fa55ef013139df664c6bd41`, checks precise owner, request, export/manifest paths, both recorded object generations, package expiry, job/attempt token and active versus expired lease. Missing or superseded identities deny.
- `functions/src/export-lifecycle-functions.ts` Git blob `a4437a944d12c31a6de1109cdaa1f61b611c8bcb`: completed-package expiry cleanup now claims a unique `artifactCleanupLeaseToken` in a fresh Firestore transaction, switches state to `artifact_cleanup` before invoking the R854 generation-conditional delete, and rechecks token, owner, request, both paths/generations and original expiry in a final transaction. Partial failure remains in `failed / artifactCleanupStatus=incomplete` with only pending paths. The old scheduler catch no longer updates a job using its stale page snapshot. Existing expired-lease reclaim and failed-job retries remain.
- `functions/src/export-attempt-maintenance.ts` Git blob `99aba29c4922c3be1d325c1bb693cfa3ed085758`: attempt cleanup now requires a current matching job, same token/subject, expired processing lease or expired completed package with both generation identities matching. Otherwise it defers by moving its due timestamp, recording the reason without mutating that job or deleting any object.
- Existing generation-conditional Storage helper `functions/src/export-generation-cleanup.ts` SHA-1 `cc65b97556a4886cc49bc56e5c49492f47305e6c` is reused unmodified. Conditional GCS deletion protects content identity; the new Firestore transaction lease guards final state mutation. These two protections are distinct.

## Test and admission ledger

- Original Node v22.16.0 pure-policy tests `tests/export-cleanup-state-policy.test.mjs`, SHA-1 `bf0837ff97d3109091ccbaf762b5f77f66d73b50`: **12/12 PASS** locally, exit 0, and standalone `tsc --noEmit --strict --target ES2022` PASS. Both tested files' local `git hash-object` values match the connector Git blobs exactly.
- `tests/export-cleanup-state-source-contract.test.mjs` SHA-1 `fd2005fcfacfec4704f29f6021c985acf6ea4468`: seven new source assertions wired into `scripts/verify-release.sh` blob `9cf8f9d55d9fcf2c551cccc4354a846116c8abcc` and `scripts/security-gate.sh` blob `40702103567bcf7ea0db323fd3d7cdf8aa2f5c04`. Those seven have **not** been executed against a complete native checkout.
- Exact connected GitHub source readback: **17/17 STATIC checks**, including current cleanup transaction lease/final CAS, stale-snapshot refusal, attempt job eligibility, GCS generation guard and gate hooks. This is **not** original Functions compile or authenticated Firebase runtime certification.
- Hosted GitHub CI exact R855 commit status must be read from its PR head after creation. Prior R854 five failed workflows had no visible Release Verification steps; no application build outcome can be inferred.

## Remaining P0 and limitations

An in-flight external GCS delete cannot be made atomic with Firestore lease changes. The exact-string GCS generation precondition remains mandatory. The current expiry claim is subject to ordinary multi-worker races and requires authenticated Firestore + real provider tests, especially expiry extension during deletion, changed generation, failed partial cleanup, duplicate claims, stale lease reclaim, 412 denial and removal of subject account during cleanup.

Partial/legacy exports lacking verified generations remain blocked for safe reconciliation, not silently erased. Full frozen root/Functions build, original Rules/four-emulator suites, real signed positive owner C6, protected Studio→Jobs→Replay, live provider-effective IAM and stale capabilities, eight deletion downstream ACKs, physical devices and founder release authorization remain unproven.

**REVIEW ONLY. NO PRODUCTION DEPLOYMENT, CLOUD CHARGE, PRIVATE MEDIA ACCESS, USER DELETION, IAM MUTATION OR MERGE. GENESIS RELEASE HOLD.**
