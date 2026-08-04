# URAI Consent Decision Service

Status: IMPLEMENTED BUT NOT DEPLOYED

Policy version: `1.0.0`

## Authority

`functions/src/consent-policy.ts` is the canonical purpose and decision policy for the `urai-privacy` service.

The deployed callable surface is assembled by `functions/src/exports.ts`. The legacy unversioned consent writer in `functions/src/index.ts` is intentionally not exported by that surface.

## Registered purposes

- `audio_transcription` — C3 — maximum grant duration 365 days
- `gps_context` — C2 — maximum grant duration 180 days
- `ai_insights` — C4 — maximum grant duration 180 days
- `deidentified_analytics` — C5 — maximum grant duration 365 days
- `data_monetization` — C8 — maximum grant duration 90 days

An unknown purpose or mismatched tier is denied. Adding a purpose requires a reviewed registry change, policy-version decision, tests, retention mapping, export/deletion mapping, and downstream adoption evidence.

## Callable contracts

### `getConsentPurposeRegistry`

Requires Firebase Authentication. Returns the active policy version and registered purposes used by the Privacy Center UI.

### `updateConsent`

Requires Firebase Authentication and owner authority. It:

- validates the purpose against the registry;
- enforces the exact registered tier;
- records `granted`, `denied`, or `revoked` state;
- assigns an expiry to every grant;
- writes the current consent record;
- appends an immutable consent event;
- records a receipt hash and audit event.

A policy-version change invalidates older grants until the user re-consents under the current policy.

### `evaluateConsent`

Requires Firebase Authentication. A user may evaluate only their own consent. Trusted `admin` or `system` custom claims may evaluate a named subject.

Every request supplies:

- subject UID when the caller is a trusted service or administrator;
- registered purpose;
- exact requested tier;
- consuming service;
- action;
- optional context identifier, stored only as a hash.

The result is fail-closed. It returns `allowed=false` unless the record has the correct owner, purpose, tier, current policy version, granted status, receipt hash, and unexpired grant. Every allow or deny is appended to `consentDecisions` and written to the audit log.

## Consumer enforcement rule

A consuming service must obtain an `allowed=true` decision immediately before the governed processing operation. Storing consent preferences or calling this service without enforcing the returned decision does not satisfy the contract.

Consumers must retain the decision ID with their processing receipt. They must not cache an allow result past the returned expiry, across policy-version changes, or after a revocation event.

## Firestore boundary

Clients may read their own `consentRecords`, `consentEvents`, and `consentDecisions`. Clients cannot create, update, or delete those records directly. Trusted server functions are the only mutation path.

## Verification

Repository checks:

```bash
npm run test:unit
npm run test:rules:static
npm run test:emulators
npm --prefix functions run typecheck
npm --prefix functions run build
```

Key tests:

- `tests/unit/consent-policy.test.ts`
- `tests/rules/firestore.rules.test.ts`

## Remaining blockers

- Exact-head CI and emulator-backed verification are queued.
- No staging or production function deployment has been performed.
- No downstream URAI service is yet certified as enforcing the decision before processing.
- Revocation propagation, retention execution, complete cross-system export, complete deletion propagation, and provider-deletion receipts remain separate work.
- App Check, service-specific rate limits, and authenticated live evidence remain required before production certification.
