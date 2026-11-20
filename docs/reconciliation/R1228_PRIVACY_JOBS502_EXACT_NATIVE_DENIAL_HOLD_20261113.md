# R1228 — Privacy native R30 denial pin to exact Jobs #502

**Review-only; HOLD_NO_GO; private-memory writes DISABLED.** No production IAM, Rules, service credentials, launch approval, or customer data changes.

Source parent Privacy #310: `a70fc6be60ca556c2133df5e4aaaebd4be45734a`.
Latest Jobs #502 immutable review candidate: `3f4156f62020c283f1a062455f9f32d8ddecadd7` (child of Jobs #501 `c7fe6b39cc2496a2f84ee7e7e05f7a4888123164`).

Changes in this PR are intentionally limited to pinning the original four-emulator R30 verification runner, its original negative-only native Jobs transport test, and the GitHub workflow's exact checkout/allowlist to the new Jobs source. Do not treat a prior Jobs #501 result as certification for Jobs #502. Keep the original source-hash checks and clean-worktree safeguards.

**Required new work:** independent source-matched `scripts/run-r30-native-jobs-privacy-acceptance.sh` with Node 22, pnpm 8.15.9, Java 21, Auth/Firestore/Functions/Storage emulators, isolated `urai-privacy-integration-test` synthetic project; inspect original stdout, exit status and artifacts, publish exact Privacy head, test count, and a complete failure/limitations ledger. Verify restored GitHub protected CI independently; an isolated Runpod PASS alone cannot satisfy it.

**Known gaps:** Jobs #502 retains 15 high dependency advisories and audit exit 1. Live GCS exclusive writer/retired principal 403, in-flight upload draining, exact-generation deletion, authenticated owner-positive lifecycle, protected SSO preview, exposed credential incident closure, external eligible nonauthor signoff and owner release approval remain open. No production GO inferred.
