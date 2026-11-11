# ONE URAI Genesis — R1060 Privacy pinned native denial for Jobs R1059 (HOLD)

## Source and donor custody
- Parent Privacy #274 (original SHA): `277439f07e8ef91116f0396ad0a4d1f309004530`. Preserve its original branch, tests, immutable evidence and previous #272/#273 donors.
- Current exact Jobs test dependency: Jobs #443 three-parent R1059 `bbe3ef6f8807a42c0a402ade8a5d5ebd43f4c0aa` (parents Jobs #442, #441, #440). This includes both the R1056 Node preload guard and R1057 owner/purpose-wide review-only model, with root verification enrollment.
- This child modifies only three existing source-pin/test-runner/workflow files and adds this custody note. The native test assertions, Privacy authorization logic and production media interlock remain unchanged.
- Four previous Jobs `65c746bdc8f1c39db417ce7cf978e1e29b8aac16` pin occurrences across three files were updated consistently to `bbe3ef6f8807a42c0a402ade8a5d5ebd43f4c0aa`. The workflow review-only eligibility was extended for this branch, not relaxed globally.
- GitHub Actions may report zero-step runner failures. That is NOT native acceptance.

## Required exact-pair verification
1. Public-source credential-free checkout with immutable clean SHAs: Jobs `bbe3ef6f8807a42c0a402ade8a5d5ebd43f4c0aa`; Privacy this new commit.
2. `URAI_EXPECTED_PRIVACY_SHA=<this SHA> URAI_JOBS_SOURCE_DIR=/tmp/<disposable clean Jobs checkout> bash scripts/run-r30-native-jobs-privacy-acceptance.sh` on Node 22, pnpm 8.15.9 and Java 21. The native script tests Auth+Firestore+Functions+Storage Firebase emulator negative authorization only (positiveGrant=false, render=false).
3. Separately run Jobs `pnpm urai-jobs:verify`, `pnpm typecheck`, and `pnpm build` on the exact Jobs #443 commit. Record exit status, hashes and immutable logs, and independently distinguish emulator warnings.
4. Confirm private-output hard-off and no live GCS service-account permission grants.
5. Independently review the exact pair; protect prior branches and do not merge or deploy to production on local-only tests.

## Release NO-GO
Labs #370 potentially exposed Runpod API credential remains without provider-side revocation receipt. Jobs #252 exclusive provider GCS writer, durable reservation/drain, generation-bound deletion and post-revocation write denial remains unproven. Positive user-signed consent→Replay→withdrawal/deletion, protected CI, independent review, device/visual/accessibility/rollback/founder signoff remain outstanding. **ONE URAI Genesis HOLD**. No production IAM change, private-media write enablement, user media or deployment is authorized.
