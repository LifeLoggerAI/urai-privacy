# ONE URAI Genesis — issued Family Stories path

**PRODUCTION HOLD / NO-GO. PRIVATE-MEMORY WRITES OFF.**

## Result

The new review-only issuer and delivery implementation passed **14/14 native synthetic scenarios, zero failures and zero skips**. Both service builds, the default-off/canonical-denial preflight, the Firebase emulator command and the outer supervisor exited **0**.

The successful run finished **November 19, 2026 at 8:22:10 p.m. Central** (**2026-11-20T02:22:10.003Z**), on existing authorized worker `vxmo8gjblvsvxg`, Node `v22.23.5`, Java 21 and lock-matched existing dependencies. No worker was provisioned or dependency installed.

The positive receipt was produced by an authenticated synthetic owner endpoint, persisted with an immutable delivery event, and delivered over actual loopback HTTP by a separately authenticated synthetic service actor. The test did not directly seed that receipt or the withdrawal/deletion fences.

**This is evidence for the proposed synthetic implementation. It is not canonical production issuance or release approval.** The positive policy, signing key and service identity remain explicit fixtures. The real canonical setter/evaluator still reject `storytime.family_share`.

## Exact source

| Service | Base implementation commit | Base tree | Proposed runtime tree |
| --- | --- | --- | --- |
| Storytime #120 | `cc0baee8a4b2bafc452b3e097b1f8770227d4cb7` | `61ed8d6c784a5ca2d1733b19173b1709d403e6f0` | `d1c182d311d5233ae19407b29c6f71bfdebd784d` |
| Privacy #335 | `8f79ade634a14fa31f8428e84b01f71cecec8d7e` | `197eefb12a4fe2896df7c364a6018437317fe6b4` | `109d09c512426a0c07fb3cd501b537ac0444e25b` |

The proposed runtime trees add one module per archived service; they are local Git trees, **not published commits**.

| New module | Git blob | SHA-256 |
| --- | --- | --- |
| Storytime `functions/src/family-privacy-delivery-review.ts` | `2b272506a1a5809e51a4cd2673b4d1e55b9d22c8` | `219c5d5426f2730345a5769b28f88e4c483afc5e84e63903aec8639f24f817c0` |
| Privacy `functions/src/family-story-share-issued-review.ts` | `c46b1885e378e50ff381c199c8887ef33a845230` | `c6e5fc0bdb6ad49e71312eef5df11e1ead2c157361dddaa3156d9f8fa892bc89` |

Storytime head `a626d8c626b408453ba84bbb53bb55182d0fa581` and Privacy head `a59f78271c69b0fe62556971f9fd87d1d84f2584` add documentation only after these implementation commits. All original tracked files were rehashed after execution: **zero changes** in either isolated base snapshot. Ordinary entrypoints, canonical registries, package/lock files and production configuration remain unchanged.

Sources: [Storytime #120](https://github.com/LifeLoggerAI/urai-storytime/pull/120), [immutable Storytime receipt](https://github.com/LifeLoggerAI/urai-storytime/blob/a626d8c626b408453ba84bbb53bb55182d0fa581/docs/estate/R1601_FAMILY_SIGNED_TWO_PARENT_CONVERGENCE_EXACT_SOURCE_20261120.md), [Privacy #335](https://github.com/LifeLoggerAI/urai-privacy/pull/335), [Privacy encoder](https://github.com/LifeLoggerAI/urai-privacy/blob/a59f78271c69b0fe62556971f9fd87d1d84f2584/functions/src/family-story-share-wire-review.ts).

## Implemented flow

1. The current verified owner explicitly approves one source version and title/summary digest for one recipient. The issuer derives owner identity from Firebase Auth and checks recipient, source and deletion fences.
2. A Firestore transaction writes the scoped signed decision and immutable outbox event. Two simultaneous identical authenticated HTTP requests produce one receipt/event, one new response and one duplicate. A changed request with the same ID is rejected.
3. The fixed delivery actor can submit only an event ID. The dispatcher verifies stored event bytes, posts to a fixed loopback receiver and stores an ACK separately. A relative cannot submit a trusted event directly.
4. The receiver independently verifies the outer envelope and unchanged #120 inner receipt signature. The outer binds kind, destination/audience, demo identity realm, scope revision and receipt. Current source/account/fence checks precede receipt persistence.
5. The owner then invokes the unchanged Storytime grant callable. Mom receives only the exact textual projection. Delivery itself does not silently create a family view grant.
6. A signed withdrawal event revokes local receipt/grant state and advances the story-wide epoch. Withdrawal arriving before its grant prevents later authorization.
7. A signed subject-deletion event first commits a durable tombstone, then purges the enumerated family authority records. Recipient deletion preserves another owner's source story, chapter, sharing state and unaffected grant.

The new modules are exported only by the disposable fixture. All six reviewed callables passed default-off checks. Metadata loading checks the standard demo/emulator configuration; every new callable independently checks the full activation, synthetic policy, project and fixed hosts before writes.

## Native scenarios

| # | Scenario | Result |
| --- | --- | --- |
| 1 | verified relatives share family claims but an unissued source grants no access | PASS |
| 2 | unchanged canonical Privacy set and evaluate APIs still reject family purpose | PASS |
| 3 | concurrent identical owner issuance converges on one receipt and event before delivery enables Mom's exact view | PASS |
| 4 | exact issue and delivery retries are idempotent while conflicting issuance is denied | PASS |
| 5 | same-family cousin, outsider, second story and foreign-owner issuance deny | PASS |
| 6 | ordinary users cannot dispatch or accept an otherwise valid signed event | PASS |
| 7 | delivery requires its exact UID and current account claim rather than a copied token claim | PASS |
| 8 | altered public envelope cannot replace the immutable delivered event | PASS |
| 9 | same-version content change invalidates the issued projection until the source is restored | PASS |
| 10 | owner withdrawal is issued and delivered, terminal, idempotent and replay resistant | PASS |
| 11 | withdrawal delivered before delayed grant prevents any later authorization | PASS |
| 12 | actual owner deletion propagates a fence and purges scoped authority without deleting foreign sources | PASS |
| 13 | actual recipient deletion purges its authority while preserving someone else's story and grants | PASS |
| 14 | delayed grant replays and delete retries cannot restore deleted owner or recipient authority | PASS |

Admin fixtures create eight synthetic accounts/claims and inert story/chapter documents. One chapter is edited and restored for the digest check. No positive receipt, withdrawal fence or deletion tombstone is written by test Admin code; the test never reads the signing private key or signs events. Same-project emulator HTTP is not cross-project cloud IAM certification.

The concurrent issuance case is one real overlapping pair. It does not certify every revocation/admission race.

## Deletion scope

After owner deletion and recipient deletion, independent queries found **zero** owned/received consumer receipts, owned/received family view grants and subject-owned story-sharing states for each deleted subject.

Minimal terminal fences and event/state evidence remain to prevent replay. The synthetic Privacy decision/outbox journal remains. Source stories, chapters, recordings, photographs, backups and unrelated services are outside this purge. **Family-authority cleanup is not completed global deletion.**

Retry after completed cleanup passed. The code resumes pending cleanup, but this execution did not inject a mid-purge crash or storage failure; no such recovery certification is claimed.

## Remaining gates

| Gate | State |
| --- | --- |
| Synthetic issuer and signed HTTP delivery | Demonstrated |
| Synthetic story-scoped withdrawal after delivery | Demonstrated |
| Synthetic family-authority deletion after delivery | Demonstrated |
| Canonical production purpose/issuer approval | **False / unregistered** |
| Cloud signer custody, rotation and service IAM | **Uncertified** |
| Automatic outbox scheduling/retry operations | **Not implemented by this package** |
| Current canonical authorization checked on every read | **Not implemented** |
| Immediate denial while withdrawal/deletion awaits delivery | **Not certified** |
| Owner-wide purpose withdrawal | **Not implemented** |
| Source-media and global deletion | **Not completed** |
| Hosted authenticated family experience and independent GO | **Not certified** |

The test explicitly invokes the dispatcher as its synthetic service actor. The unchanged #120 reader uses delivered local receipt/state and does not synchronously consult canonical Privacy. Pending withdrawal/deletion cannot be presented as immediately enforced. Reliable automatic transport and a current-read authorization contract remain necessary before real grants.

The proposal preserves story-wide epochs and no-regrant behavior. Selective renewal, multi-recipient consent policy, guardian/subject rights and canonical activation remain governed by [Privacy #334](https://github.com/LifeLoggerAI/urai-privacy/issues/334).

## Execution history

**Attempt 01:** both builds and default-off checks passed, but Firebase CLI metadata discovery rejected custom variables absent from its discovery subprocess. The CLI nevertheless ran the test script, producing **0/14 pass and 14 cascading failures** from missing endpoints and dependent state; supervisor exit **1**.

**Correction:** fixture import-time checks now use standard emulator configuration that the CLI forwards during metadata loading. Every callable's activation/policy/project/host guards remain intact. Only `fixture/functions/index.cjs` changed between execution manifests. Both service overlays and the test file were unchanged.

**Attempt 02:** all 14 scenarios, both builds, preflight, emulator command and supervisor passed. Both attempts and their gate reports are preserved. My initial progress description that no scenarios ran in attempt 01 was corrected after inspecting the complete transcript.

| Successful evidence | SHA-256 |
| --- | --- |
| Native transcript | `7971225d0ab8960ee55548bb3a94524783aab321e9ae5e43bbb41bcab9e664f4` |
| Gate report | `c640651b2a6fdd0f3ff3292814d8a3af6903b34ce99af600b8970f9f3cb2557c` |
| Source/harness manifest | `5c48d7d8a12d5b9b80a4c988e0e8f806aa773ff89405b5abe15e8d1a1d47e98d` |
| Step exits | `265b647e24c829a78d2d74d7ad2d88ce429f7cb879d41793440d78494e609d96` |
| Supervisor result | `959718ad50aa5e96aca385f0aad48261f79f2e3a7314c41f54b134d57af08c97` |

Cleanup readback at `2026-11-20T02:23:02.637171+00:00` confirmed the ephemeral private key removed, all seven named emulator ports closed, and no process remaining in the isolated directory. Base source and overlay hashes matched. Existing workers were preserved.

Historical #119 664/664, #118 29/29, #120 31/31 and #335 20/20 evidence was reused, not rerun or added to this new suite. The earlier 14-test boundary run is a separate historical execution with directly seeded positive fixtures.

## Proposed publication

No GitHub branch, PR or comment, canonical registration, live permission, signer provisioning, deployment or merge was made by this continuation.

The next proposed external action is one **draft Privacy PR**, stacked on exact #335 head, adding the complete standalone review package under `review-packages/family-issued-review-a22e15c8/`. It would contain both isolated overlay modules, the harness, contract and evidence, while leaving ordinary service entrypoints/configuration unchanged and referencing #120 as a dependency. The user's instruction requires explicit approval before publication.
