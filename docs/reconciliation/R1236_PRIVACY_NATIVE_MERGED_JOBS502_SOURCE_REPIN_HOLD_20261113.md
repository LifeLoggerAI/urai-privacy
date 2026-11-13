# CHALK R1236 — Privacy native acceptance pinned to merged Jobs review tree

**As of:** 2026-11-13. **Scope:** review-only. **Release:** HOLD_NO_GO. **Private-memory writes:** DISABLED. **Do not deploy or merge to main.**

## Immutable custody

- Jobs #502 PR source: `3f4156f62020c283f1a062455f9f32d8ddecadd7`.
- Jobs #502 verified review-branch **merge commit**: `7c71cb42136e9af394f11adb0a39bd12fa07d496`. Postmerge `package.json` blob `a2ef230061e180a0a0a35a9a3266f4bb072b4bcc`, matching original reviewed source. This single-blob match does **not** prove equality of the entire Git trees.
- Privacy #312 source: `e848682d8cd6cbecced0ea7cbbff4598b40ac45d`. Verified review-branch merge `9d007c00abf589fce0d7909867f130e252d1b159`, direct parent for this R1236 branch.
- Studio #202 review-branch merge: `97a7aaf2a87697e25cbf98373259025402564d3e`.
- Spatial #2084 review-branch merge: `791bd415030b2755030134dff41908af9de10e7d`.

## Changes and source-level readback

Three precisely scoped replacements from Jobs PR source head to Jobs **merge commit**, preserving scripts, tests, setup, negative-only expectations and all other source bytes:

| File | New Git blob | New merge pin occurrences |
|---|---|---|
| `scripts/run-r30-native-jobs-privacy-acceptance.sh` | `6f7aa82a6ccdd556364594976904097f046d7d3b` | 1 |
| `tests/integration/life-movie-jobs-r932-native-transport.emulator.mjs` | `ad3dc48fb33a01017785605cd618e26677a1a2b7` | 1 |
| `.github/workflows/r30-current-jobs-privacy-denial.yml` | `e4948890d1217c6c51c546ef1abea410c157dddf` | 2 |

**Verified:** old source pin occurs zero times in these three files after write; expected merged Jobs pin occurs 1/1/2 times. No IAM, Rules, consent policy, or provider access changes.

**Important:** this is a **NEW SOURCE CANDIDATE, NOT A NEW PASS**. Original Privacy #312 four-emulator exit-0 / 403-denial evidence was for Jobs **PR head** `3f4156...`, not merged Jobs commit `7c71cb...`. It cannot be reused as execution proof here. GitHub protected CI is still unverified and earlier R1230 Runpod commands had provider exec visibility errors. Re-run the ORIGINAL unchanged `bash scripts/run-r30-native-jobs-privacy-acceptance.sh` on this exact new Privacy head using Node22, pnpm 8.15.9, Java21, Auth/Firestore/Functions/Storage emulators, an isolated synthetic test project and an independently observable secure runner; record original exit/TAP/log hashes. Do not pass production credentials or media to workers.

**Open gates:** Jobs `pnpm audit --prod --json` still exit 1 with 15 HIGH advisories, authenticated owner-positive consent→Studio→Jobs→Replay→deletion, GCS sole writer effective IAM, old-principal/stale-session 403, physical generation deletion, credential incident closure, protected CI, exact protected preview, independent reviewer approval, device/locale/product checks, founder GO. **All eleven release gates BLOCKED.**
