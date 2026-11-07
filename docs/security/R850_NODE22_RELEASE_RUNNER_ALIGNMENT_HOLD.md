# R850 — Node 22 release-runner alignment and source admission (RELEASE HOLD)

**Date:** November 7, 2026. **Review branch:** `review/chalk-r850-node22-release-runner-alignment-20261107`, parent R849 draft #244 head `c5eda2f01f708af544d966ade67fc164e0e670c5`. R850 source before this documentation commit: `ac642db0064da41d0bdf62a531a216a5bcf17daa`. No production deployment or merge.

## Corrected CI runtime mismatch

Six review/production workflow files had **seven** pinned Node 20.19.0 or 20.19.5 values, despite `functions/package.json` declaring Node `22` and `scripts/verify-release.sh` invoking `node --experimental-strip-types` tests. R850 switches exactly those seven YAML Node settings to **22.16.0**:

| Workflow | New Git blob |
| --- | --- |
| `.github/workflows/consent-decision-branch-validation.yml` (two jobs) | `b2378a13b879a54a028d0672c291aee765e2357c` |
| `.github/workflows/dependency-remediation-candidate.yml` | `2d0748be93b5a5e114c0d06bf3053003bcb1f8fd` |
| `.github/workflows/privacy-release-verification.yml` | `54f0cfccd6fdbb65ec482469d32e9290a941a983` |
| `.github/workflows/release-verification.yml` | `f912654da991657c62edb0a485e6d9322e261f05` |
| `.github/workflows/release-verify.yml` | `22b3371c0ed23c047ccfffb5dd8a4a6c83014c74` |
| `.github/workflows/urai-production-verify.yml` | `a91c5e1d0fcee08be8343a424b16efa03feaa980` |

New source policy `scripts/assert-node22-release-workflows.mjs`, exact Git blob `b005b74e060da87a06733fad943fea2c6eb4e0c4`, requires all six explicit workflows, seven matching runtime settings, pinned setup-node, Functions engine 22, and retention of Node 22 strip-types tests. Its source-fixture unit suite `tests/node22-release-workflows.test.mjs`, Git blob `d5826afbe92212649efc196033cf9474fb470f7a`, passed **8/8 local original Node 22 tests** on bytes matching GitHub. Both release and security scripts now enforce the policy.

## Certification ledger

- **8/8** local source policy cases PASSED. **7/7** independent exact-GitHub source-readback assertions PASSED (six workflows/seven versions, engine, no Node20, source files, release/security hooks). Neither count is a root/Functions build nor an emulator test.
- Prior R849 draft #244 removes unused legacy export handlers and raw GCS signed URLs from `functions/src/index.ts`, with **12/12** local pure tests and **13/13** source conditions. R848 deletion authority and global completion HOLD are inherited unchanged.
- Existing GitHub workflow failures with zero visible executed steps cannot be explained definitively by the old Node version, because a job would have needed to reach runtime setup to manifest that error. **Runner admission remains a separate unresolved blocker.**
- No exact R850 clean install, Next/Functions compile, original unit/rules/four-emulator runtime, production IAM, signed positive C6 issuer, protected Studio→Jobs→Replay, eight signed downstream deletion acknowledgments or device acceptance.

**Review-only source hardening. DO NOT MERGE TO PRODUCTION OR RELEASE. KEEP GENESIS RELEASE HOLD.**
