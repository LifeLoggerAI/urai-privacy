# R847 — Version-pinned Firestore document deletion (REVIEW HOLD)

Date 2026-11-07. Repository `LifeLoggerAI/urai-privacy`. Independent child of R846 [PR #241](https://github.com/LifeLoggerAI/urai-privacy/pull/241) at `6211e78fbac9a1dfd16be1b689bd75b28b7e9e02`. R847 exact source head before this evidence: `8eadd9872b764e3fa26030761d7d7396f87744e1`.

## Actual source changes
- `functions/src/index.ts` now mandates `privacy-deletion-plan-v3` with exact Firestore update-time seconds/nanoseconds for every owner-scoped target, hashes those versions into the approval, and rejects stale versions on resumed/partial deletion. This preserves R846 GCS generation-bound v2 logic but supersedes old v2 plan approval with mandatory v3.
- The executor replaces the old unconditional batch-delete by a Firestore transaction. It reads every target and its literal UID and updateTime, rechecks approved version, and uses `transaction.delete(ref,{lastUpdateTime:snapshot.updateTime})`. Replacement documents and mismatched ownership fail closed before deletion, instead of treating the same ID as perpetual authority.
- New pure `functions/src/deletion-document-version.ts` (Git blob `d8d3704ed1bf3bd8b5dd0f00ffeed23fd6eebd82`) prevents accessor, malformed timestamp and foreign-user authority. `tests/deletion-document-version.test.mjs` (Git blob `64f971f38d45b30731712c224ff3a398832643e0`) was run locally on Node 22.16: **8/8 PASS**, all on identical Git source bytes. Tests include same-ID replacement, wrong owner, nanosecond change, malformed/inherited metadata, and traversal. The tests were run on the helper, not the complete Firebase handler.
- New four-case source admission test `tests/deletion-document-source-contract.test.mjs`, enforced by `scripts/verify-release.sh`, checks exact plan version and transaction conditional delete. These four source cases have not been separately executed against a full native checkout.

## Evidence ledger
- Source readback at `8eadd9872b764e3fa26030761d7d7396f87744e1`: 12/12 static text conditions (v3 plan, versioned subsets, transactional deletes, lastUpdateTime, owner checks, hashed plan versions, GCS conditional deletion, pure helper, eight local tests, four source tests, release hooks, and global HOLD) verified. **This is source-shape inspection, not an original full-source build.**
- `functions/src/index.ts`: Git SHA-1 `bb0177c7f20e9cc5f576b8e0a2518d9e3a5d93b9`, UTF-8 string length 42430
- `functions/src/deletion-document-version.ts`: Git SHA-1 `d8d3704ed1bf3bd8b5dd0f00ffeed23fd6eebd82`, UTF-8 string length 1761
- `tests/deletion-document-version.test.mjs`: Git SHA-1 `64f971f38d45b30731712c224ff3a398832643e0`, UTF-8 string length 2538
- `tests/deletion-document-source-contract.test.mjs`: Git SHA-1 `ca15064b60d5ef9c0038e02a4bb853bd97aadf45`, UTF-8 string length 1795
- `scripts/verify-release.sh`: Git SHA-1 `99ba36d83b08a604cd1d0bde10add7f0433bbb03`, UTF-8 string length 4614
- `functions/src/deletion-mutation-guard.ts`: Git SHA-1 `45746faf46a51d7290a2b86b4daa29ef426d7012`, UTF-8 string length 17115
- R846 original local generation policy 9/9 PASS at exact earlier source; historical donor #160 418 units/16 Rules/23 current-actor emulator and R844 local 12/12 all belong to different source SHAs, not R847.
- No R847 frozen root/Functions build, full unit suites, Rules/four-emulator acceptance, real Auth/provider 412, positive signed C6, protected Studio→Jobs→Replay or physical-device evidence certified.

## P0 release blockers
R847's destructive deletion still needs independently reviewed continuous current administrator token/claims/incarnation, deletion execution lease/tombstone and legal hold verification around every async mutation, as in historical donor #160. Preserve the R841 eight-contributor downstream completion HOLD, and require actual provider generation/owner/late writer tests. Full current-source CI and signed private-media consent remain outstanding. No approved prod mutation, deployment, IAM, private media, paid compute or branch overwrite occurred.

**RELEASE HOLD — this is an unmerged source security candidate, not a release certificate.**
