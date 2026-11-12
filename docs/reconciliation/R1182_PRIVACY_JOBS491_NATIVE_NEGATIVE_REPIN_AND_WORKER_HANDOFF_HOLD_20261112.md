# CHALK R1182 — Privacy negative-native acceptance repinned to integrated Jobs #491 (HOLD)

Date: 2026-11-12. Review-only. **PRODUCTION HOLD/NO-GO; PRIVATE MEMORY WRITES DISABLED; PROVIDER-PRIVATE OUTPUTS DISABLED.** No provider changes, cloud IAM grants, customer media, protected CI bypass, live GCS test, or merge to main.

## Exact source and narrow change
- Parent Privacy #298 exact `26b82cc95725b0d4dc5d24e819501525e01dfdb1`, preserving native four-emulator acceptance code and its restrictive grant/denial behavior.
- Jobs parent #488 `5b5035ff2e5b036dd09aa215d61566e12930a0fb` remains a Git ancestor of Jobs #491 `39f469254dc3e8e998f6a2ee8e5b1f2f6498dc28` (GitHub comparison: six commits ahead, zero behind). Jobs #491 adds synthetic race model, GCS bridge, test files, docs, and package test enrollment; comparison shows NO changes to prior Jobs runtime sources inherited from #488. This is **source compatibility analysis**, not native integration PASS.
- Precisely updated three acceptance files and nothing else in existing source: `.github/workflows/r30-current-jobs-privacy-denial.yml` (two exact checkout/assertion SHA pins, one narrow new review-head eligibility term, clarified step title), `scripts/run-r30-native-jobs-privacy-acceptance.sh` (one constant SHA pin), and `tests/integration/life-movie-jobs-r932-native-transport.emulator.mjs` (one constant SHA pin).
- New exact content blobs read back from GitHub: workflow `92a3bd4ba8e857063660430c89c6bebc7776443e`, runner `600003113685def552392fb4e21813b3043e23e8`, emulator `c722791177f3e7c25db49b0ad06337ead72162c1`. Checked counts: workflow 2, runner 1, emulator 1 occurrences of new Jobs #491 SHA; old #488 SHA absent in all three files.
- Workflow retains restricted `pull_request` and manual dispatch, `contents: read`, pinned Node 22 and Java 21, native emulators, isolated synthetic project, and exact source checkout guards; NO `pull_request_target` was introduced. Branch name includes `privacy299` as a review label only; **do not assume GitHub PR number 299**, which was historical and closed.
- This turn has **not executed native four-emulator test or protected GitHub Actions** for new Privacy SHA. Prior Privacy #298 / Jobs #488 negative native result is historical scoped evidence and cannot certify the new Jobs #491 tuple.

## Adjacent peer work
- Jobs #491 is source-locked synthetic convergence, not physical storage IAM. Jobs #492 newly adds static recognition of additional predefined GCS write-capable roles; exact-head execution pending on that candidate. Jobs #493 reported separate 22/22 local synthetic proof of #491. Do not silently treat these as runtime provider security or expand this Privacy pin to an untested descendant.
- Labs #448 R1181 review-only source convergence and 19/19 main baseline; this Privacy branch is an additive child, not a production merge.
- Studio #202, Spatial #2084, Content #126 remain separate review overlays; all must be re-frozen at exact approved heads for final integrated run.

## Required independent execution
1. Fetch exact new Privacy Git commit, all changed Git blobs, and Jobs #491 exact SHA into credential-free throwaway workspace; verify clean source checkout and original Git tree hashes.
2. Run actual original native Auth + Firestore + Functions + Storage emulator negative transport suite with pinned Node 22 and Java 21. Record provider/runner log, source SHA, exit code, TAP hash, four process readiness logs and reviewer identity. If CI remains `startup_failure`, record external blocker; do not mark PASS.
3. Confirm cross-owner, wrong-scope, missing-consent and revoked/deletion-candidate denials. Keep positive owner-C6 acceptance distinct from negative-only tests.
4. Close remaining external gates: Labs incident #370, Jobs real GCS IAM/session drain/late PUT/deletion #252, authenticated positive C6→Studio→Jobs→Replay→delete, protected CI case #4889576, independent security/privacy signoff, devices/accessibility/20+ locales/store/rollback and exact approved preview.

## Worker dispatch and evidence rule
Assign one owner and one independent reviewer to this native acceptance. Log immutable evidence in the PR and cross-link shared Labs issue #247; do not duplicate expensive Pods or overwrite siblings. A test reported green by its author without distinct reviewer receipt is scoped evidence only. **No GO and no private writer activation.**
