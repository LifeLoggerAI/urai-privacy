# URAI Consent Decision Service

Status: IMPLEMENTED BUT NOT DEPLOYED

Policy version: `1.0.0`

## Authority

`functions/src/consent-decision.ts` is the single canonical purpose registry and fail-closed decision policy for the `urai-privacy` service.

`functions/src/consent-api.ts` is the single canonical callable implementation. Firebase deploys `lib/functions-entry.js`, built from `functions/src/functions-entry.ts`. The compatibility files `consent-functions.ts` and `exports.ts` contain delegation only and must never define a second registry, storage model, authorization rule, or audit path.

## Registered purposes

- `memory.storage` — C1
- `behavior.passive-context` — C2
- `location.context` — C3
- `inference.sensitive` — C4
- `biometric.identity` — C5
- `ai.personalization` — C6
- `data.export` — C7
- `data.monetization.anonymized` — C8

An unknown purpose is denied. Adding or renaming a purpose requires a reviewed registry and policy-version change, tests, retention mapping, export/deletion mapping, and downstream adoption evidence.

## Callable contracts

### `setCanonicalConsent`

Requires Firebase Authentication and owner authority. It validates the purpose against the canonical registry, records `granted`, `denied`, or `revoked` state, writes the canonical record, appends an immutable event, and commits the audit record in the same Firestore transaction. A failed transaction reports no successful consent mutation.

### `evaluateCanonicalConsent`

Requires Firebase Authentication. A user may evaluate only their own consent. An administrator may evaluate a named subject. A system principal may evaluate another subject only when its token carries a validated, explicit `consumerId`; a generic `system: true` or `role: system` token without that binding is denied.

Every request supplies a registered purpose and correlation identifier. Every allow or deny creates a scoped `dataAccessEvents` record containing the actor, subject, consumer binding when present, purpose, decision, reason, policy version, and integrity hash.

The result is fail-closed. Missing records, stale policy versions, denied or revoked state, tier mismatch, expiry, and invalid status all deny processing.

## Consumer enforcement rule

A consuming service must obtain an `allowed=true` decision immediately before the governed processing operation. Storing a preference or calling this service without enforcing the returned decision does not satisfy the contract.

Consumers must retain the decision event ID with their processing receipt. They must not cache an allow result across policy changes, expiry, or revocation.

## Firestore boundary

Clients may read only records allowed by the reviewed Firestore rules. Clients cannot create, update, or delete canonical consent authority directly. Trusted server functions are the only mutation path.

## Verification

Repository checks include:

```bash
npm run test:unit
npm run test:rules:static
npm run test:export:contract
npm run test:emulators
npm --prefix functions run typecheck
npm --prefix functions run build
```

The export contract gate verifies the actual deployed `functions-entry.ts` surface, rejects alternate active consent/export authorities, requires consumer-bound cross-user evaluation, requires atomic consent audit commitment, and verifies revocation acknowledgement plus stale export-lease recovery behavior.

## Remaining blockers

- The focused source repair requires fresh exact-head CI and artifact inspection.
- The consumed Privacy parent is divergent from current `main` and must be reconstructed without losing later protections.
- No staging or production function deployment has been performed.
- Separate genuine privacy/security and authorized legal/privacy approvals remain required.
- Protected authenticated consent/export/deletion, denial, failure, recovery, monitoring, residual scan, downstream acknowledgement, and rollback evidence remain mandatory before production certification.
