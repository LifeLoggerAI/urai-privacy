# Export Contributor Registry

Registry version: `1.0.0`

Status: implemented, not deployed.

The registry is defined in `functions/src/export-contributor-registry.ts`.

## Active contributor

`urai-privacy-firestore` is the only active contributor. It covers the user profile and the user-scoped privacy collections listed by the local export contract.

## Pending contributors

The following systems are recorded as pending and are not counted as complete:

- urai-spatial
- urai-studio
- urai-analytics
- urai-content
- urai-jobs
- asset-factory
- urai-communications

Each pending entry uses the reason `CONTRIBUTOR_NOT_INTEGRATED`.

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
