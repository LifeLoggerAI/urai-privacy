# R1247 — Privacy native acceptance against merged Jobs #504 (HOLD)

Date: 2026-11-13 UTC (execution round). Review-only candidate. **Production HOLD / NO-GO. Private-memory writes DISABLED.**

Parent Privacy review merge: `9b8b42de3880ecdae0607a5f074ad14cfaf6d3cf` from PR #313. Jobs #504 review merge: `710f386c5fe495c63ddac42e62b45fcb93bcd6ef`, descendant of the formerly pinned Jobs #502 merged review commit `7c71cb42136e9af394f11adb0a39bd12fa07d496`.

This change updates only four source-lock files to the newer exact Jobs merge: original R30 native runner, original transport emulator test, R30 restricted CI workflow and existing source-pin guard. Branch eligibility is extended for this exact review branch only. The historical earlier merge, source audit and original logs remain unchanged.

Reviewed blobs at PR candidate:
- `scripts/run-r30-native-jobs-privacy-acceptance.sh` — `be08b6ee04447cbff1cf717fa549d780cba11eb3`
- `tests/integration/life-movie-jobs-r932-native-transport.emulator.mjs` — `3397739d4e44d82daa1ad96a69814898761d33b3`
- `.github/workflows/r30-current-jobs-privacy-denial.yml` — `f0b6ca4dadd8ba054a3b7f35f7240262613c35f0`
- `tests/integration/r1237-r30-merged-jobs-ci-gate.test.mjs` — `0ac1d7c2a46e8c8eadbd6298cf5be61bf1ec0858`

Fresh R950 original source-lock regression was executed against exact Privacy commit `c61033b9c1a242bb0cb01e896264948d3cda176e` + Jobs merge `710f386c5fe495c63ddac42e62b45fcb93bcd6ef`: **4/4 PASS, exit 0**, TAP SHA256 `8b66893d4594e64453c17658db153f475e5a1611963c90dca82a25b86dcc5383`. The full native four-Firebase-emulator acceptance must also pass at the final PR and merge SHA; do not infer a PASS from earlier Privacy #313 evidence.

Native acceptance command: `URAI_EXPECTED_PRIVACY_SHA=<current exact Privacy SHA> URAI_JOBS_SOURCE_DIR=<exact checked-out Jobs #504 merged SHA> bash scripts/run-r30-native-jobs-privacy-acceptance.sh`. Must produce original exit code, negative C6 consent denial HTTP 403, no render admitted, preserved raw sanitized logs, stopped emulators.

Jobs dependency production audit still fails with fourteen HIGH advisories even though Jobs #504 reduced it from fifteen; protected GitHub CI and qualified independent approval are not certified. Real owner-positive consent, exclusive GCS IAM, stale-session rejection, generation delete, hosted protected preview, store/device acceptance, and final founder release GO remain unproven.

**All eleven release gates remain BLOCKED. No production or main merge, write-enable, provider policy mutation, or independent security certification is authorized by this PR.**
