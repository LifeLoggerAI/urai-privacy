# Export Contributor Registry

Registry version: `1.2.0`

Status: implemented source-level registry, not deployed.

The registry is defined in `functions/src/export-contributor-registry.ts`.

## Active contributor

`urai-privacy-firestore` is the only active contributor. It covers the user profile and the user-scoped privacy collections listed by the local export contract.

## Registered pending contributors

### urai-communications

`urai-communications` has a versioned source contract registered centrally.

- schema version: `1.0.0`
- source contract owner: `LifeLoggerAI/urai-communications`
- current central status: `pending`
- reason: `SOURCE_CONTRACT_REGISTERED_PROTECTED_STAGING_E2E_REQUIRED`

The registered source contract covers the Communications export surface currently declared by its privacy lifecycle, including users, provider connections, call records and nested scores, audit evidence, notification preferences, delivery/campaign records, job reconciliation records, legal holds, and privacy-operation records.

This registration is **not** activation or production certification.

### urai-jobs

`urai-jobs` now has a versioned request/control-plane contract registered centrally.

- schema version: `1.0.0`
- source contract owner: `LifeLoggerAI/urai-jobs`
- current central status: `pending`
- reason: `REQUEST_CONTROL_PLANE_REGISTERED_EXPORT_DELETE_EXECUTION_HARD_OFF`
- registered request records: `dataRightsRequests` and request audit subcollections

Jobs currently proves authenticated export/deletion request intake, owner-scoped request readback, admin/operator listing, server-only request/audit records, and an explicit `HARD_OFF_PENDING_GOVERNED_WORKER` execution state.

This is deliberately **not** treated as an active export contributor. Export package generation, governed delete/anonymize execution, provider propagation, protected staging E2E, recovery evidence, legal/privacy review, and deployment/rollback receipts remain required.

## Other pending contributors

The following systems remain unregistered/pending and are not counted as complete:

- urai-spatial
- urai-studio
- urai-analytics
- urai-content
- asset-factory

## Completion meaning

`localComplete` means the registered local privacy source finished successfully.

`crossSystemComplete` must remain false while any required system is pending. A local export package must not be described as a complete ecosystem export.

## Promotion requirements

A pending contributor may become active only after it has:

1. a versioned data contract;
2. an authenticated service boundary;
3. deterministic pagination;
4. record counts and file hashes;
5. timeout and retry behavior;
6. an explicit failure result that prevents false completion;
7. staging and end-to-end evidence;
8. export, deletion, retention, and revocation mappings.

Communications has central source-contract registration but still requires runtime proof. Jobs currently has only a request/control-plane contract and remains hard-off for export/delete execution.
