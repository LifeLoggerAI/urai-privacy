# ONE URAI Genesis R1063 — Privacy negative-boundary exact Jobs #448 source pin (REVIEW ONLY / HOLD)

## Immutable sources
- Privacy parent PR #275 HEAD `325c538ce06ade9fd357ba48ebb0017f4d912366` (tree `5c8ad2e60c6d2d86c0afe311a7c5edb7455bd8c0`) retained unchanged on its original branch.
- Jobs PR #448 `472d3c73a904c8269098f03aaa80f2de9edb7082` (genuine two-parent convergence of #447 + #446) is the exact Jobs source this new review candidate targets.
- Three existing native-test transport files are repinned: workflow has 2 exact occurrences, script 1, emulator fixture 1 (4/4), all previous Jobs #443 pins removed. Workflow PR branch eligibility extended for the R1063 review branch.
- No Privacy production grants or deletion behavior modified. No Jobs donor, master branch or releases changed. Root content/privileged credential values not inspected.

## Evidence and limitations
- GitHub original source blobs at Privacy #275 were read back and pin counts validated before creating any replacement Git blob. Exact repin contents were written as new Git blobs with separate immutable SHAs.
- Source pinning is **not** native test acceptance. Jobs #448 exact-head frozen install, full Jobs verification/build/typecheck, and this Privacy exact source + four-Firebase-emulator negative denial must be executed anew and their complete sanitized receipts preserved.
- Concurrent Runpod R1063 worker named `one-urai-r1063-jobs448-full-security-native` was running during preparation; this work does not stop it, read sensitive logs or claim its results.
- Prior successful R1059/R1060 Jobs #443 + Privacy #274/#275 results apply only to their original exact source pair. Do not inherit or relabel those passes.
- Jobs #448 is review-only and its broker still denies writes. Real sole-principal GCS Storage IAM, durable reservations, upload drain, generation-specific delete and post-revocation denial Jobs #252 remain unverified. Labs #370 Runpod credential revocation, protected CI/independent approval, positive authorized consent-to-render-to-Replay-to-delete and device/accessibility/visual/rollback remain release HOLD.
- No production IAM change, private write activation, main merge, or deployment.

**Global Genesis release verdict: HOLD.**