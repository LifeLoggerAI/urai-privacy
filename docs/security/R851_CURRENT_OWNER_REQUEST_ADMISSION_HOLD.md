# R851 — Current-owner export / deletion request admission (RELEASE HOLD)

**Date:** November 7, 2026. Based on R850 [draft PR #245](https://github.com/LifeLoggerAI/urai-privacy/pull/245), exact parent `1b8d310e265dbe18bfb177d881729d2be6124752`. Isolated R851 child `review/chalk-r851-current-owner-export-deletion-admission-20261107`. Other workers' PRs, main and provider state are unchanged.

## Actual security finding

Previously exported `createExportRequest` and `createDeletionRequest` in `functions/src/index.ts` trusted the initial callable authentication and checked only `deletionFence.data()?.active === true`. A present malformed/stale tombstone, or a planning-lease state, was not a guaranteed refusal. Export creation did **not** require current C7 consent, receipt/hash projection or current token before creating an `exportJobs` record. The protected processor/streaming broker rechecks permission later, reducing downstream exposure; this is an authorization-admission defect, NOT proof of leaked private media or production deployment.

## Source changes

- `functions/src/request-admission-policy.ts` Git blob `d8f36b0de08bd33595cf62c758e55d1b1666679a`: fail-closed pure policy checking owner UID, strict deletion state, canonical C7 purpose/tier/policy/receipt, projected receipt/status, expiry and subject identity. It rejects inherited/accessor-backed fabricated authority. Importantly, a deletion request **never** requires C7 export consent; verified absence of a tombstone permits the owner's deletion right.
- `functions/src/index.ts` Git blob `e436e4b72cdf3c14f381aa97eeb15b34c9763428`: both public request handlers now call `createPrivacyActorGuard` (signed, nonrevoked bearer/current account) and `actor.requireCurrent()` at transactional write boundaries. Export creation reads the C7 `consentRecords` document and subject deletion tombstone together inside the transaction, evaluates `data.export` consent, verifies receipt projection and expiry, and refuses before creating a request/job if invalid. Deletion request creation uses `checkedLifeMovieDeletionState` with subject-UID binding; it does NOT require previous consent.
- New `tests/request-admission-policy.test.mjs` Git blob `e3c217f082150b009560b8e2a8541f77a807c1bf`; `tests/request-admission-source-contract.test.mjs` Git blob `5f286f5b4176600df9db0986d55827f826daf36e` with six source-wiring cases. Both test commands are included in the release verifier and independent security gate: release `477b9aa594d3ba8795fe7a7df489c6993db63076`, security `10a701de4722aba7561435c66c0cf115e451bc45`.

## Exact evidence and limits

- Original local **21/21 PASS** on Node 22.16.0, plus `tsc --noEmit --strict` PASS for the pure policy helper. Local `git hash-object` matched the committed GitHub helper and test Git blobs byte-for-byte.
- Independent GitHub readback of original R851 source found **15/15 static conditions present**, including both actual callables, the C7/fence transaction ordering, retained deletion-right exemption, test and gate hooks. The six source-contract cases were added but not executed as a complete repo test, and these checks alone do not prove runtime atomicity.
- Local container has Node 22 and Java, but **cannot resolve github.com** and contains no complete git checkout, `node_modules`, or Firebase emulator binaries. Therefore no complete exact-head npm ci, Functions/Next build, original integrated Rules/four-emulator execution, positive signed private C6, Jobs/Studio/Replay protected media, provider IAM, real revocation/deletion races, eight downstream subject ACKs, user-device tests or production authorization was performed.
- Existing R850 GitHub Actions Release Verification run `42403048489` job `128494774101`: failure, zero steps; direct original log retrieval returned GitHub `BlobNotFound` 404. This confirms **missing hosted execution evidence**, not an application test failure, and does not establish CI runner admission cause.
- R848 plan v4/deletion authority, R847 Firestore version, R846 GCS generation, R845 protected broker/C7, R841 C6 scoped Jobs verifier, and eight-ACK global deletion-completion HOLD remain source-present.

**This is source-level remediation under a separate draft review, not release certification. No live media, user deletion, IAM mutation, compute/billing action, forced merge or production deployment. KEEP RELEASE HOLD.**
