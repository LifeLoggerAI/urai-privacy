# Export Contributor Registry

Registry version: `1.8.0`

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

### urai-spatial

urai-spatial now has source-level operational export/deletion authority across its current user-owned runtime graph, including core memories, Life Model/person-world state, Captured Reality bindings, spatial/passive state, Possible Futures Scenario trees, and the AI activity ledger. The central registry includes nested Scenario basis/branch/comparison/outcome/calibration collections instead of treating only top-level Scenario documents as portable.

Spatial remains pending. Source implementation and exact-head CI do not substitute for protected-staging export artifact readback, scoped deletion execution, recovery/rollback evidence, and central orchestration proof.

### urai-studio

`urai-studio` now has a green exact-head governed data-rights successor.

- schema version: `data-rights-v1`
- source contract owner: `LifeLoggerAI/urai-studio` PR #138
- export scope includes the owner profile plus Studio projects/scenes/assets/jobs/collections/scrolls/scripts/subtitles/voiceover/export/audit/XR/VR and tenant-runtime records
- source lifecycle includes private checksum-bound export packages, owner request readback, a bounded restore/cancel window, admin legal-hold guard, verified deletion backup, admin-only purge execution, immutable purge receipt, and server-only control-plane collections
- Firebase Auth deletion remains owned by central Privacy
- current central status: `pending`
- reason: `SOURCE_DATA_RIGHTS_LIFECYCLE_IMPLEMENTED_PROTECTED_STAGING_E2E_REQUIRED`

This is **source-lifecycle completion, not production deletion certification**. Protected staging execution, private artifact readback, rollback/recovery evidence, central orchestration, and production authorization remain required before activation.

### urai-analytics

`urai-analytics` now has a green exact-head data-rights successor with owner-scoped export/delete over its declared collections, deterministic export/deletion checksums, exact-snapshot confirmation, allowlisted deletion, legal-hold fail-closed behavior, post-delete verification, and explicit service scopes. The central registry therefore records the source lifecycle as implemented while keeping Analytics pending until protected staging/live execution, central orchestration, and production-lock evidence exist.

### urai-content

`urai-content` now has a versioned source/lifecycle contract registered centrally from the exact green Content successor.

- schema version: `1.0.0`
- source contract owner: `LifeLoggerAI/urai-content`
- registered collections: `contentItems`, `contentVersions`, `moderationQueue`, `publishingReleases`, `telemetryEvents`, `userContentEntitlements`, `narratorPrompts`, `storyTemplates`, `ritualTemplates`, `marketplaceItems`, `creatorSubmissions`, `exportTemplates`
- deletion lifecycle source: bounded tombstone/restore window, verified backup receipt, provider-deletion receipts, purge readiness, immutable purge receipt
- current central status: `pending`
- reason: `SOURCE_LIFECYCLE_REGISTERED_PROTECTED_STAGING_E2E_REQUIRED`

This is **not** a claim that a deployed cross-system Content deletion worker, provider propagation callback, or protected staging purge run has completed. Those runtime receipts remain required before activation.

### urai-jobs

`urai-jobs` now has a versioned request/control-plane contract plus a source-implemented governed executor.

- schema version: `1.0.0`
- source contract owner: `LifeLoggerAI/urai-jobs` PR #139
- current central status: `pending`
- reason: `SOURCE_GOVERNED_EXECUTOR_IMPLEMENTED_PROTECTED_STAGING_E2E_REQUIRED`
- registered control-plane/runtime scope: `dataRightsRequests`, request audit, `users`, `jobs`, `jobs/{jobId}/logs`, and `jobQueue`

The executor is admin/operator-only, requires an explicitly APPROVED request plus retention decision receipt, is admitted only to one exact protected-staging project, rejects production authorization, generates bounded private GCS export artifacts, applies bounded Jobs-scope deletion/anonymization, records retryable execution receipts, and never marks the ecosystem request globally complete.

This remains **pending**, not active. Protected-staging E2E, artifact readback, central Privacy orchestration/final completion, provider-side propagation where applicable, recovery evidence, legal/privacy review, and deployment/rollback receipts are still required.

### asset-factory

`asset-factory` now has a versioned source/control-plane contract registered centrally.

- schema version: `1.0.0`
- source contract owner: `LifeLoggerAI/asset-factory`
- export collections: `assetFactoryJobs`, `assetFactoryAssets`, `assetFactoryUsage`
- deletion boundary: authenticated tenant-admin request recorded as `account.deletion_requested`
- current central status: `pending`
- reason: `EXPORT_REGISTERED_DELETE_REQUEST_ONLY_PROTECTED_STAGING_E2E_REQUIRED`

Asset Factory's protected account export is real and tenant-scoped. Its deletion route records a request for operator review and intentionally does not destroy tenant data automatically. It therefore remains pending until governed destructive execution, retention/legal checks, and protected staging E2E evidence exist.

This registration is **not** destructive-delete certification.

## Other pending contributors

The following systems remain unregistered/pending and are not counted as complete:


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

Communications has central source-contract registration but still requires runtime proof. Jobs has a governed protected-staging executor in source but remains inactive until exact staging and central-Privacy orchestration evidence exist.
