# ONE URAI Genesis — R1054 exact-source Privacy -> Jobs #437 candidate (HOLD)

**Scope:** Review-only repin of existing Privacy native denial harness from Jobs #436 `60c728f6db766aa839cc8b0286bb81d7a3c6c2f6` to newer no-loss, two-parent Jobs #437 exact SHA `65c746bdc8f1c39db417ce7cf978e1e29b8aac16`. This is not a new credential, cloud authorization, write path, production release, or claimed emulator PASS.

## Exact-source custody
- Privacy parent: #272 `f5a4b8d04ca4b8232657861640067af4c3b469f5` tree `f2204e6f6f23a26f8ac14a19f38d54175370868c`. Preserve sibling #273 and #272 untouched.
- Jobs: #437 `65c746bdc8f1c39db417ce7cf978e1e29b8aac16`, two Git parents #436 `60c728f6db766aa839cc8b0286bb81d7a3c6c2f6` and #435 `eb6a43286f143ff37e3602522551dec430815dd9`; strict R1052 credential guard and R1051 missing custody docs both preserved.
- Three existing files retain their native tests while replacing all four source pins (workflow 2, runner 1, emulator test 1) to exact Jobs #437.
- Workflow eligibility extended to `review/chalk-r1054-privacy-jobs-r1053-`; isolated checkout path label advanced, no secrets or IAM changes.
- Original Privacy grant, withdrawal and denial logic is unchanged. Runtime impact is restricted to test/workflow source targeting.

## Required verification
1. Pin and inspect new Privacy HEAD SHA and exact Git tree; ensure no source drift after PR creation.
2. In a credential-scrubbed, disposable environment, run frozen installation, Privacy typecheck/build and the existing native Auth/Firestore/Storage/Functions emulator boundary tests on exact Privacy HEAD and Jobs #437; preserve full redacted logs, hashes and exact commits.
3. Check Jobs #437 exact-head native verification separately. A prior Jobs #428/#432/#436 PASS or static test is insufficient for this pair.
4. Obtain independent signoff via legitimate protected CI. GitHub Actions runner admission/billing incident remains unresolved; **do not bypass protections**.

## P0 HOLD
- Labs #370: provider-side revocation of potentially exposed Runpod API credential unconfirmed; no key-bearing test Pods.
- Jobs #252: exclusive cloud GCS writer, durable reservation fence, in-flight upload drain, post-revocation late-write denial and exact-generation physical delete not proven.
- Positive authenticated consent -> render -> protected Replay -> revoke/delete lifecycle, device/accessibility/AAA+++ visual/rollback acceptance and independent approval not yet complete.
- Keep private-media writes disabled, no main merge or production promotion.

**Verdict: review-only / Genesis HOLD.**