# R854 — Export cleanup requires exact generation identity (RELEASE HOLD)

**Date:** November 7, 2026. **Parent:** R853 draft PR #248 head `32c2e41161c8683bacc612335eaafbd16e0144c7` (which fixes the SDK's numeric generation selector hazard). Independent R854 review branch `review/chalk-r854-generation-safe-export-cleanup-20261107`. No earlier worker branches, main, cloud IAM, live content or production were modified.

## Original-source security finding

Four configured cleanup routes still deleted a GCS object by **name alone** despite R853's generation-pinned export writer/download: (1) failed export worker cleanup, (2) expired completed package cleanup, (3) retry of failed-job cleanup, and (4) `exportArtifactAttempts` maintenance. An old cleanup task could erase a newer object occupying the same name. The GCS API provides string `ifGenerationMatch` preconditions, failing with 412 on a changed generation. Prior raw-name deletes are a verified source concern, not evidence of actual production data deletion.

## Committed security changes and exact identities

- `functions/src/export-object-generation-policy.ts` Git blob `20a143c3c6e5a157e5ad9186bb5912605e7f3097`: appends `approvedExportCleanupGeneration` to the R853 exact-string generation/path policy. It permits only recorded export/manifest generation bound to the exact owner, job, attempt UUID and canonical path; no lookup of current generation is used as substitute evidence.
- `functions/src/export-generation-cleanup.ts` Git blob `cc65b97556a4886cc49bc56e5c49492f47305e6c`: performs GCS `bucket.file(path,{preconditionOpts:{ifGenerationMatch:generation}}).delete({ignoreNotFound:true})` **only after** pure policy approval. This uses an exact string in preconditions rather than `FileOptions.generation`, which could round large 64-bit identifiers.
- `functions/src/export-request.ts` Git blob `b80055972af1c0bc4e22352faade5abbb13e2d13`: records each newly created generation in the active attempt ledger with transactionally checked UID/token/status, before further work. On failure it uses the conditional helper with locally recorded generations, and persists any verified generations to failed job records for subsequent retry. Missing generation remains pending, not a name-only deletion.
- `functions/src/export-lifecycle-functions.ts` Git blob `bad8ecfbdd1ea1a5953ac99c48e4da5f5e94b14e`: expired complete and failed-job retry paths validate recorded generations before destructive cleanup; missing/invalid bindings set blocked status rather than delete current objects. Preserves existing valid-path, audit, and lease logic.
- `functions/src/export-attempt-maintenance.ts` Git blob `c10bcca49612ea43c410b12f46cee7d3a8734ba8`: checks attempt ledger export/manifest generations and exact owner/job/attempt path before its conditional deletion. Missing generation blocks and retains an auditable attempt.
- Original local `tests/export-cleanup-generation-policy.test.mjs` Git blob `88b31fe11666c8fbaaaa840c9279fcf27de22759`: **12/12 PASS** Node22.16, identical to committed Git bytes. Strict isolated TypeScript policy check PASS. The first local fixture run failed because Node strip-types did not resolve an extensionless module import; this was fixed by testing the single existing policy module, then the **exact Git-source test** passed 12/12. Do not count the failed preliminary invocation as a suite pass.
- New `tests/export-cleanup-generation-source-contract.test.mjs` Git blob `5fe99a3c33a02af7eb58271f7d731d941e218de2`: six source admission cases wired to release verifier `4ed2b7e2976c6bf5d77ce8746d73ab7d56d18816` and security gate `197978688520bff81affe725b2d7b41e553eed0f`. These six have not been run in a full repository checkout.
- Independent connected GitHub readback: **19/19 targeted STATIC checks** across policy, write/ledger, all four cleanup paths, tests and mandatory gate scripts. Source-pattern presence is not native executable certification.

## Remaining release gates and operational caveats

- **Unpinned legacy packages and partial writes may remain in Storage.** A write that succeeded before the generation was recorded cannot be safely cleaned automatically. Such artifacts must remain blocked, investigated using non-private metadata, and never be assigned the latest generation by inference. This is a privacy retention/remediation concern, not a deletion-completion receipt.
- Real Storage 412/precondition replay, after-replacement denial, Firestore lease/revocation races, multi-worker concurrency and expiration need actual disposable GCS/Firestore acceptance. No exact-R854 root/Functions clean build, original unit and Firebase Auth/Firestore/Storage/Functions four-emulator suite has run.
- Actual signed positive C6 owner approval, Studio→Jobs→Replay private media, provider IAM and stale signed URL withdrawal, eight subject-specific deletion acknowledgments, device and independent production GO remain unproven.
- No production deployment, paid compute, real media, deletion, IAM change, consent issuance or forced merge. Parent R853 and all other worker PRs remain unmodified.

**GENESIS RELEASE HOLD. No real-consent/private-media certification or global deletion completion may be claimed from this source review.**
