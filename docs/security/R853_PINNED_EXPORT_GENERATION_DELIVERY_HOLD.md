# R853 — Pinned Storage-generation export creation and authenticated delivery (RELEASE HOLD)

**Date:** November 7, 2026. **Parent:** R852 Privacy draft PR #247 `5237ebbbe9131d152968004c359b215a6a79bab8`. Independent R853 child branch `review/chalk-r853-export-object-generation-read-20261107`. No other engineering branch or production state was modified.

## Verified source defect

The R852 export writer used a name-only Storage `save` with no `ifGenerationMatch:0` create-only precondition, and the export download callable/stream read `bucket.file(path)` without a generation selector. This left a source-level object-substitution race: consent and job identity could remain unchanged while a different generation at the same object name was accessed. R852 background cleanup paths also used name-only deletes. This is a source risk, not proof of actual leaking or existing replaced files.

## Actual code changes

- `functions/src/export-object-generation-policy.ts`, exact Git blob `06d53671754d0a01e1c90f289959b16f0d6aee70`: strict string representation of GCS generation, never number-coerced; rejects invalid/ambiguous generation strings, owner/job/UUID path mismatch, malformed or inherited SHA-256 object metadata, and changed generations.
- `functions/src/export-request.ts`, Git blob `c13baeef7c526fd7c0ac5da81827e2496c529d9f`: export and manifest are created with `preconditionOpts:{ifGenerationMatch:0}`, SHA-256 metadata and post-save generation verification; the resulting exact `exportGeneration` and `manifestGeneration` are written to the completed job alongside the hashes.
- `functions/src/export-lifecycle-functions.ts`, Git blob `602fbf8aa189884e5a2bcdb4c8eaedecdf28152e`: the authenticated callable requires matching owner/job-scoped, generation-pinned export path, explicit generation and checksum in completed job authority; includes exact generation/hash in descriptor identity; both callable and HTTP broker use `bucket.file(path,{preconditionOpts:{ifGenerationMatch:generation}})` for metadata and streaming, validate SHA, and fail if the current object generation has changed. Existing current-token, owner/admin, C7, revocation and per-64KiB stream checks remain.
- Legacy completed job records **without generation bindings are intentionally denied** by these new download paths. A migration would require independent proof of object identity and consent; do not backfill by guessing a current generation.
- `tests/export-object-generation-policy.test.mjs` Git blob `17f605a843ea1baa62192197d3205fb53508648c`: original exact-commit 16/16 local Node 22.16.0 PASS. Standalone strict TypeScript policy check PASS.
- `tests/export-object-generation-source-contract.test.mjs` blob `bcabf39a2538aa8adb73baa829364823968f6eb3`: six added source-contract tests wired into release verifier `34acf7924f07d727fe9b9f8beb7b7e67082d0bcb` and security gate `845f3f73d2e10baa900a2470c059cad089f58de3`. These six were not executed in a full checkout.
- GitHub connector readback: **16/16 independent static source checks** for real implementation, policy/test source hashes and release hooks. Static checks are **not** a Functions build, live GCS version check or owner-consent certification.

## Critical unresolved concerns

1. **P0: generation-unpinned cleanup is still present.** `functions/src/export-request.ts` failure cleanup, `export-lifecycle-functions.ts` expiry/failed cleanup and `export-attempt-maintenance.ts` still use name-only delete. They must acquire generation evidence at creation/attempt, use generation-conditional deletion, enforce current lease/ownership, and leave unpinned legacy objects blocked (never silently delete a replacement). R853 does not certify their safety.
2. No complete R853 root/Functions npm ci, TypeScript build, original Firebase Rules/four-emulator acceptance, real GCS object substitution/412 denial, owner-signed positive C6 movie consent, protected Studio→Jobs→Replay, provider-effective IAM or device acceptance. Local container has Node22 and tsc but lacks a complete checkout/installed dependencies and cannot resolve npm/GitHub domains. Connected GitHub supports source read/write; this does not supply a native runtime environment.
3. The previous R852 hosted workflows all failed with Release Verification having no visible steps; do not promote this to an executed R853 result. R853 must be separately examined after PR creation.
4. All prior Privacy review branches and original donor #160 remain untouched. No real user media, IAM mutation, Firebase deploy, paid compute, merge or destructive data operation was performed.

**GENESIS RELEASE HOLD until real consent and private-media enforcement and generation-safe cleanup are independently proven.**

## R853 source correction — exact string precondition (mandatory)

Later source review found the Storage client's `FileOptions.generation` implementation can coerce generation strings through JavaScript `Number`, which is unsafe for values beyond 2^53. The first R853 branch revision used this selector. The review branch was immediately corrected before any production merge: both the callable metadata check and authenticated HTTP stream now call `bucket.file(path, { preconditionOpts: { ifGenerationMatch: authority.generation } })`. The Storage API enforces the exact literal decimal-string generation precondition and rejects a changed current object with a failed-precondition response. This intentionally refuses replaced objects rather than serving an earlier version. Source Git blob `ef05546cc579275bdb7cb65b33f92603bd93d959`; regression contract blob `3d62babdda083e37c18b85009c26f1397fb1b8be`. The earlier R853 blob `602fbf8aa189884e5a2bcdb4c8eaedecdf28152e` is superseded and MUST NOT be deployed. Provider-effective behavior still requires a disposable real GCS test.
