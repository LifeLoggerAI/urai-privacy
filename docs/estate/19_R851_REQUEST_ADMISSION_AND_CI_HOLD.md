# R851 — Request creation authorization + source-pinned CI limitations

Date: 2026-11-07. [Privacy engineering draft PR #246](https://github.com/LifeLoggerAI/urai-privacy/pull/246) exact source head `2a05f7a9a08e2f060a929549c18de82bc9a41103`, stacked on R850 PR #245 `1b8d310e265dbe18bfb177d881729d2be6124752`. Earlier donor and engineering branches remain unchanged; **RELEASE HOLD**.

## Finding

The configured `createExportRequest` and `createDeletionRequest` source in the R850 `functions/src/index.ts` only checked `deletionFence.data()?.active === true` and initial callable authentication. It did not fail closed on malformed/pending deletion state, and export request creation did not check canonical C7 consent/receipt or the synchronized projection before creating an `exportJobs` document. Downstream export processing and protected delivery already have stricter gates. This is a source-level job admission risk, **not evidence of deployed leakage**.

## Actual R851 source changes

- Added pure fail-closed `functions/src/request-admission-policy.ts` Git blob SHA-1 `d8f36b0de08bd33595cf62c758e55d1b1666679a`; checks owner-scoped deletion state, current data.export C7 purpose/tier/status/policy, positive 64-digit receipt, projection, expiry and malformed/inherited/accessor-backed evidence.
- Modified `functions/src/index.ts` Git blob `e436e4b72cdf3c14f381aa97eeb15b34c9763428`: both callables require `createPrivacyActorGuard` and recheck signed token/current account. Export creation reads current consent plus deletion tombstone in one Firestore transaction and refuses before writing job/request on invalid consent/fence. Deletion creation now uses the strict tombstone classifier, but **does not require C7 export consent**, preserving user deletion rights even without a consent record.
- Original pure test suite `tests/request-admission-policy.test.mjs` exact Git blob `e3c217f082150b009560b8e2a8541f77a807c1bf`: **21/21 PASS** locally with Node 22.16.0. Strict isolated TypeScript check PASS. These Git blobs matched the local tested files.
- Six source-contract cases in `tests/request-admission-source-contract.test.mjs` Git blob `5f286f5b4176600df9db0986d55827f826daf36e`, wired to release and security verification scripts `477b9aa594d3ba8795fe7a7df489c6993db63076` and `10a701de4722aba7561435c66c0cf115e451bc45`. Independent exact-GitHub source readback **15/15 static checks present**. Full-source native execution is not claimed.

## Actual hosted CI observation

Exact R851 head returned five failed workflows: URAI Privacy Release Verification `42411610214`; Privacy package validation `42411610235`; Release Verification `42411610242`; Consent Export and Deletion Branch Validation `42411610300`; URAI Production Verify `42411610213`. Release job `128520755934` returned **steps=null**. The prior R850 Release Verification log retrieval returned `BlobNotFound` (404); this remains an infrastructure/execution-evidence blocker of unknown cause. No application test/code failure was independently observed in these jobs.

## Hold gates

Exact-current root and Functions locked installs/build, original native/security suites, Auth/Firestore/Storage/Functions four-emulator tests, real owner/foreign/revoked/disabled/consent-change concurrent admissions, real signed positive C6 owner authorization and selected-source private Studio→Jobs→Replay, IAM, deletion/revocation proof, eight authenticated downstream deletion acknowledgments, devices and founder GO are not certified. No production merge, IAM mutation, compute expense, private media or actual user deletion was performed.

**Source integration and 21 local pure tests are useful work, but are NOT production or user-private-media certifications. KEEP RELEASE HOLD.**
