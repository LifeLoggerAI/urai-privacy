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
