# Test, failure and certification ledger — deduplicated

**Verified snapshot:** 2026-11-07. Privacy main 1163d6f32a123ef9a6638e092a3eee5ec4a3b317; review #236 5daa194148c1f0b157062ca09b8f1b6e629d6d29. All claims in this pack are SOURCE-REVIEW or explicitly labeled historical test receipts. None authorizes production, private media access, consent issuance, or deployment.

**Do not sum re-statements of the same run as independent tests.** Deduplicate by exact source commit + original runner + timestamp/log digest and preserve each replay separately when it actually ran.

| Source / receipt | Verified level | Result | What it does NOT certify |
|---|---|---|---|
| R841 5daa194148c1f0b157062ca09b8f1b6e629d6d29 exact two original files, fresh container Node22.16.0, TAP SHA256 4ec681dcd507552742f8ced97ba39326fdcc5f2e0fba8d85f3f5acddf541e14c | Original source test, host-capability layer | 5/5 PASS; 0 skip, 0 failure | No four emulators, builds, rights, media |
| R841 standalone preflight same host | Native host readiness | FAIL EADDRINUSE 127.0.0.1:8080 | A correctly failing host gate, not code acceptance failure or emulator pass |
| R841 draft PR #236 historical worker note | Original-source subtests and harness | 5/5 Node test; 12/12 original assertion bodies in isolated harness; Unix socket probe PASS | Do not relabel assertion bodies as native original runner or new independent 23/23 |
| Privacy #206 exact c90136dcc4933c28b51cc548f72d3d8ecdf4f6fd with Jobs #261 b7a498e543160e64748a0679469a1fc1550acb3b, Google Drive R565/R567B checkpoint | Earlier full source/build & synthetic four-emulator | 350/350 Vitest; 30/30 compiled-artifact; 27/27 runner; Auth+Firestore+Storage+Functions 23/23 PASS | Old SHA and synthetic data only; not R841 or production |
| Privacy #213 source 4a4656d6283aa7e627bf220b447436df82865f99, worker's November 5 appended receipt | Frozen builds and attempted four-emulator | Builds and artifact manifests PASS, actual callable failed EPERM Unix socket and deadline-exceeded; four-emulator EXIT 1, no 23-check PASS | Not an independently certified current bridge |
| Privacy #230 review source 846d2ffa469af5634374bd77fbdc2d41bca8e964 | Original static + complete frontend/Functions builds; separately Jobs #320 695-case | Reported PASS at this exact earlier source; full combined original bridge unrun | Does not transfer to R839/R841 |
| Privacy #220 R708 working tree | Frozen install/build/security/rules emulator | Reported native working-tree PASS in PR, log digests; committed exact SHA rerun still required | Not final exact commit attestation |
| R841 commit GitHub Actions | Protected workflow | Five PR-triggered workflows all conclusion=failure, Release Verification job has zero visible steps | Cause unknown; cannot infer compiler/test failure or protected CI pass |
| Rules suites and release proof sample | Source present | Firestore/Storage suites have skip-on-no-emulator outside release mode; proof artifact is example with blocked workflows | Not live authentic owner/cross-user acceptance |

Actions for R841: run IDs 42336314430, 42336314440, 42336314327, 42336314449, 42336314399. Latest direct Release Verification run job 128293941530 returned steps=[]; provider admission reason not established. No passing protected CI artifact produced here.

Evidence category status: static/source REVIEWED; focused native tests 5/5 actual; selected earlier synthetic four-emulator 23/23 actual by source-pinned historical report; current R841 full four-emulator NOT EXECUTED; authenticated multi-service production-signed consent NOT PROVEN; physical-device acceptance NOT PROVEN; production GO NOT PROVEN. Existing repository release-evidence/authenticated-live/AUTHENTICATED_LIVE_WORKFLOW_PROOF.example.json has only blocked sample rows; docs/AUTHENTICATED_LIVE_WORKFLOW_PROOF.md requires separately linked provider revision and owner/admin/anonymous/test user evidence.
