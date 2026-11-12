# R1186 — Privacy native acceptance source lock advances to Jobs #495

**2026-11-12. REVIEW ONLY. Production HOLD/NO-GO; private-memory and provider-private writes DISABLED.**

## Exact source custody
- Privacy parent: PR #302 exact `0a96781d3e0585b8d7cdd677e112191ed111db94`.
- Jobs review source: PR #495 exact `8f401b9c1c2d61f761c1a83bfd90cbb3e70f5156`; GitHub compare vs #494 `1e957d4a9207cf9e315e031db2360589c8515cbc` is ahead 1, behind 0, changes only two static IAM review validators and tests plus handoff. No inherited Jobs runtime path modification.
- Exact three Privacy negative native acceptance files repinned from Jobs #494 to Jobs #495:
  - workflow `.github/workflows/r30-current-jobs-privacy-denial.yml`: Git blob `31aa0ea256839ed90d2dfb569aab0788c9a3e46e`, two new pin occurrences
  - runner `scripts/run-r30-native-jobs-privacy-acceptance.sh`: blob `fcf5531e0a4848bee9319fadab1432a55fbc4c66`, one new pin
  - emulator test `tests/integration/life-movie-jobs-r932-native-transport.emulator.mjs`: blob `f87cd1edaa4f66ce0801ab52b7725d13e26ef671`, one new pin
- Exact GitHub readback: four Jobs #495 pin references across three files, zero #494 pin occurrences in those files. Workflow retains old restrictive predicates plus exact new branch predicate; no pull_request_target or permission widening.
- The IAM terminology change corrects #494's earlier conflation: `roles/storage.editor` remains a static blocking review role because of bucket/HMAC control-plane risk, not because it necessarily grants object creation; `roles/storage.expressModeServiceInput` grants direct object creation. No physical GCS policy was changed here.

## Evidence limitations
- Neither Privacy #302 + Jobs #494 nor current Privacy R1186 + Jobs #495 four-native-emulator suite has a verified original complete execution receipt.
- Previous disposable Runpod worker `8czrpk5a9e990c` against older #301/#491 returned zero container/system log lines and was stopped. Status EXITED does NOT certify tests.
- GitHub Actions remains untrusted for release: Labs #450 startup_failure, Privacy #302 R30 failure with null steps; support case #4889576 not shown resolved. Independently verify current PR's exact-head job steps and logs when available.
- Jobs #495 static IAM source changes require own exact-head test and independent reviewer, in addition to a real provider GCS 3-principal denied writer / stale PUT / upload draining / generation deletion test.

## Agent action order
1. Validate exact source SHA, clean detached checkout, Node22/pnpm8.15.9/Java21, no inherited credentials and disposable Auth/Firestore/Functions/Storage emulators.
2. Run original Privacy→Jobs negative native harness against Jobs #495; collect immutable raw logs, actual exit code, original test totals and independent reviewer.
3. Complete live GCS Jobs #252 exclusive broker/stale-writer 403/upload drain/generation-specific deletion, Labs #370 key-specific revocation incident, positive authenticated owner C6→Studio→Jobs→private Replay→withdraw→delete.
4. Restore protected CI #4889576 and independent security/privacy approval; certify the frozen 19-repo end-to-end application, devices/accessibility/locales/store/rollback and source-matched SSO preview.
5. Keep all sibling PRs, source parents and docs. Do not declare GO or enable private writes from source-only tests. No production promotion, IAM changes, main merge or customer media.
