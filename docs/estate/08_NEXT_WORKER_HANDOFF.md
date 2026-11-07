# Exact continuation for next independent Privacy Chalk

**Verified snapshot:** 2026-11-07. Privacy main 1163d6f32a123ef9a6638e092a3eee5ec4a3b317; review #236 5daa194148c1f0b157062ca09b8f1b6e629d6d29. All claims in this pack are SOURCE-REVIEW or explicitly labeled historical test receipts. None authorizes production, private media access, consent issuance, or deployment.

## First source actions
Read main 1163d6f32a123ef9a6638e092a3eee5ec4a3b317, R841 #236 5daa194148c1f0b157062ca09b8f1b6e629d6d29, Jobs #320 ea8f0165ac74511a4e4196919ddd3109d0c1ff2e, Privacy starter #237 and master #262 current branch (do not trust moving PR head). Compare current branches and any new worker PRs before changing code. Verify hashes, source clean, original Firebase rules, approved source/deployment mapping.

## Reproduce ORIGINAL native acceptance only on authorized capable nonproduction host
Prerequisites: Node22, pnpm 8.15.9, Java21, Firebase CLI from frozen package, network to obtain approved pinned source, Unix socket permissions and ports 9099/8080/5001/9199/4400/4500/9299 free. No Google credentials/buckets or production project selection. Exact checkouts must be clean and Jobs under /tmp. Original entrypoint:

    URAI_EXPECTED_PRIVACY_SHA=5daa194148c1f0b157062ca09b8f1b6e629d6d29 URAI_JOBS_SOURCE_DIR=/tmp/urai-jobs-pinned bash scripts/run-r818-native-jobs-privacy-acceptance.sh

Inspect stages.tsv and hash each stage log, status/exit; stop on the first failing stage and preserve original unmodified assertion. Do not treat host preflight 5/5 or an old 23/23 fixture as a replacement. Do not weaken any rule, mock an integration, bypass Unix sockets or raise paid compute without authorization.

## Subsequent gates
Implement only after independent review: (1) real owner-authenticated, source-rights-verified, movie-selection scoped C6 grant issuance with explicit notice; (2) actual correctly signed current Jobs service identity; (3) hard revocation and protected output/Replay and same-generation delete, stale writer/link 403 at actual GCS; (4) cross-service signed subject-scoped ACK, RuAi and Analytics retractions; (5) exact-SHA protected hosted CI, staged source-to-provider revision parity and rollback, physical device, accessibility, separate privacy/legal review and founder GO. No production changes are requested by this handoff.

Current blocker: local original R841 host preflight failed port 8080 EADDRINUSE. Latest R841 Actions had five failed workflows and no observed Release Verification steps. Escalate runner admission with GitHub Support via existing issue, not by disabling checks.

## R844 — release hard-stop after diverged export security audit

New draft **[Privacy PR #239](https://github.com/LifeLoggerAI/urai-privacy/pull/239)** head `584f07787a293d1c0b2d46dbeefef3d8a3aaf62e`, based **exactly** on R841 `5daa194148c1f0b157062ca09b8f1b6e629d6d29`. It is an isolated, nonconflicting release-safety child; no original R841 or #160 branch modified. Adds:

- `scripts/assert-export-broker-boundary.mjs` — standalone source-shape gate for broker, signed-URL absence, C7 consent/receipt and live token, current admin/owner, per-64KiB reevaluation, direct Storage deny, safe client transport.
- `tests/export-broker-boundary.test.mjs` — 12 authored focused shape/refusal cases. **Local Node22 12/12 passed**, but those local bytes differ slightly in wording from the committed tests and no exact committed-head build/emulator is claimed.
- `scripts/verify-release.sh` and `scripts/security-gate.sh` now run both the focused tests and the mandatory broker admission guard before release admission. The guard correctly **returns nonzero on unmodified R841** because R841 still mints GCS signed URLs and lacks the protected broker and client component.
- `docs/security/R844_EXPORT_BROKER_ADMISSION_HARDSTOP_HOLD.md` defines the exact failure, scope and integration requirements.

This is an **intentional security HOLD**, not permission to deploy or a composite implementation. Do not force-merge #239 before source convergence, do not disable the gate to obtain a green workflow, and do not transfer #160's October success to R844. The next independent worker must preserve #160 signed-claim/current-account broker, deletion generation fences and client Storage denial while preserving R841 C6 scoped consent/Jobs/revocation/deletion safeguards; reconcile consent record projections and `check-complete-export-contract.mjs`/`validate-rules.mjs` on an independently reviewed integration branch, then execute full original source and four-emulator suites and actual provider IAM + private-media tests. **Release HOLD.**
