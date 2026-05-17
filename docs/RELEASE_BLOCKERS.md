# Release Blockers

## Current status

Release verification pipeline is operational.

## Remaining blockers before real production deploy

### 1. Production Firebase project not yet verified
Severity: HIGH
Owner: deploy operator

The repository cannot determine whether the correct production Firebase project is selected. Human verification is still required.

### 2. Production environment variables not yet verified
Severity: HIGH
Owner: deploy operator

`.env.example` exists, but live production values must be configured in hosting/runtime.

### 3. npm audit advisories remain
Severity: MEDIUM
Owner: engineering

Current advisories require major-version upgrades for:

- next
- firebase
- firebase-admin
- undici

The release scripts currently report these findings but do not fail the build because upgrades may require coordinated migration work.

### 4. Firebase Functions dependency modernization
Severity: LOW
Owner: engineering

Firebase emulator warns that `firebase-functions` is outdated.

### 5. No integration tests implemented
Severity: LOW
Owner: engineering

Integration suite currently passes with `--passWithNoTests`.

## Exit criteria

A production release is GREEN only when:

- `npm run verify:release` passes.
- Production Firebase project is verified.
- Production env vars are verified.
- Smoke tests pass against deployed infrastructure.
- Rollback path is documented.
