# URAI Privacy Repo Rollout Plan

This plan describes how to roll out the `urai-privacy` package across the URAI ecosystem.

## Phase 1 - Inventory

Target repos:

- `UrAi`
- `UrAiProd`
- `UrAi-Dev`
- `urai-admin`
- `urai-analytics`
- `urai-communications`
- `urai-content`
- `urai-foundation`
- `urai-labs-llc`
- `urai-marketing`
- `urai-spatial`
- `urai-staging`
- `urai-studio`

Tasks:

- Add `privacy/PRIVACY_VERSION.md`.
- Add `privacy/data-inventory.yaml`.
- Identify all collections, tables, event streams, and AI inference outputs.
- Classify fields using L0-L7.

## Phase 2 - Consent Mapping

Tasks:

- Map every feature to C0-C8.
- Identify feature gates that need explicit consent.
- Identify any bundled consent prompts that must be split.
- Identify revocation behavior for each consent tier.

## Phase 3 - Retention, Export, Deletion

Tasks:

- Map all records to R0-R6.
- Add deletion jobs for user-controlled records.
- Add export jobs for user-visible records.
- Add biometric-only deletion where relevant.
- Add derived-data deletion or recomputation behavior.

## Phase 4 - Audit and Admin Access

Tasks:

- Identify all admin access paths.
- Add audit event definitions.
- Add system access events for sensitive inference pipelines.
- Add incident hooks for failed deletion, consent bypass, or unauthorized access.

## Phase 5 - Monetization / Data Sharing

Tasks:

- Identify any data-sharing or data monetization path.
- Require C8 consent.
- Require anonymization batch records.
- Require minimum cohort size.
- Require revenue ledger events.

## Phase 6 - Release Gate

Tasks:

- Complete privacy review record for each feature.
- Block release if classification, consent, retention, deletion, export, or audit mapping is missing.
- Update repo-level privacy adoption status.

## Recommended Order

1. `urai-admin`
2. `urai-analytics`
3. `UrAiProd`
4. `UrAi`
5. `urai-spatial`
6. `urai-communications`
7. `urai-studio`
8. supporting legal/marketing/content repos
