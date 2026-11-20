# R842 — Unmerged export security lineage reconciliation (source-only, NO-GO)

**Date:** 2026-11-07. **Assessment:** independently re-read exact source and GitHub Actions status from competing Privacy review lineages. **No private data, credentials, provider IAM, merge or deployment touched.**

## Exact ancestry

| Candidate | SHA | Relationship to main `1163d6f32a123ef9a6638e092a3eee5ec4a3b317` | Status |
|---|---|---|---|
| R841 Jobs/C6/deletion review PR #236 | `5daa194148c1f0b157062ca09b8f1b6e629d6d29` | 304 commits ahead, 0 behind | OPEN DRAFT; not main |
| Original export privacy-security controller PR #160 | `809d94ad7fc93322780d13ff3f0bade7612b3ec2` | 49 distinct commits versus R841, histories diverged | OPEN DRAFT; not main |

Direct `compare_commits` in both directions reports `status=diverged`; do **not** assume R841 includes #160's independent export hardening. Historical #160 includes deliberate source admission of #164, #166, #168, #172; these must be reconstructed with exact nonconflicting merge and never silently overwritten.

## Security-critical source difference

**R841 / also main export callable:** `functions/src/export-lifecycle-functions.ts` Git blob `70ba1ce09e25af2e9bc9c2c32e9420bfa4b678ac`, lines 74–142: `getExportDownloadUrl` checks the caller's signed owner/admin claim and an export job's `completed` state, package expiry and path, then calls `object.getSignedUrl({action:"read", expires:...})`. It **does not re-read the current canonical `data.export` consent, current account/admin state or the deletion tombstone before minting the GCS URL**. R841 `functions/src/functions-entry.ts` Git blob `f81171feb058be606be19134928c4baf9830f664` exports this callable, not a guarded HTTP download. R841 `storage.rules` Git blob `3e25a6f99d87cbd156f3ed27548770429eacc0c0` lets a signed-in owner/admin read completed unexpired export artifacts directly; tombstone denies only via the Firebase Storage client Rules path. The current export-callable blob on `main` is the same `70ba...` revision.

**#160 candidate:** `functions/src/export-lifecycle-functions.ts` Git blob `2b810de902d393994a0500330f7223c7838d60e1` implements `downloadExportPackage` using `onRequest` plus a `getExportDownloadUrl` descriptor with `requiresAuthorization:true`, not a directly issued GCS signed URL. It verifies current canonical consent, exact receipt/expiry, request/job binding, deletion fence and current signed/token-revoked identity at admission and after asynchronous boundaries, and rechecks each bounded 64KiB streaming chunk. `privacy-actor-guard.ts` Git blob `bdc0ef7795b8124ad2515442b1eb87b8a1164baa` checks `verifyIdToken(bearer,true)`, current account status/creation incarnation and live admin-claim intersection. `functions-entry.ts` Git blob `98aef90e6ba1f86360e840293feeeec8d1eab140` exports both endpoints. `storage.rules` Git blob `50e6aae0752913130fc0214a3d63980cdef5f54b` prohibits all direct client export reads/writes, reserving private delivery for the guarded server broker.

**Consequence:** R841's signed URL may remain usable until expiry independently of a later revocation of canonical consent or Firebase Auth session, unless a separate real provider/object invalidation occurs. Storage Rules cannot retroactively revoke GCS signed URLs. This is an evidenced authorization-design divergence and testable threat, **not proof that an actual deployed system leaked data**. The #160 implementation is itself unmerged; provider IAM and authenticated production controls still require separate acceptance. Previously minted URLs and bytes already delivered cannot be recalled automatically by a future code change.

## Independently verified byte evidence

Seven specific Git blobs were fetched, UTF-8 byte counted and SHA-256 hashed using an independently validated SHA-256 implementation. The complete seven-item path/Git SHA-1/SHA-256/byte ledger, and nine true static shape assertions, are saved in [`docs/estate/10_EXPORT_SECURITY_SOURCE_BYTE_HASHES.json`](./10_EXPORT_SECURITY_SOURCE_BYTE_HASHES.json). **Classification: exact-source static verification, not mocked runtime, real emulator, deployed IAM or consent certification.**

## Source-pinned historical CI ledger (distinct from R841)

GitHub Actions directly reports **SUCCESS** on PR #160 SHA `809d94ad7fc93322780d13ff3f0bade7612b3ec2`: all ten returned PR-triggered workflows, including Release Verification run `38626776396` and Consent Export and Deletion Branch Validation run `38626776142`. The latter has both executed `repository-and-functions` job `116067817012` and `emulator-evidence` job `116067817835` with all listed steps completed successfully, including frozen installs, root/Functions typechecks, lint, unit tests, rules and Firebase emulator tests. This independently establishes **historical exact-head hosted source/emulator CI**, not current R841 CI or real production private-media proof. The earlier PR #160/body reports current-actor and consent withdrawal test cases; do not count these declarations as a separate, independent original test rerun unless full original test logs are read.

R841 #236 SHA `5daa194148c1f0b157062ca09b8f1b6e629d6d29` has focused 5/5 original host tests previously rerun; five GitHub workflows returned failure and Release Verification steps were empty. The origin of the CI failure is unproven. The earlier 23/23 synthetic four-emulator bridge applies only to the older exact Privacy #206 + Jobs #261 pair; later #213 Jobs264 native emulator attempt failed Unix-socket EPERM. No R841 full four-emulator PASS or signed positive owner C6 exists.

## Collision-free repair path / hard release gate

1. Preserve the current Jobs/C6/Deletion R841 source and the current #160 export owner source as **independent parents**. Have a conflict-aware integrator create a *new* child review branch, never force-push either worker. Before merging a single file, inspect whether #160's export/deletion/Auth changes and R841's Jobs-specific verification, deletion tombstone, outbox and C6 policy use compatible schemas.
2. Carry forward every relevant #160 security boundary: authenticated broker endpoint and client contract; direct Storage export path denial; current Auth/session and admin checks; canonical C7 grant receipt+deadline binding; stream-level and post-await rechecks; safe abort/cleanup; generation-fenced deletion. Preserve R841 scope-bound C6 authorization, Jobs workload checks, revocation, planning fence, fail-closed cross-system deletion receipts, and current dependency/runner source gates.
3. Add exact combined-source regressions for revoked/expired/replaced data.export consent, deletion planning lease, active/malformed tombstone, owner disabled/deleted/re-created, signed vs current admin-claim withdrawal, direct Storage reads, cross-user requests, path attacks, stale descriptor/URL, current concurrent object generation and active stream interruption. Verify all original unit/rules suites and all four emulators on clean native source SHA, not copied receipt totals.
4. Prove **actual provider-effective** GCS IAM and stale URL denial after deletion/revocation using disposable approved accounts/objects, separately from emulator Rules. Verify protected Studio→Jobs→Spatial Replay and positive reviewed/signed movie-specific owner consent with authenticated workload identity. Require immutable deploy revision matching source, independent review, monitored rollback and founder GO.
5. **Do not deploy PR #160 alone or R841 alone.** They each lack part of the required production authorization story. Do not weaken existing rules, publish private media, bypass denial, self-issue production consent, or charge cloud compute without approval.

**Verdict: EXPORT SECURITY LINEAGES DIVERGED; RELEASE HOLD.**
