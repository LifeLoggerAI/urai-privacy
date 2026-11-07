# R844 — Export broker release hard-stop (review only, HOLD)

**Date:** 2026-11-07. **Base:** R841 Privacy #236 at `5daa194148c1f0b157062ca09b8f1b6e629d6d29`. **Donor:** historical PR #160 at `809d94ad7fc93322780d13ff3f0bade7612b3ec2`. Both original branches are unchanged. This R844 branch is NOT deployable or approved for merge to production.

## Original-source security finding and requirement

The exact R841 `functions/src/export-lifecycle-functions.ts` blob `70ba1ce09e25af2e9bc9c2c32e9420bfa4b678ac` exports `getExportDownloadUrl` and invokes `object.getSignedUrl({action:"read"...})`, with no present canonical C7 receipt, deletion tombstone or current account recheck before issuing a GCS capability. R841 `storage.rules` permits direct authenticated owner/admin export reads. Independent historical #160 contains `downloadExportPackage` onRequest, consent/receipt and current Auth revalidation, 64KiB stream fences and client Storage export deny. PR #160 is an unmerged source candidate, not approved deployment. Its October 14 hosted exact-head test receipt was 418/418 unit, 16/16 rules and 23/23 current-actor integration, at **#160's SHA only**.

The current R841 code cannot be promoted while direct Storage signed URLs survive and revocation cannot invalidate already issued capabilities. A signed URL is not subject to Firebase Storage client Rules once issued. Source exact SHA/binary ledger and prior tests: Privacy draft #238 `docs/estate/10_EXPORT_SECURITY_SOURCE_BYTE_HASHES.json`, `11_EXPORT_SECURITY_LINEAGE_RECONCILIATION.md`, `12_PR160_TRACKED_PATH_BYTE_MANIFEST.json`, and `13_R843_ORIGINAL_LOG_LEDGER_AND_SECURITY_MATRIX.md`.

## Actual change in R844

- `scripts/assert-export-broker-boundary.mjs`: new standalone Node-standard-library source-admission guard; no environment, CLI or fixture override. Requires absence of legacy GCS signed URL minting, deployed onRequest broker, per-64KiB current consent/owner revalidation, current checkRevoked token verification and account/admin authority, transactional C7 projection, current consent in export processing, direct Storage export read/write deny, safe authenticated browser fetch with redirects rejected, and deployable Functions export.
- `tests/export-broker-boundary.test.mjs`: 12 focused test cases, including multiple intentional rejection cases, and a positive *shape fixture* (NOT real implementation certification).
- `scripts/verify-release.sh` and `scripts/security-gate.sh`: now run the new negative test and source gate. Existing source/unit/CI protections are not removed or bypassed.
- This branch inherits R841's original existing functions/rules, so the guard **correctly returns nonzero**: broker actor/client source absent, legacy GCS URL present, Storage owner direct read enabled, and no deployed authorized streaming broker. This is a deliberate release HOLD, not a passing combined build.

## Evidence, limits, and original commands

Container Node22.16.0 test execution before commit: `node --test tests/export-broker-boundary.test.mjs` **12/12 PASS**, 0 failed. Local security checker raw bytes SHA-256 `f2e58a0d1ed00f23b6dab5820864f193c798ca60252242d8e1efdf3dd076092a`, original negative test source local SHA-256 `68362529eed1f75e1e4cee2636ce492f2951890316d6b846c6d32ad0b3901066`. The committed test source has some harmless textual differences from the local pre-commit fixture; **the committed GitHub exact-head native suite has not been executed**, so do not label the 12/12 as exact committed build certification. Source code is a guard against known architecture regression, not a substitute for real emulator, cloud IAM, owner approval, production signature or private media acceptance.

**Do not move #160, R841, #238, main or #262.** Existing GitHub Actions admission on R841/#238 remained blocked with no execution steps; a new R844 CI success cannot be assumed. The hard stop cannot grant production acceptance even after it eventually passes.

## Next safe engineering progression

(1) Construct a new independently reviewed composite retaining #160 authenticated export broker/client/Storage rules/current actor checks/generation-fenced deletion and R841 exact C6 policy, Jobs identity, revocation dispatcher contracts and global deletion HOLD. Merge conflicts must be reviewed at source semantics and tests, not overwritten by file wholesale. (2) Reconcile the `scripts/validate-rules.mjs` and `scripts/check-complete-export-contract.mjs` older assumptions to the broker-only architecture WITHOUT disabling checks. (3) Run exact committed source tests, frozen installs, Functions/Next builds, Firestore and Storage rules, all four emulators, cross-service Jobs current owner/consent and authorization state races. (4) Prove actual IAM, stale signed URL/window, owner/foreign/revoked/disabled on live disposable subjects, protected Studio→Jobs→Replay private rendering, cross-system eight deletion acknowledgments, physical devices and founder release authorization.

**Release verdict: HOLD. No production IAM, private media, Firebase project or paid compute accessed.**
