# CHALK R1257 — Latest merged Jobs #506 pinned to native Privacy (review-only HOLD)

Source basis: Privacy #315 review merge `0b8817dfcf93df0175f40c48e80b6d1cab958b95`; latest Jobs #506 review merge `1927172d0fa6fcd0a16130e5c1c95c29b3292cd6`. Only the native R30 runner, original transport emulator test, restricted CI workflow and source-lock regression are changed, plus this handoff. Branch eligibility is scoped to this review branch.

Four exact Git blobs:
- `scripts/run-r30-native-jobs-privacy-acceptance.sh` `c8651ec1a46f47f75e2f2f80c8cb5e7f921f996b`
- `tests/integration/life-movie-jobs-r932-native-transport.emulator.mjs` `d7218f34e6877b4094182642d3a05a889bc94790`
- `.github/workflows/r30-current-jobs-privacy-denial.yml` `8be28a1ec97f2f300d01efcecee131967ad4733b`
- `tests/integration/r1237-r30-merged-jobs-ci-gate.test.mjs` `b86012374a15358f8fa975d9a206bfaafcc90899`

On existing Runpod R950, exact repin head `2d51ce46302e4fac0620baca530cedabb8ca1805`: source-lock suite **4/4 PASS, exit 0**, original TAP SHA256 `4a911354ec21710e69c78415954800df7b975dc58d65b4c53b042352f46b6a4b`. Four-emulator R30 native acceptance must independently produce exit 0 and required no C6 grant/render evidence at final PR HEAD and merged review HEAD before declaring full scoped PASS. Do not infer from historical source.

Separate Studio contract: original Studio review merge `97a7aaf2a87697e25cbf98373259025402564d3e` against Jobs #506 merge passed **12/12, exit 0**, TAP SHA256 `7e5b6a41f2119883845d1f61be53b5e590c0157094796f6d06870833e5b27680`, frozen install exit 0.

Live deployment: Vercel private Genesis review project `prj_pt7oOQLnCFki8vJb4ph9XhIjiLwZ` has SSO enabled for all deployments; newest deploy status ERROR `git_info_fail`. An explicit preview-only Git source deployment attempt was rejected HTTP 400 `no_github_account_connected`; Git namespaces returned 401. GitHub connection inside Vercel must be restored externally; no new live preview was created. No source permissions, token secrets, public aliases or deployment policies bypassed.

Jobs #506 production audit still exits 1: 7 high, 25 moderate, 6 low. Protected CI remains blocked; genuine signed owner-positive consent→Studio→Jobs→Replay→generation-specific deletion, effective GCS IAM sole writer, stale writer/draining, credential incident closure, qualified independent security/privacy/accessibility approval, hosted preview and device/store acceptance remain open.

**HOLD_NO_GO. Eleven release gates BLOCKED. Private-memory writes DISABLED. Review branch only, never main or public production by virtue of these tests.**
