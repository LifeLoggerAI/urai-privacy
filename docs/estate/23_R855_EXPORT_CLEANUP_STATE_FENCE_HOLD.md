# R855 — Stale worker export cleanup claim and identity fence (RELEASE HOLD)

**Date:** 2026-11-07. Source [Privacy engineering draft PR #250](https://github.com/LifeLoggerAI/urai-privacy/pull/250), exact SHA `999e622330c1969335f440a4cdd9d76c9ef3610d`, stacked on R854 draft #249 SHA `b58a9617fde181c82d11531639ffec92bf24fdcf`. All original donor and review PRs, `main`, IAM and production untouched.

## Source findings
R854's exact-string `ifGenerationMatch` protected Storage object bytes from same-name replacement, but the completed-package expiry scheduler read a paged job and could delete content then expire a different version of that job; failure handling similarly wrote status using an old page snapshot. `export-attempt-maintenance.ts` could claim due cleanup despite a still-active, unexpired or superseded parent job. This is a source-level correctness/security risk, not evidence of live accidental deletion.

## Implemented R855
- `functions/src/export-cleanup-state-policy.ts` exact Git blob `5b1111d1d146f0633fa55ef013139df664c6bd41`: pure fail-closed comparison of owner, request, paths, exact export/manifest generations, package expiry, job/attempt token and lease state.
- `functions/src/export-lifecycle-functions.ts` Git blob `a4437a944d12c31a6de1109cdaa1f61b611c8bcb`: completed package cleanup claims a unique artifact-cleanup lease in a current Firestore transaction, marks job inaccessible before any conditional GCS removal, and requires identical lease, owner, request, paths, generations and expiry before finalizing as expired. Failed partial cleanup stays failed/incomplete with only pending paths; no stale page-based failure update. Existing expired lease reclaimer and retry retained.
- `functions/src/export-attempt-maintenance.ts` Git blob `99aba29c4922c3be1d325c1bb693cfa3ed085758`: checks current parent job/attempt, active processing lease, completion expiry and generation linkage. Active, unexpired or superseded parents cause a deferred due time and recorded reason without deletion.
- Reuses unchanged R854 exact-string conditional GCS delete helper blob `cc65b97556a4886cc49bc56e5c49492f47305e6c`; external deletion and Firestore updates are NOT an atomic cross-provider transaction.
- Local Node 22.16.0 original `tests/export-cleanup-state-policy.test.mjs` Git blob `bf0837ff97d3109091ccbaf762b5f77f66d73b50`: **12/12 PASS** at Git-blob-identical source `5b1111d1d146f0633fa55ef013139df664c6bd41`. Strict pure TypeScript 5.8.3 `tsc --noEmit` PASS.
- New `tests/export-cleanup-state-source-contract.test.mjs` Git blob `fd2005fcfacfec4704f29f6021c985acf6ea4468` has seven source checks, wired to `scripts/verify-release.sh` Git blob `9cf8f9d55d9fcf2c551cccc4354a846116c8abcc` and `scripts/security-gate.sh` Git blob `40702103567bcf7ea0db323fd3d7cdf8aa2f5c04`. Seven source cases NOT executed on complete checkout. Independent GitHub readback: **17/17 STATIC checks** across actual source, helper, tests and release hooks.

## Hosted CI and remaining independent gates
Exact R855 SHA triggered five failed GitHub Actions: Privacy Release Verification `42432222674`, Release Verification `42432222691`, Consent Export and Deletion Branch Validation `42432222710`, Production Verify `42432222673`, package validation `42432222695`. Release job `128583422096` had **no visible steps**; failure root cause unknown, no native test execution can be inferred.

No full exact-R855 frozen root/Functions build, original Rules/four-emulator tests, real GCS precondition/412 and lease-race acceptance, owner-signed positive C6, live Studio→Jobs→Replay private media, provider IAM/stale links, eight subject-specific downstream deletion acknowledgments, device acceptance or owner GO. Legacy and partial artifacts without exact generations remain blocked for safe review rather than guessed and deleted. Full deletion completion **not certified**.

**No paid cloud compute, live private media, IAM changes, destructive user action, merge or production deployment. GENESIS RELEASE HOLD.**
