# CHALK R1252 — Privacy native acceptance pinned to Jobs #505 review merge

Execution window: November 13–14, 2026 (Central/UTC). Review-only source custody; **production HOLD_NO_GO, private-memory writes DISABLED, eleven release gates BLOCKED**.

**Base Privacy review merge:** `c717f0a671bcc73ee5e7dcf97f1ed34d7c7e51cd` (Privacy #314). **Exact current Jobs review merge:** `a08a4c14c9756578b9f40f3574b5f06a75a0e8d7` (Jobs #505). Previous Jobs #504 merge `710f386c5fe495c63ddac42e62b45fcb93bcd6ef` is historical and must not be used for new source-lock acceptance.

Scoped changes: original native acceptance shell runner, original Firebase emulator transport test, R30 restricted review workflow (adds only this exact branch to eligibility), and original CI source-lock regression test; all four pin the new Jobs merge and preserve the existing negative-only authorization expectations. No production IAM, Firebase Rules, private storage writes, consent protocol, or runtime processing changed.

**Immutable GitHub file blobs at first source repin:**
- `scripts/run-r30-native-jobs-privacy-acceptance.sh`: `4378c9743ac8a2d6cf50516f14499b20cf619a7f`
- `tests/integration/life-movie-jobs-r932-native-transport.emulator.mjs`: `3cca8718cdcc0e0473a3f4609064649a13b430b5`
- `.github/workflows/r30-current-jobs-privacy-denial.yml`: `dcf48882103cc560cc22c8d1f43c32876a53d9d8`
- `tests/integration/r1237-r30-merged-jobs-ci-gate.test.mjs`: `4a86198c7e95eea7150a8c1f206595794ceba3ca`

**Fresh original source-lock test at source repin head `f9ca872d5690706eff6190741057cd9a1209f2e8`:** authenticated GitHub clone on existing R950 worker, exact Jobs #505 merge checked out separately, `node --test tests/integration/r1237-r30-merged-jobs-ci-gate.test.mjs` **4/4 PASS, process exit 0**. Original TAP SHA256 `a30f49c899def3cf1178518e98c4b22f85574d02bd5da070cce37f2751800b92`. Original TAP retained `/tmp/urai-r1252/guard.tap`.

**Native execution requirement:** run unchanged `bash scripts/run-r30-native-jobs-privacy-acceptance.sh` with `URAI_EXPECTED_PRIVACY_SHA` set to final source checkout and `URAI_JOBS_SOURCE_DIR` pinned to Jobs #505 merged commit. Record exact original process status/TAP/full log digest; expect four synthetic Firebase emulators, Privacy callable HTTP 403 denial, no C6 grant and no rendering. Original native test launched against initial source repin; only label PASS after observed process exit and logs. Repeat at final review merge SHA to avoid transferring source-head evidence.

**Remaining blockers:** Jobs production audit exits 1 with 10 high/27 moderate/7 low/0 critical; protected GitHub CI startup failures; signed owner-positive consent→Studio→Jobs→Replay→generation deletion; effective exclusive live GCS broker writer, upload draining/stale writer 403, physical delete ACK; credential incident closure; SSO-protected exact hosted preview; device/locales/store acceptance; qualified independent security/privacy/accessibility approvals and founder GO.

An emulator-negative result is *not* a production-positive authorization or independent approval. No main-branch promotion or private-memory writes.
