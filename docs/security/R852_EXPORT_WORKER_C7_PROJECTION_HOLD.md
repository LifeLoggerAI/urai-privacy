# R852 — Export worker must not create C7 consent (RELEASE HOLD)

Date: 2026-11-07. **Source parent:** Privacy R851 draft PR #246 at `2a05f7a9a08e2f060a929549c18de82bc9a41103`. Separate isolated child R852 `review/chalk-r852-c7-export-processor-projection-fence-20261107`. No production deployment, owner media, IAM mutation or merge.

## Confirmed source problem

The configured `functions/src/export-request.ts` export processor, despite checking that the canonical consent record was granted, did not require the existing tombstone C7 projection to match before starting. It wrote `exportConsentStatus: "granted"`, hash, policy and expiry itself while claiming processing. This allowed a privileged worker to **repair or mint a positive consent projection** that should only originate in `setCanonicalConsent`'s canonical owner-consent transaction. The processor also only checked the request UID/type rather than whether its state was actually eligible to process, allowing stale/cancelled request and job combinations to approach the worker claim. No deployed leakage or rendered media has been observed.

## Actual source changes

- Modified `functions/src/request-admission-policy.ts` blob `c05f9583f44348d9908db4d09ebf99e2d495213c`: added `exportProcessingRequestStateBlockReason`; rejects revoked, cancelled, failed, completed and mismatched request/job combinations, active processing leases, missing states.
- Modified `functions/src/export-request.ts` blob `c73d62f1af788eb9559469f9268657e81dc65bf0`: worker's claim transaction now demands matching current canonical C7 receipt/projection, strict deletion-state clearance, and eligible request/job states **before mutation**. It no longer sets the C7 grant/projection itself. The same C7/projection verification runs in the long-running worker authority check before fetching private records and in the final publication transaction. Existing attempt ownership, cancellation cleanup and publication evidence remain source-present.
- New original test `tests/export-processing-claim-policy.test.mjs` blob `f69672e40b363cd996f766f94227dcad3d5602ad`; existing `tests/request-admission-policy.test.mjs` blob `e3c217f082150b009560b8e2a8541f77a807c1bf`. **33/33 PASS** together in local Node 22.16.0, plus strict TypeScript check of the combined pure policy module. Git blobs matched local bytes.
- New five-case source contract `tests/export-processing-c7-source-contract.test.mjs` blob `557d1dd7005c9d518b6f753854e7dfea390e31f1` wired in both `scripts/verify-release.sh` blob `df4d91de4fe9125f512919139603668d8f34f0ec` and `scripts/security-gate.sh` blob `10ef3471b3ea8c09f3d9514735e9e8da36c087c0`. Newly added contract was **not** run against a full checkout. Connected GitHub readback: **14/14 source patterns present**, separate from executable suite.

## Hold gates

Exact R852 full root/Functions frozen dependency installs/typecheck/Next build/Functions build, original unit/security Rules, real Auth+Firestore+Storage+Functions four emulators, owner/foreign/disabled/revoked/old consent projection and late-race tests, signed positive owner C6 issuer, source rights, private Studio→Jobs→Replay, provider IAM/URL revocation, deletion acknowledgements and device acceptance remain unproven. Existing R851 GitHub workflows failed with no visible steps; R852 execution status must be read separately. A separate forensic concern remains around generation-unpinned GCS cleanup and download file reads; it is not solved by this C7 worker fix.

**RELEASE HOLD.** Do not count pure tests or static admission as real service certification. No actual private data was accessed.
