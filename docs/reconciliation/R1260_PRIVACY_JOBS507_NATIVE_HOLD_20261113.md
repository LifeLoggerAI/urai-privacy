# CHALK R1260 — Privacy native denial pinned to Jobs #507 (review-only)

Current source pair: Privacy #316 prior review merge `78731e4b401c69dcd11fc04b3c800de2468b5864`, Jobs #507 review merge `d6c01f74141f3db3046e3437fca4a342fe60a938`. This candidate changes four original R30 files only (runner, transport fixture, restricted workflow, exact source-lock guard), plus this evidence. No runtime consent policy, IAM, private writes or deployment settings changed.

At exact initial source `93076ed78ec1ecb33c2349d1e0547ad73dccad91`, original source-lock 4/4 PASS exit 0, TAP SHA256 `fd4f56ee0a278d235ccd4730c42e289a37bd58baa875e31043615448ce259c94`. Original four-Firebase-emulator native R30 exit 0, eight R30 PASS markers, actual local Privacy callable HTTP 403 expected denial, no C6 grant and no render; full SHA256 `96ad913ab436b957f841e34b68ca3ea40e7472c364a95521aa2a343b7e866921`. Logs on existing R950 `bvandlyauxhevl` at `/tmp/urai-r1260/guard.tap` and `/tmp/urai-r1260/native.log`. Emulators shut down; worktree clean.

Independently on Jobs #507 exact review merge, original Studio producer review `97a7aaf2a87697e25cbf98373259025402564d3e` to Jobs contract 12/12 PASS, TAP SHA256 `3f10d1491a9d832137996a71448284ffcc3480277fdf0202640f352f236bab08`. Jobs #507 frozen install, Functions build and 24/24 original GCS canaries PASS. Production audit STILL exit 1: 4 high/25 moderate/6 low/0 critical. Original full SHA256 in Jobs #507 and Labs issue #247 comments.

A later documentation commit makes the final PR HEAD different from initial test source; rerun original tests at final PR HEAD then after review-only merge. Do not claim full PASS for an untested merge source.

Vercel private Genesis project `prj_pt7oOQLnCFki8vJb4ph9XhIjiLwZ` has SSO enabled, but latest deployment ERROR and GitHub connection unavailable: HTTP400 `no_github_account_connected`. No new protected preview or live production Genesis exists.

**Release: HOLD_NO_GO. All 11 launch gates BLOCKED. Private-memory writes DISABLED.** Real owner signed-positive lifecycle, live effective GCS IAM and generation deletion, protected CI, independent qualified review, hosted device/stores and founder approval remain missing. This is synthetic negative-emulator acceptance, not production identity proof.
