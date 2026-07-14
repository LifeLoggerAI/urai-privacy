# Deletion Orchestration

Status: `IMPLEMENTED BUT NOT DEPLOYED`

Manifest version: `1.0.0`

## Active callable behavior

The deployed function surface uses `functions/src/deletion-functions.ts` for deletion processing and execution requests.

A dry run:

- verifies administrative authority;
- inventories registered Firestore records;
- inventories export objects in Storage;
- checks Firebase Auth account presence;
- checks user and legal-hold records;
- creates a stable manifest hash;
- records pending adapters and blockers;
- writes auditable dry-run evidence.

Execute mode requires the current dry-run hash but still fails closed. It cannot invoke destructive behavior until all registered adapters and verification gates are certified.

## Registered adapters

Active local definitions:

- urai-privacy Firestore;
- urai-privacy Storage;
- Firebase Auth.

Pending definitions:

- urai-spatial;
- urai-studio;
- urai-analytics;
- urai-content;
- urai-jobs;
- asset-factory;
- urai-communications.

Any pending adapter or active legal hold blocks execution.

## Local adapter source

`functions/src/deletion-local-executor.ts` contains idempotent local operations and post-action verification for the registered privacy collections, user document, export objects, session revocation, and Auth account state.

That source is intentionally not called by the active callable in this branch.

## Required certification

- exact-head unit, typecheck, and Functions build;
- emulator tests for inventory, legal holds, stale plans, and cross-user denial;
- isolated staging tests for local adapters and verification;
- downstream adapter contracts and acknowledgements;
- retained-record minimization and expiry rules;
- retry, recovery, and terminal-failure tests;
- user-visible receipt delivery after verification;
- deployment and rollback receipts.

Until those requirements are met, URAI must not claim complete account or data deletion.
