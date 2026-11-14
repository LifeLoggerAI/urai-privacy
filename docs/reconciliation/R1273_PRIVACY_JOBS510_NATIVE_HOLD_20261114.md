# CHALK R1273 — Privacy native acceptance pinned to Jobs #510 review merge (production HOLD)

Jobs #510 exact merged review source `fed883c750179842800b9056d6fc1deddcb39f9f`, parent Privacy #319 merged review `9c8717f2e18c36069fc3d2b8862307794e2486a4`. This branch changes only four R30 source-lock runner/transport/workflow/guard files plus this custody note. No first-party private-memory authorization, GCS IAM, consent write, or production changes.

Initial source SHA `d12906164c01f2ead4761e2b9f121d226f44cb3a` at Runpod R950 `bvandlyauxhevl`:
- Source-lock test `node --test tests/integration/r1237-r30-merged-jobs-ci-gate.test.mjs`: **4/4 PASS, exit 0**, original TAP SHA256 `5ae243c192703062c9f6cfaf2bdacba724fa62c251dda82a0378bb36e94f611b`.
- Native `bash scripts/run-r30-native-jobs-privacy-acceptance.sh` with explicit `URAI_EXPECTED_PRIVACY_SHA` and exact Jobs510 source: **exit 0, 8 R30 PASS markers, emulator Privacy callable HTTP403, no C6 grant or render**, shutdown confirmed. Original full log SHA256 `21c91be6d058564726b83c7ed8f46e3920729252eca9d2d05a13d837ba39b0f3`. Synthetic negative-denial only, not real signed production owner.
- Jobs #510 merged review itself: frozen install PASS, installed Zod4.6.7 Functions tests PASS, GCS canaries 24/24, Studio→Jobs contract 12/12 PASS, full `pnpm urai-jobs:verify` exit 0. Production audit exit **1** with **0 HIGH / 0 CRITICAL**, 23 MODERATE, 5 LOW; do NOT claim full audit PASS.

Final PR HEAD and actual merged review HEAD must be separately reverified before merging or signing off.

**Release remains HOLD_NO_GO:** Vercel SSO project `prj_pt7oOQLnCFki8vJb4ph9XhIjiLwZ` private GitHub connection missing, only prior deployment ERROR, no live Genesis preview; GitHub protected CI failed; live effective GCS IAM sole broker writer, stale upload draining, generation-specific deletion and true signed owner-positive lifecycle uncertified; credential-incident closure, qualified independent reviewer approvals, device/Spatial/store acceptance and founder GO missing. All 11 release gates BLOCKED; private-memory writes DISABLED; no main or production deployment.
