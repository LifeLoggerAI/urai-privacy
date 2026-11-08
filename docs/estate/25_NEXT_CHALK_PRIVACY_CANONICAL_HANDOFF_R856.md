# ONE URAI GENESIS — PRIVACY NEXT CHALK CANONICAL HANDOFF

Prepared November 7, 2026 Central / November 8 UTC. This is a source-pinned continuation guide for the next independent Chalk. PRODUCTION RELEASE HOLD. It does not certify a complete audit of every branch or a functioning deployed Privacy runtime.

## Read first

- Canonical engineering review: [Privacy R856 draft PR #251](https://github.com/LifeLoggerAI/urai-privacy/pull/251), exact head e6d38815bdef8331c3e20746f341114f68accee3, branch review/chalk-r856-atomic-attempt-finalization-20261107. Base: R855 PR #250 at 999e622330c1969335f440a4cdd9d76c9ef3610d. Both open, draft, unmerged.
- Forensic intake: [Privacy draft PR #238](https://github.com/LifeLoggerAI/urai-privacy/pull/238), branch audit/genesis-privacy-controls-20261107-c1, previously observed head 74144bf1ad66877f26986dbf59ee79b573b322b8. Read its estate reports 17_R848 through 24_R856 and this file.
- Shared master: [Labs Genesis draft PR #265](https://github.com/LifeLoggerAI/urai-labs-llc/pull/265), branch audit/genesis-privacy-reconciliation-20261107-c1, previously observed head 279ccd3a3186d514f90f76d951c3034d918f385e. Read docs/estate/00_START_HERE.md and docs/estate/worker-receipts/urai-privacy-forensic-audit-2026-11-07.md (includes cumulative R848–R856).
- Engineering evidence: Privacy R856 branch, docs/security/R856_ATOMIC_ATTEMPT_JOB_CLEANUP_HOLD.md. R853 evidence includes an important superseded GCS selector correction.
- Start with connected GitHub and re-verify all moving refs and concurrent workers BEFORE writing. Interactive original GitHub account 2FA is unavailable; the connected GitHub tool works for repository operations. Never infer merges or production acceptance from draft code.

## Source-review chain (all observed OPEN / DRAFT / UNMERGED)

| Review | PR | Verified head | Purpose |
| --- | --- | --- | --- |
| R841 | [236](https://github.com/LifeLoggerAI/urai-privacy/pull/236) | 5daa194148c1f0b157062ca09b8f1b6e629d6d29 | native preflight, C6 / Jobs |
| R844 | [239](https://github.com/LifeLoggerAI/urai-privacy/pull/239) | 584f07787a293d1c0b2d46dbeefef3d8a3aaf62e | legacy export URL hardstop |
| R845 | [240](https://github.com/LifeLoggerAI/urai-privacy/pull/240) | 91d85bb55b13d21004d099dc8c339acf94ce3627 | consent-bound export broker |
| R846 | [241](https://github.com/LifeLoggerAI/urai-privacy/pull/241) | 6211e78fbac9a1dfd16be1b689bd75b28b7e9e02 | generation-pinned deletion |
| R847 | [242](https://github.com/LifeLoggerAI/urai-privacy/pull/242) | 163cf64882303d30e5461f659d07f8ac9c4ce7df | Firestore document-version deletion |
| R848 | [243](https://github.com/LifeLoggerAI/urai-privacy/pull/243) | ec71f15a545288685b4bd5846ecf88cdb3314e5c | current admin/Auth, attempt lease, legal holds, Auth incarnation |
| R849 | [244](https://github.com/LifeLoggerAI/urai-privacy/pull/244) | c5eda2f01f708af544d966ade67fc164e0e670c5 | retire dormant direct signed URL callables |
| R850 | [245](https://github.com/LifeLoggerAI/urai-privacy/pull/245) | 1b8d310e265dbe18bfb177d881729d2be6124752 | six workflow files, seven Node 22 settings |
| R851 | [246](https://github.com/LifeLoggerAI/urai-privacy/pull/246) | 2a05f7a9a08e2f060a929549c18de82bc9a41103 | current-owner C7 request creation, strict deletion fence |
| R852 | [247](https://github.com/LifeLoggerAI/urai-privacy/pull/247) | 5237ebbbe9131d152968004c359b215a6a79bab8 | worker cannot mint positive C7 consent projection |
| R853 | [248](https://github.com/LifeLoggerAI/urai-privacy/pull/248) | 32c2e41161c8683bacc612335eaafbd16e0144c7 | exact-generation export writer and broker read |
| R854 | [249](https://github.com/LifeLoggerAI/urai-privacy/pull/249) | b58a9617fde181c82d11531639ffec92bf24fdcf | generation-safe cleanup in four paths |
| R855 | [250](https://github.com/LifeLoggerAI/urai-privacy/pull/250) | 999e622330c1969335f440a4cdd9d76c9ef3610d | stale cleanup state, leases and expiry |
| R856 | [251](https://github.com/LifeLoggerAI/urai-privacy/pull/251) | e6d38815bdef8331c3e20746f341114f68accee3 | joint export job and attempt cleanup finalization |

Historical [donor PR #160](https://github.com/LifeLoggerAI/urai-privacy/pull/160) remains open at 809d94ad7fc93322780d13ff3f0bade7612b3ec2. [Knowledge baseline PR #237](https://github.com/LifeLoggerAI/urai-privacy/pull/237) is also distinct. Do not merge stale donor behavior over later guards.

## Current security architecture and implementation claims

- Browser/UI, callable Functions, Firestore and Storage must each enforce owner rights, not merely show an owner-only label. Source-level guards do not establish production-effective IAM, Rules or private media access.
- C7: canonical owner-issued data.export consent must have an identical positive receipt/hash, tier, purpose, policy, status, expiry and tombstone projection. R851 guards request creation, R852 guards worker claim/collection/publication; protected broker checks current admission during delivery. The worker must NEVER invent or repair a positive projection.
- Deletion requests do not require export consent. R846–R848 protect owner, Auth creation incarnation, Firestore update version, GCS generation, active tombstone, legal holds, admin/current bearer, unique execution token and lease. Account deletion completion remains blocked until eight signed subject-specific downstream acknowledgements.
- Private C6 movie rendering is a distinct permission path. Owner-signed positive consent, selected-source provenance, current rights and actual Privacy→Studio→Jobs→Replay integration are NOT yet independently proven.
- R853 creates GCS exports with a create-only precondition, records generation and SHA, and uses conditional generation-match metadata/read in the broker. IMPORTANT ERRATUM: the earlier FileOptions numeric generation selector could round 64-bit IDs; do not restore it. Use exact decimal-string ifGenerationMatch on the current object. Corrected R853 head is 32c2e41161c8683bacc612335eaafbd16e0144c7; superseded earlier broker blob 602fbf8aa189884e5a2bcdb4c8eaedecdf28152e is NOT deployable.
- R854 protects failure, expiry, retry and attempt-maintenance Storage deletes using exact-generation preconditions; no guessed latest generation. R855 fences stale expiry/claim state. R856 makes the attempt and parent job share a cleanup token, defers expired/completed status until after conditional Storage deletion, and checks both records in the same Firestore finalization transaction. Incomplete cleanup keeps pending paths.
- Legacy or partially written objects without a proven generation remain blocked from automated deletion. They are an unresolved retention/remediation obligation, not deletion-completion proof.

## Truthful evidence ledger

Past independent local pure/source policy suites reported: R848 19/19; R849 12/12; R850 8/8; R851 21/21; R852 33/33 INCLUDING R851 21; R853 16/16; R854 12/12; R855 12/12; R856 27/27 INCLUDING R855 12 plus 15 new. Do not add overlapping suite totals as independent certifications. New R856 standalone policy TypeScript passed. R856 connected-GitHub code readback: 17/17 STATIC predicates. Seven newly authored R856 source-contract tests are wired in both release and security gates but not executed in a complete repository checkout.

R856 source blobs: export-cleanup-state-policy.ts c6444509fa4623db0d8058212bc433aacf3550d5; export-attempt-maintenance.ts 7c7f1dffb4280304880f964589445849b1871a47; export-generation-cleanup.ts cc65b97556a4886cc49bc56e5c49492f47305e6c; new finalization test dfc556d959e3e52c9a53374574f9ada0c923d074; new source-contract 709db7850e7a0060cde9904469800b95507ebb65.

Original R856 local TAP receipt is preserved in the ChatGPT Library at /policy.tap (file ID file_00000000f15081f58d1bec1075fd0e73), 4681 bytes, SHA-256 03b4fa127ddd9f2bf7c0d21e8a452d6d59cfaa41b70f153fecdbdd3128c6b540, terminal summary 27 PASS, 0 FAIL. Other reports and exact file/blob identities are in the forensic PR and master ledger. These are PURE policy tests and static source checks, NOT authenticated cross-service runtime acceptance.

## GitHub hosted CI evidence — still NO executable certification

At R856 exact head five workflows reported failure: Production Verify run 42433071223; Privacy Release Verification 42433071231; Release Verification 42433071232; package validation 42433071281; Consent Export and Deletion Branch Validation 42433071334. Release Verification job 128585993484 has ZERO visible steps, original job logs returned HTTP 404 BlobNotFound; combined commit status contained no individual statuses. R848–R855 encountered similar no-step failures. Root cause unknown: do not assert a compiler failure, a successful run, or that Node 20 caused it. R850 source aligned Node 22, but actual runner admission is not established.

## Next Chalk — safe required execution order

1. Re-verify exact GitHub PR heads and reconciliation with parallel workers and newest master estate history. Do not mistake R856 Privacy for the newest whole-UrAi wave.
2. Investigate GitHub Actions no-step failures with authorized read-only job/check/audit evidence; original account interactive 2FA unavailable. Do not buy compute or alter billing without owner authorization.
3. Obtain a clean exact-R856 checkout in a no-new-charge authorized Node 22 + Java 21 environment; follow the repo's lockfiles and native release scripts, install/build/typecheck exact source, run the original tests/Rules and all new source contracts; preserve command, source SHA, logs, exit status and hashes.
4. Execute actual Auth + Firestore + Storage + Functions four-emulator integrated owner/foreign/revoked/disabled, C7 forged/revoked/expired, legal hold, stale token, deletion races. Previous emulator receipts are historical and cannot certify new R856.
5. In explicitly authorized disposable REAL GCS data, test 412 generation replacement/nonatomic Storage+Firestore races, simultaneous cleanup workers, lease expiry, job+attempt changes, partial failure and retained unknown generations. Never use user private media.
6. Independently prove positive owner-signed C6 consent and the protected source-specific Privacy→Studio→Jobs→Replay movie; verify revocation/foreign-source denial, provider-effective IAM and stale signed URL withdrawal.
7. Obtain eight independently signed, subject-scoped downstream deletion acknowledgements before claiming account-deletion completion. Finish physical/device/accessibility acceptance and explicit founder GO. Keep RELEASE HOLD throughout.

Operating constraints: no merges to main, no production deployment, no unapproved paid Runpod/GCP compute, no real user deletion, no IAM changes or exposure of private media. Source fixes are real engineering, but source-review acceptance, four emulators, authenticated cross-system runtime and actual signed production consent remain different evidence classes. This Privacy lane does not certify the entire built UrAi/LifeOS system.

## Exact next-chat starter

Continue One UrAi Genesis PRIVACY from draft PR #251 at source e6d38815bdef8331c3e20746f341114f68accee3. Read Privacy forensic PR #238 docs/estate/25_NEXT_CHALK_PRIVACY_CANONICAL_HANDOFF_R856.md, all earlier forensic packs and Labs Genesis master PR #265 before changes. Reconcile moving heads and other Chalk branches. Investigate GitHub no-step CI; run exact-source builds, source-contract and Firebase four-emulator tests in authorized no-new-charge environment, then disposable real GCS 412/cleanup races and signed-positive owner C6 Studio→Jobs→Replay. Maintain source-pinned evidence, unmerged branches and PRODUCTION RELEASE HOLD. Do not expose private media, bypass consent, merge or deploy.
