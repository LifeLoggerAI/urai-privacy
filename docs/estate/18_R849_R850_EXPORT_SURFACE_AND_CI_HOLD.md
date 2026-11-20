# R849–R850 — Legacy export surface retirement and Node 22 release-runner reconciliation

**Date:** 2026-11-07. Source lineage: R848 Privacy draft PR #243 `ec71f15a545288685b4bd5846ecf88cdb3314e5c` → R849 draft [#244](https://github.com/LifeLoggerAI/urai-privacy/pull/244) `c5eda2f01f708af544d966ade67fc164e0e670c5` → R850 draft [#245](https://github.com/LifeLoggerAI/urai-privacy/pull/245) `1b8d310e265dbe18bfb177d881729d2be6124752`. These are stacked review branches; original donor #160, R841 #236, R844–R848, `main` and production remain unmodified.

## R849 security finding and source correction

The earlier R848 `functions/src/index.ts` still contained two separately exported legacy export handlers, including `getExportDownloadUrl` calling GCS `object.getSignedUrl({action:"read"})` without current canonical C7, account or deletion-state admission. Configured `functions/src/functions-entry.ts` did NOT export those old handlers: it already pointed to the consent-bound broker `export-lifecycle-functions.ts` and current export processing `export-request.ts`. Thus the finding is a **dangerous dormant alternate source entry**, not evidence that production actually served these old endpoints or leaked private media.

R849 removed both legacy processor and signed-URL callables and their obsolete schemas/TTL/owner-admin helper from `functions/src/index.ts` Git blob `fe06e79254c8daad6deb27798048437662bd502e` while keeping the configured authenticated broker and R848 versioned deletion. Added exact-blob `scripts/assert-no-legacy-export-callables.mjs` `f0e48b760eb7445d17ede8b64186a0a83f479933` and `tests/no-legacy-export-callables.test.mjs` `2160ec98db09844beb28f48c0591f1ba8c678537`. Both release and security gate invoke the source admission. **Local original Node22 fixture 12/12 PASS**, GitHub exact source **13/13 static conditions present**. Pure text/fixture evidence, not live broker acceptance.

## R850 CI/runtime discrepancy and correction

Six workflow YAML files previously pinned seven Node 20.19.0/20.19.5 runner settings while `functions/package.json` specified Node 22 and release scripts used `--experimental-strip-types`. R850 changes all seven settings to Node **22.16.0**; preserves original pinned setup-node Action and Firebase Java setup. Files and Git blobs:
- `consent-decision-branch-validation.yml` `b2378a13b879a54a028d0672c291aee765e2357c` (two jobs)
- `dependency-remediation-candidate.yml` `2d0748be93b5a5e114c0d06bf3053003bcb1f8fd`
- `privacy-release-verification.yml` `54f0cfccd6fdbb65ec482469d32e9290a941a983`
- `release-verification.yml` `f912654da991657c62edb0a485e6d9322e261f05`
- `release-verify.yml` `22b3371c0ed23c047ccfffb5dd8a4a6c83014c74`
- `urai-production-verify.yml` `a91c5e1d0fcee08be8343a424b16efa03feaa980`

Added source policy `scripts/assert-node22-release-workflows.mjs` `b005b74e060da87a06733fad943fea2c6eb4e0c4`, tests `tests/node22-release-workflows.test.mjs` `d5826afbe92212649efc196033cf9474fb470f7a`, source guard included in release/security scripts. **Local original Node22 fixture 8/8 PASS**, GitHub exact source **7/7 static verification conditions present**. Neither proves actual hosted CI execution.

## Exact hosted CI ledger

R849 exact head had five failed workflows: `42402746874` Production Verify; `42402746942` package validation; `42402746892` Release Verification; `42402746873` Consent Branch Validation; `42402746946` Privacy Release Verification. Release job `128493869790`: no visible steps.

R850 exact head likewise had five failed workflows: `42403048515` Consent Branch Validation; `42403048353` Privacy Release Verification; `42403048489` Release Verification; `42403048395` package validation; `42403048392` Production Verify. Release job `128494774101`: no visible steps. **Root cause remains unknown** and could predate any actual checkout/Node setup. Do NOT attribute these failures to a compiler, new source guard or Node runtime mismatch without executed logs.

## Outstanding non-negotiable release gates

Clean exact-source frozen root/Functions installs, compiled builds, original unit/security Rules + four-emulator and cross-service authenticated tests, actual signed positive owner C6 consent, proper IAM and protected Studio→Jobs→Replay, active revocation/deletion, stale historical signed URL effective denial, eight downstream subject-specific deletion acknowledgements, physical devices, independent security review and founder release authorization. Source changes do not invalidate previously issued GCS URLs or certify deployed environments.

**No production mutation, personal private-media access, paid compute, forced merge or consent issuance occurred. Keep production RELEASE HOLD.**
