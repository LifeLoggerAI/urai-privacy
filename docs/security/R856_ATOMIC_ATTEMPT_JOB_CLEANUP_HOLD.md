# R856 — Parent-job and attempt cleanup finalization must be atomic (RELEASE HOLD)

**Date:** November 7, 2026. **Parent:** R855 draft Privacy PR #250, head `999e622330c1969335f440a4cdd9d76c9ef3610d`. Independent review branch `review/chalk-r856-atomic-attempt-finalization-20261107`. No main/production changes.

## Verified source defect

R855 addressed completed-export expiry state races, but `functions/src/export-attempt-maintenance.ts` still marked a completed parent job `expired` (and a processing job `failed`) **before actual GCS cleanup**. The attempt cleanup transaction subsequently only checked the attempt's cleanup token, not the current parent job. A failed/partial cleanup could leave a misleading expired job, and a stale attempt could finalize despite an owner/request/generation/job change. This is a source-level correctness/privacy retention risk, not a claimed production incident.

## R856 source repair

- `functions/src/export-cleanup-state-policy.ts`, Git blob `c6444509fa4623db0d8058212bc433aacf3550d5`: adds `attemptCleanupFinalizationBlockReason`. Requires the same UID, job ID, request ID, attempt token, cleanup token, exact two Storage object paths/generations, pending path identities and nonexpired attempt + job cleanup leases. Mismatch fails closed.
- `functions/src/export-attempt-maintenance.ts`, Git blob `7c7f1dffb4280304880f964589445849b1871a47`: the initial Firestore transaction now claims `artifact_cleanup` on **both** attempt and parent job, using the same cleanup token, records exact generation and pending paths, and fences old processing authority. It no longer preemptively writes `expired`. After generation-conditional GCS deletion, a single Firestore transaction reads both records, calls the new policy, then updates both states and an audit receipt atomically. Successful completed-package cleanup may become `expired`; partial cleanup instead becomes `failed/incomplete`, preserving pending file paths. Attempt due time is cleared and failed-job cleanup owns any remaining paths. Missing job/attempt records are not recreated.
- Existing exact-string `ifGenerationMatch` Storage helper remains `functions/src/export-generation-cleanup.ts` Git blob `cc65b97556a4886cc49bc56e5c49492f47305e6c`. Cross-provider effects are not atomic even with joint Firestore finalization.

## Evidence and test classes

- Exact source-level pure-policy suite from local Node v22.16.0: **27/27 PASS** (R855 12 previously tested plus R856 15 new) with strict isolated TypeScript `tsc --noEmit` PASS; current Git SHA-1 of combined policy `c6444509fa4623db0d8058212bc433aacf3550d5`, new test `tests/export-attempt-cleanup-finalization.test.mjs` blob `dfc556d959e3e52c9a53374574f9ada0c923d074`. Both hashes matched local `git hash-object`.
- New `tests/export-attempt-cleanup-finalization-source.test.mjs` blob `709db7850e7a0060cde9904469800b95507ebb65`: seven additional source-contract cases wired into release verifier blob `f7c80f1fbbd93b3e6cdde6164efaa165835ed79c` and security gate blob `d81afc6aa6435f3f73c38452e12aeb9bdf10f31a`. These seven **have not been run in a full native repository checkout**.
- Independent connector GitHub readback: **17/17 STATIC** checks across the source contract, both leases, current-owner/generation checks, pending recovery, exact GCS precondition and gate hooks. A source-pattern check is not a Functions build or authenticated runtime proof.
- R856 hosted CI result to be read separately after PR creation. Earlier R855 exact-head five workflows failed with Release Verification job lacking visible execution steps; root cause unknown, not evidence of a failed compiler/test.

## Remaining release HOLD

No exact R856 root + Functions frozen install/build or authenticated original Firebase Rules/Auth/Firestore/Storage/Functions four-emulator end-to-end run; no disposable GCS 412/replaced generation + live job/attempt lease race test; no positive signed owner C6; no integrated private Studio→Jobs→Replay; no provider effective IAM/stale capability acceptance; no eight signed downstream subject deletion ACKs; no physical device/user acceptance or founder release GO. Old artifacts without recorded Storage generation remain blocked for owner-authorized reconciliation. Do not infer completion from a removed object name or partial cleanup.

**RELEASE HOLD. No paid compute, production deploy, private media, real user deletion, IAM mutation or merge.**
