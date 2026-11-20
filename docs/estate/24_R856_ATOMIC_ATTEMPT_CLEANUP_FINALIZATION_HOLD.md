# R856 — Atomic attempt+job cleanup finalization (RELEASE HOLD)

**Date:** 2026-11-07. [Privacy Engineering draft PR #251](https://github.com/LifeLoggerAI/urai-privacy/pull/251) exact SHA `e6d38815bdef8331c3e20746f341114f68accee3`, stacked on R855 PR #250 `999e622330c1969335f440a4cdd9d76c9ef3610d`. Prior workers/main/production unchanged.

## Source defect and repair

R855 had protected the package-expiry worker but attempt maintenance still prematurely marked a completed parent job `expired` or a processing job `failed` **before deletion completed**. Its attempt completion updated only the attempt's cleanup token without re-reading/reconciling the parent job. The source could therefore misrepresent incomplete or superseded deletion as completion; no actual production incident has been confirmed.

R856 updates `functions/src/export-attempt-maintenance.ts` SHA-1 `7c7f1dffb4280304880f964589445849b1871a47`: the current claim transaction marks **both** attempt and parent export job as `artifact_cleanup` under the same cleanup token, and fences any old processor. The GCS helper still uses string `ifGenerationMatch` (blob `cc65b97556a4886cc49bc56e5c49492f47305e6c`). After cleanup, a single Firestore transaction reads both current records and requires exact owner, job, request, attempt token, cleanup token, both paths/generations, pending path identities, and valid unexpired leases. It then atomically writes both final states and a signed-style audit hash. Only complete cleanup of a previously completed package becomes `expired`; partial cleanup becomes failed/incomplete, retaining remaining paths for failed-job recovery. Missing job/attempt records are not recreated.

New source-pure `attemptCleanupFinalizationBlockReason` in `functions/src/export-cleanup-state-policy.ts` Git blob `c6444509fa4623db0d8058212bc433aacf3550d5`, with new test `tests/export-attempt-cleanup-finalization.test.mjs` blob `dfc556d959e3e52c9a53374574f9ada0c923d074`. Local Node 22.16.0 combined original 27 tests **27/27 PASS**, using exact Git-identical files; strict isolated TypeScript check PASS. New seven-case `tests/export-attempt-cleanup-finalization-source.test.mjs` blob `709db7850e7a0060cde9904469800b95507ebb65` wired to release verifier `f7c80f1fbbd93b3e6cdde6164efaa165835ed79c` and security gate `d81afc6aa6435f3f73c38452e12aeb9bdf10f31a` but NOT executed against a complete original checkout. GitHub exact-source readback: **17/17 STATIC** targeted conditions. These evidence classes are not interchangeable.

## Current CI

Exact R856 head five workflows reported failure: Production Verify `42433071223`, Privacy Release Verification `42433071231`, Release Verification `42433071232`, package validation `42433071281`, Consent Export and Deletion Branch Validation `42433071334`. Release Verification job `128585993484` returned **steps=null**, so no exact-source compiler/test result may be inferred and the CI failure root remains unknown.

## Release-critical gaps

No complete frozen root/Functions build, original authenticated Firebase Rules/Auth/Firestore/Storage/Functions four-emulator integration, disposable real GCS 412/replacement and concurrent lease-expiry/deletion races, real signed owner-positive C6 media consent, protected Studio→Jobs→Replay, provider IAM/stale URL enforcement, eight signed downstream subject deletion acknowledgements, device acceptance, or founder GO. Unknown-generation legacy/partial artifacts remain blocked from automatic deletion. Firestore state transaction and GCS mutation are separate providers; a passing pure policy cannot establish live atomicity.

**No production deploy, real private data access, paid compute, IAM changes, actual deletion, merge or consent issuance. ONE URAI GENESIS RELEASE HOLD.**
