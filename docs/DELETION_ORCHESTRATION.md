# Deletion Orchestration

Status: `RETAINED PREVIEW SOURCE — NOT ACTIVE — NOT DEPLOYED`

Manifest version: `1.2.0`

## Authority boundary

The canonical callable deletion surface remains `functions/src/deletion-mutation-guard.ts`, exported through `functions/src/functions-entry.ts`.

The retained files `deletion-contract.ts`, `deletion-inventory.ts`, `deletion-functions.ts`, `deletion-local-executor.ts`, and `deletion-source-registry.ts` preserve the unique source from PR #96 for focused review. They are deliberately not exported by the active Functions entry point.

## Retained preview behavior

The retained dry-run implementation:

- verifies administrative authority;
- inventories registered Firestore records;
- inventories export objects in Storage;
- checks Firebase Auth account presence;
- checks user and legal-hold records;
- creates a stable manifest hash;
- records pending adapters and blockers;
- writes auditable dry-run evidence.

Its execute mode requires a current dry-run hash and still fails closed. The local destructive executor is source-only and has no active callable path.

## Registered downstream boundaries

### urai-communications

`urai-communications` has a centrally registered deletion-source contract at schema version `1.0.0` for `delete`, `tenant_delete`, and `retention_purge`.

It remains **pending** with reason `SOURCE_CONTRACT_REGISTERED_PROTECTED_STAGING_E2E_REQUIRED`.

### urai-jobs

`urai-jobs` now has a centrally registered data-rights request/control-plane contract at schema version `1.0.0`.

The currently registered deletion operation is only `request_delete`.

It remains **pending** with reason `REQUEST_CONTROL_PLANE_REGISTERED_DELETE_EXECUTION_HARD_OFF`.

Jobs can accept and track an authenticated deletion request, but central Privacy must continue treating actual downstream deletion/anonymization execution as unavailable until the governed worker, retention/legal rules, provider propagation, protected staging E2E, and recovery/deployment receipts exist.

## Pending execution blockers

The following adapters remain pending and therefore block complete ecosystem deletion execution:

- urai-spatial;
- urai-studio;
- urai-analytics;
- urai-content;
- urai-jobs;
- asset-factory;
- urai-communications.

An active legal hold also blocks execution.

## Required certification

- exact-head unit, typecheck, Functions build, and static contract evidence;
- emulator tests for inventory, legal holds, stale plans, and cross-user denial;
- isolated protected-staging tests for local adapters and verification;
- downstream adapter contracts and acknowledgements;
- retained-record minimization and expiry rules;
- retry, recovery, and terminal-failure tests;
- user-visible receipt delivery after verification;
- independent privacy, security, and legal approval;
- deployment and rollback receipts.

Until every requirement is satisfied, URAI must not claim complete account or data deletion and must not activate the retained preview handlers.
