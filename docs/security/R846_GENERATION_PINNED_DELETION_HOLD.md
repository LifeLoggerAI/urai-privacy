# R846 — Generation-pinned deletion admission, source only (HOLD)

2026-11-07 | GitHub `LifeLoggerAI/urai-privacy`. **Isolated R846 child of R845 PR #240** source `91d85bb55b13d21004d099dc8c339acf94ce3627`. No changes to existing PR #240, R844 #239, donor #160, R841 #236, or production.

## Security change
- New `functions/src/deletion-storage-generation.ts` uses literal, owner-scoped, full-precision GCS generation strings; rejects foreign/traversal objects, unapproved new names, missing/inherited/invalid generation values, mismatches, duplicate names, and any changed generation in resumed subset.
- `functions/src/index.ts` deletion plan now uses mandatory `privacy-deletion-plan-v2` schema, stores and hashes `storageObjectGenerations` alongside export object names. A legacy v1 plan fails closed. No raw numeric generation conversion.
- Destructive export object deletion now resolves the **exact approved and currently observed generation** then calls GCS `delete({ ignoreNotFound:true, ifGenerationMatch:generation })`; HTTP 412 is explicitly classified as a failed precondition. A replacement object must not be erased by stale approval.
- `scripts/verify-release.sh` runs nine new Node22.16 type-stripped policy tests and four source contract checks before full frozen builds. R844's broker hard-stop is retained.
- `tests/deletion-storage-generation.test.mjs`: exact local bytes Git SHA-1 `e20c59ff1e7ef3cd54db026dbe4a1576153fd94a`, underlying module `777b826c748f5050d534d6e446c82e3422cd25f8` (fetched GitHub blobs match local git hash-object). **Node v22.16.0 local 9/9 PASS**, archived TAP available in local project workspace. The ninth case simulates GCS precondition 412 using a fake provider, **not actual GCS**.
- Four source contract checks were added but have **not** been run as a complete committed-source Node suite in this environment. Read-only GitHub source inspection verifies the required v2 schema, generation hash, precondition and R841 downstream hard-stop shapes, not behavior.

## Exact source identity
- `functions/src/deletion-storage-generation.ts`: Git blob SHA-1 `777b826c748f5050d534d6e446c82e3422cd25f8`, UTF-8 JS string length 2409
- `tests/deletion-storage-generation.test.mjs`: Git blob SHA-1 `e20c59ff1e7ef3cd54db026dbe4a1576153fd94a`, UTF-8 JS string length 3654
- `tests/deletion-generation-source-contract.test.mjs`: Git blob SHA-1 `0b86fd14144de9c721d80b60e25730ee10e66f43`, UTF-8 JS string length 1772
- `functions/src/index.ts`: Git blob SHA-1 `d457d009a5452a785d5bcc137c7b3573e3498fce`, UTF-8 JS string length 40093
- `scripts/verify-release.sh`: Git blob SHA-1 `70f83b251a14c6575d23bd21b4bbd203d2c044c7`, UTF-8 JS string length 4400

## Acceptance boundaries
- **PASS:** nine focused local pure-policy tests; source patterns verified separately. **NOT PROVEN:** exact R846 full source build, original Rules/Firebase four-emulator and Jobs integration, live provider 412/late write, object version retention, user identity/incarnation, signed owner C6 issuance, private media, and device acceptance.
- **P0 remaining:** R841 `functions/src/index.ts` still deletes Firestore documents by name in batches without original donor's lastUpdateTime/version/owner checks; and long-running destructive deletion does not yet recheck current administrator identity, deletion attempt lease, legal hold and authority before each effect. Original donor #160 has source implementations of these checks. Import these with careful R841 deletion-mutator reconciliation on a new source-pinned review, not a wholesale file overwrite.
- Existing global deletion-completion verifier still blocks on eight independent downstream contributors; no production deletion is certified. A signed GCS URL issued previously cannot be retroactively revoked by this source patch; provider-effective stale capability checks still required.
- **No live deletion, no private content, no Firebase/GCS/IAM changes, no paid compute, no merge or production approval. PRODUCTION RELEASE HOLD.**
