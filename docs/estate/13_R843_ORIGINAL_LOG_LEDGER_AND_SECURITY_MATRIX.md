# R843 — Verified source and CI ledger supplement (HOLD)

**Date:** November 7, 2026. **Classification:** exact-source and historical CI log review; no new integrated emulator execution or production consent test.

## Sources read

Genesis master `LifeLoggerAI/urai-labs-llc` draft #262 registry `docs/estate/00_START_HERE.md`; existing Privacy forensic draft #238 (head before this note `ec0c8f15c3ad82743310e98d605f2167536610e5`); master intake #265; Privacy R841 #236 `5daa194148c1f0b157062ca09b8f1b6e629d6d29`; long-standing export controller #160 `809d94ad7fc93322780d13ff3f0bade7612b3ec2`; original PR #160 Actions logs and five current #238 failed workflow results. Existing paths `docs/estate/01...` through `11...` retain previous controls and limits.

## Exact tracked snapshot inventory now reconciled

| Snapshot | Commit | Git-tracked file entries | Declared bytes | Inventory evidence |
|---|---|---:|---:|---|
| Privacy main | `1163d6f32a123ef9a6638e092a3eee5ec4a3b317` | 301 | 1,648,233 | existing `docs/estate/MANIFEST.json` |
| R841 review #236 | `5daa194148c1f0b157062ca09b8f1b6e629d6d29` | 373 | 2,162,240 | existing `docs/estate/MANIFEST.json` |
| Export security controller #160 | `809d94ad7fc93322780d13ff3f0bade7612b3ec2` | 339 | 1,957,311 | **new** `docs/estate/12_PR160_TRACKED_PATH_BYTE_MANIFEST.json`, 75 directory entries |

All three recursive Git API trees report `truncated=false`. **1,013 path entries across three snapshots are not 1,013 independent distinct bytes or complete historical objects.** Exact tracked paths, Git blob SHA-1 and declared size are inventoried, but entire blob contents and all historical refs were *not* independently hashed. Seven security-critical source blobs from R841/#160 and two R841 native-probe blobs have separately verified SHA-256 evidence in `docs/estate/10_EXPORT_SECURITY_SOURCE_BYTE_HASHES.json` and `01_COMPLETE_INVENTORY.md`. Other historical branches, LFS remote contents, deleted/unreachable objects, binaries and provider-generated data remain outside coverage.

## Newly retrieved original workflow log evidence: #160, October 14, 2026

- **Original exact head:** `809d94ad7fc93322780d13ff3f0bade7612b3ec2`; GitHub workflow run `38626776142`, `repository-and-functions` job `116067817012`, source log directly read. Unit suite: **29 test files, 418 passed**. The log also shows frozen root/Functions installation steps, lint, root and Functions typechecks and subsequent build stages; workflow/job concluded `success`. The displayed PASS summaries are direct log evidence, not a fresh 2026-11-07 rerun.
- **Same run, emulator-evidence job `116067817835`:** original log retrieved, with Firebase Auth, Firestore, Storage and Functions emulators explicitly started under `urai-privacy-integration-test`; `check-functions-emulator-loaded.mjs` returned **PASS: loaded createExportRequest rejects unauthenticated emulator request**; Firebase Rules tests report **2 files / 16 passed**; original `tests/integration/consent-current-actor.emulator.test.ts` reports **23 tests**, and 2 integration files passed. This is **historical synthetic loaded-service acceptance for #160's current-actor/export controls**, not protected private production rendering.
- Do **not** combine the 23 current-actor tests in this #160 emulator run with the *different* older historical Privacy #206 + Jobs #261 23/23 cross-service bridge. Their source heads, runner jobs and tested controls differ. Neither is a fresh R841/native full-pass receipt.
- GitHub says all ten returned #160 workflows concluded success; separately retrieved two actual job logs substantiate the selected original test counts. No passing workflows for the current R841/head are inferred.
- Five latest #238 exact-head workflows all concluded **failure**, including `Release Verification` run `42352787051`, `Consent Export and Deletion Branch Validation` `42352787174`, `Privacy package validation` `42352787157`, `URAI Production Verify` `42352787050`, and `URAI Privacy Release Verification` `42352787160`. Release Verification job ID `128344303828` has no steps; raw log fetch returned provider `404 BlobNotFound`. Email failure notification records that run failed quickly but does not establish compiler/test defect. **CI failure cause unknown, blocker open**.

## Security boundary and certification matrix

| Boundary/control | Specific source authority | Current result | Still missing |
|---|---|---|---|
| Browser/privacy center | `components/AuthGate.tsx`, `app/privacy-center/consent/page.tsx` | Firebase client UI gate; general Life Movie grant deliberately hidden | Device/browser tests, current backend check |
| Callable user/admin auth | R841 `functions/src/consent-api.ts` blob `43da4d49ccbee7cbe145d0729d921e10d859ba63`; #160 `privacy-actor-guard.ts` blob `bdc0ef7795b8124ad2515442b1eb87b8a1164baa` | Caller UID, token and current-account checking developed on different lineages | Merge collision review; actual deployed revoked/disabled/admin-loss denial |
| Firestore client isolation | R841 `firestore.rules` `0d3b73a129e22af80321647a6af36aaf0be3fc8b` | Owner/administrator rules, client mutation denial | Deployed exact-rule parity, signed principal identities |
| Storage export read | R841 `storage.rules` `3e25a6f99d87cbd156f3ed27548770429eacc0c0`; #160 `storage.rules` `50e6aae0752913130fc0214a3d63980cdef5f54b` | **DIVERGED**: client export read allowed in R841, denied in #160 | Reconcile and test provider-effective IAM and legacy GCS signed URLs |
| Export broker | R841 `export-lifecycle-functions.ts` `70ba1ce09e25af2e9bc9c2c32e9420bfa4b678ac`; #160 `2b810de902d393994a0500330f7223c7838d60e1` | #160 broker revalidates Auth/consent/fence per chunk; R841 mints GCS signed URL | Composite authenticated broker + current schema, real withdrawal 403 |
| Canonical purpose/expiry | R841 `consent-decision.ts` `35c699bd225c687bab8f1fd8e7315facc16c8148` | Purpose/tier/policy/expiry fail-closed | Real owner-visible issued consent and notice evidence |
| Movie scoped C6 receipt | `life-movie-scoped-receipt.ts` `b22ce33d498262e7348a66cfe038e2490d295c12`; `life-movie-render-authorization.ts` `e09564bffe1124c9a96bb54904680b606aff35c1` | SHA-256 integrity binds owner/tenant/movie/plan/source, rejects review-only metadata | **Cryptographic issuer signature and actual authorized production positive grant**; no hash-to-signature promotion |
| Jobs workload identity | `life-movie-jobs-identity.ts` `78f3cfe4b22fd39500ce3d94de55c9c5f46c7970` | Jobs-specific claims and checkRevoked validation developed | Actual IAM provisioned identity, cross-service runtime |
| Revocation outbox | `consent-revocation.ts` `5b069b79d657b5c2006dd0ab45c8e60709ff0a89` | Event/ACK transaction source, idempotency | Real downstream reception/cancel/replay denial |
| Jobs dispatcher | `consent-revocation-jobs-dispatcher.ts` `4126167b4350ba8afe6b19d7b60dec1ca891189f` | Lease/retry/ABA library source exists, not deployed/exported | Scheduled authorized worker and live ACK |
| Deletion | `deletion-contract.ts` `1a9ffd566bd6be8257b598a216cf254228971447`; `deletion-mutation-guard.ts` `45746faf46a51d7290a2b86b4daa29ef426d7012` | Three local active adapters and eight pending cross-system; local-zero verification blocked from falsely claiming global completion | Real subject-scoped 8 downstream receipts, storage-generation deletion, Auth and provider purge |
| Audit/exports | R841 `export-request.ts` `888b4aa7cb193dfcc8b34a895b5c5d3218a994bf` and `consent-api.ts` | Protected audit/receipt objects, server-generated hashes; C7 distinct from C6 | Deployed immutable evidence/retention and real scoped export/delivery |
| Physical/device | No shipping revision source accepted | Not certified | Authenticated owner/foreign/disabled browser & mobile/XR access, assistive technologies |
| CI/production parity | PR #160 October CI vs latest R841 #236/#238 failures | Older partial source is green; current combined source not certified | Clean exact-sha entire source native gates, GCP/Firebase deploy verification, reviewer/founder GO |

**Threat assumptions:** browser-authenticated claims are not sufficient where Admin SDK, GCS signed URLs, service workload identities, token revocation races, stale object generations or issuer privileges bypass client Firebase Security Rules. Cryptographic hash integrity is not signer authority. A denial evaluated before an asynchronous boundary is not sufficient if access or media bytes are subsequently released without revalidation.

## Unresolved P0

1. Converge review-only #160 hardened broker/current actor/Storage denial/generation deletion with R841 scoped C6/Jobs/consent/revocation/deletion control plane in a **new nonconflicting composite review branch**, never forced on existing worker heads.
2. Run original clean frozen installs/builds, security/rules/tests and four emulators on the **composite exact SHA**, capturing immutable log hashes, real Auth/Firestore/Storage/Functions identities and failure outcomes.
3. Obtain separately authorized production signed positive movie-specific C6 issuance, media provenance, protected Studio→Jobs→Replay render and all-denial replay/copy/expiry/revocation/deletion proof, deployed IAM and link recall window. Do not use actual private family media for ad hoc tests.
4. Verify eight external deletion contributor receipts, independently reviewed source/deployment parity, physical device and founder release decision.

**No code, storage, cloud, CI rerun, consent, media, IAM, or production mutation was performed in this R843 documentation supplement. PRODUCTION HOLD remains mandatory.**
