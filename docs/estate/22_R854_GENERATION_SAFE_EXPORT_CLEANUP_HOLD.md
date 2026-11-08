# R854 — Generation-conditional cleanup for all four known export artifact paths

**Date:** 2026-11-07. Engineering [Privacy draft PR #249](https://github.com/LifeLoggerAI/urai-privacy/pull/249) exact head `b58a9617fde181c82d11531639ffec92bf24fdcf`, child of R853 #248 `32c2e41161c8683bacc612335eaafbd16e0144c7`. Prior PRs, main and production remain untouched. **RELEASE HOLD.**

## Actual security repair

R853 bound new export writes and reads to exact GCS object generation, but four production-configured cleanup routes still deleted objects by filename. An old cleanup could thus remove replacement bytes at the same name. R854 replaces deletion with the shared exact-string `ifGenerationMatch` precondition, authorizing only the generation recorded for that owner's exact job/attempt/path. No current/latest generation is inferred from metadata. A changed generation should fail with GCS 412 and remain pending; this effect requires live provider proof.

- Pure authorization `functions/src/export-object-generation-policy.ts` Git blob `20a143c3c6e5a157e5ad9186bb5912605e7f3097`, adding `approvedExportCleanupGeneration`.
- Actual GCS delete `functions/src/export-generation-cleanup.ts` blob `cc65b97556a4886cc49bc56e5c49492f47305e6c`: only `bucket.file(path,{preconditionOpts:{ifGenerationMatch:generation}}).delete({ignoreNotFound:true})` after the exact-string policy, never the unsafe numeric `FileOptions.generation`.
- `functions/src/export-request.ts` blob `b80055972af1c0bc4e22352faade5abbb13e2d13`: records each created export/manifest generation in the attempt ledger with UID/token/status transaction checks, invokes guarded cleanup after worker failure, and carries recorded generations to failed-job retry.
- `functions/src/export-lifecycle-functions.ts` blob `bad8ecfbdd1ea1a5953ac99c48e4da5f5e94b14e`: completed expiry and failed-job retry cleanup require valid, recorded generation or block cleanup.
- `functions/src/export-attempt-maintenance.ts` blob `c10bcca49612ea43c410b12f46cee7d3a8734ba8`: worker validates attempt UID/job/token/path and persisted export/manifest generations before invoking the same guarded delete.
- New `tests/export-cleanup-generation-policy.test.mjs` Git blob `88b31fe11666c8fbaaaa840c9279fcf27de22759`: original local Node22 **12/12 PASS** at byte-identical Git source, and strict pure TypeScript check PASS. Initial fixture failed due extensionless Node strip-types module resolution; it was revised to use the existing policy module and only the exact-source 12/12 result is credited.
- New six-case source contract `tests/export-cleanup-generation-source-contract.test.mjs` Git blob `5fe99a3c33a02af7eb58271f7d731d941e218de2`, release verifier `4ed2b7e2976c6bf5d77ce8746d73ab7d56d18816`, security gate `197978688520bff81affe725b2d7b41e553eed0f`. These six source tests have NOT passed a complete checkout run. Independent GitHub connector readback: **19/19 STATIC** conditions, including all four cleanup paths, no raw-name delete in those paths, ledger persistence and gate hooks. Static checks are not actual runtime behavior.

## CI / deletion / release gate

At exact R854 head, five GitHub workflows reported failure: Release Verification `42423396513`, URAI Privacy Release Verification `42423396552`, Consent Export and Deletion Branch Validation `42423396519`, URAI Production Verify `42423396566`, Privacy package validation `42423396551`. Release job `128556444556` returned no visible execution steps. Cause unknown; do not count as an original test run, pass or application failure.

**P0 caveat:** partial writes without a recorded generation and older legacy artifacts remain deliberately uncleared, possibly requiring an owner-authorized metadata-only reconciliation and retention remediation. Do NOT guess the latest generation to delete. The global account-deletion completion remains blocked on eight downstream signed subject ACKs; this export cleanup change is not a deletion-completion certificate. Also missing exact R854 frozen root/Functions builds, original Auth/Firestore/Storage/Functions four-emulator race tests, live GCS 412, provider IAM, positive signed C6 owner consent, protected Studio→Jobs→Replay, devices and independent production GO.

No real media, user deletion, live Storage changes, IAM modifications, paid compute, merge or production deploy performed. **ONE URAI GENESIS RELEASE HOLD.**
