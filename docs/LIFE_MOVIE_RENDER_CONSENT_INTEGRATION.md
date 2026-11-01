# Life Movie private rendering: canonical consent contract (draft / NO-GO)

Source parent: Privacy main `1163d6f32a123ef9a6638e092a3eee5ec4a3b317`.
Companion: Jobs draft PR #231, head `bbe74393d6defbf7352c59894325546f176708f8`.

## Scope

The canonical Privacy runtime registry is `functions/src/consent-decision.ts` (not the legacy `consent-policy.ts`). This draft registers the distinct purpose `life-movie.render`, tier C6, purpose-specific policy `1.1.0`. Existing purpose policy `1.0.0` remains unchanged. C6 is for explicitly selected private media rendering; it is not a substitute for independent biometric, sensitive inference, source/rights, or third-party consent where applicable. A general memory-storage or AI-personalization grant cannot authorize Life Movie rendering.

A user must explicitly grant `life-movie.render` in the Privacy Center through `setCanonicalConsent`. The canonical transaction commits record, event and audit. No backfilling or migration automatically grants it.

## Current decision

`verifyLifeMovieRenderConsent` is a new Firebase callable, exported in `functions-entry.ts` but **not deployed here**. Require a Firebase-authenticated system caller with the Jobs-dedicated `consumerId=urai-jobs`; client/user identities, generic system tokens, and other consumers must fail. This is an intermediate source contract, NOT a complete secure workload-identity integration. The claim's trust provenance, service-credential issuance and endpoint authorization must be independently verified against hosted IAM before use.

Request:
```json
{"subjectUid":"owner-uid","tenantId":"tenant-id","correlationId":"render-operation-id","decisionReceiptId":"64-character-lowercase-SHA256-receipt-hash","policyVersion":"1.1.0"}
```
The expected receipt hash is only a comparison value, never authority. The verifier transaction re-reads the canonical `consentRecords/{uid}_life-movie_render` document plus deletion tombstone, validates the subject, exact purpose, tier, policy, current grant, expiry and receipt hash, and appends a decision audit event. It returns an allow only when all conditions match; an allow is point-in-time, not a durable token. Jobs must also check tenant and source ownership independently. Provider authentication failure and network failure deny by default.

Every create, queue lease, dispatch, segment, assembly, resume, download, playback, and delivery mint must recheck current grants as appropriate, with hard cancellation on revocation or invalidated ownership. No signed URL should outlive revoked authorization; storage/CDN/versioned-object backup and already-issued-link invalidation require separate review.

## Integration state

- **Privacy source only**: purpose, owner opt-in display, Jobs-only decision endpoint, policy tests. These are proposed changes requiring review, not a deployed consent service.
- **Jobs**: intentionally unchanged. PR #231 retains `lifeMovieConsentAuthorityAvailable() === false`; the bridge, dispatcher, and Studio worker must remain hard-closed. Existing Jobs caller-supplied `decisionReceiptId` strings are arbitrary; consumers must change to an exact canonical receipt hash and use independently authenticated trusted service verification before rendering.
- **Studio**: separate source, media generation, source ownership and worker life-cycle enforcement still need integration.
- **Spatial**: existing read-only Life Movie manifest is not hosted FFmpeg render authority. Do not connect its client UI to the worker as a shortcut.

## Still required

1. Security review of source-bound identity, claim issuers, cross-project Firebase auth, tenant binding, replay/TOCTOU/latency, and disabled-path ordering.
2. Update Jobs PR #231 without replacing it: service-to-service client, exact decision-event audit linkage, per-boundary verification, latest grant/revocation checks, and hard closed network errors. Integrate Studio worker + protected delivery. No environment switch granting authority.
3. Test authenticated owner, nonowner, spoofed system, mismatched consumer, tampered or stale receipt hash, purpose/tier/policy mismatch, deleted subject, revoked while leased/in-flight, stale object generation, source removed/replaced, retry idempotency, storage cleanup, and signed-link invalidation.
4. Run Privacy unit/build/typecheck, Jobs locked builds and existing 19 owner/deletion/race + 34 emulator cases, plus new three-repo end-to-end provider tests and exact-SHA CI.
5. Obtain independent human privacy/security/release review, provider IAM/Storage/retention/deletion evidence, protected hosted staging playback and rollback proof. GitHub Actions billing runner-admission incident may prevent hosted CI.
6. Complete privacy notice, duration, retention, export/delete registry and legal/privacy review before enabling an opt-in in hosted environments.

**Release: NO-GO. No deployment, merge, runtime enablement, user grants, or hosted playback is claimed.**


## R307 child: selection-scoped consent admission fence (proposed / not deployed)

The prior purpose-wide Privacy Center Grant action could issue an ordinary `life-movie.render` receipt without identifying any movie or immutable selected source set. That is incompatible with the owner's selection-scoped consent terms. This child draft deliberately prevents that unscoped grant action in both server `setCanonicalConsent` and the Privacy Center UI; Deny/Revoke remain reachable.

The proposed `verifyLifeMovieRenderConsent` request now requires `renderScope: { projectId, renderPlanDigest, sourceSetDigest }`. Its transaction requires an own-field exact match with `record.renderScope`, in addition to existing current grant / receipt / subject / tier / policy / expiry / tombstone checks. Old unscoped records are denied with `RENDER_SCOPE_MISMATCH`. **The current general-purpose grant writer does not issue any scoped Life Movie grant; therefore there is no new positive render authorization path and the verifier remains incapable of allowing one from this UI.**

This is a deliberate interim safety fence, **not** a completed UX or end-to-end integration. Jobs #232 still supplies only a receipt reference and is not yet updated to send the new `renderScope` request; Studio, Jobs, and Privacy must agree on how `sourceSetDigest` is computed from ordered, immutable bucket/object generation selections and how the trusted verifier recomputes it. Future scoped issuer must commit this scope into the canonical signed/hashed grant receipt and corresponding user-visible reviewed notice; a loose Firestore field or caller-controlled scope is insufficient. Authenticate the exact Jobs workload and tenant/source rights independently. Retest grant, revocation, old receipt, owner switching, altered source generation, chosen movie scope, expiry, delivery, and replay under protected staging before any enabling change.

**GO/NO-GO: NO-GO.** No production changes, grants, deploys, or user material processed by this child draft.


## R307 child: receipt must commit tenant and exact source selection (draft, fail-closed)

The proposed scope fence in Privacy #183 initially compared a loose `record.renderScope` against a request and separately compared `record.receiptHash`. That did not prove the stored receipt committed the tenant, movie, render-plan digest and immutable source-set digest together.

`functions/src/life-movie-scoped-receipt.ts` defines `hashLifeMovieScopedReceipt` and `verifiesLifeMovieScopedReceipt` for a single versioned, exact-order record covering subject UID, tenant, purpose/tier/status/policy, expiry, surface, jurisdiction, notice hashes, evidence hash, selected render scope and issuance timestamp. The Jobs-only verifier in `consent-api.ts` denies unless the complete stored record produces the same SHA-256 receipt hash, the exact request scope matches, and existing grant/expiry/deletion checks pass. This makes independently edited scope or tenant fields fail the check, not grant permission. Regression cases cover altered source selection, movie, tenant, notice, expiry, missing scope and mismatched hashes.

**Crucial:** SHA-256 here is an internal consistency hash, **not a digital signature, bearer credential, proof of user intention, or source-rights authority**. A party with arbitrary write access to `consentRecords` could potentially recompute the hash. The security boundary must depend on trusted, reviewable server-side grant issuance, Firestore/IAM restrictions, audit immutability and service identities. **There is still no scoped grant issuer.** Ordinary `setCanonicalConsent` continues to deny all purpose-wide Life Movie grants, old records lack required scope/tenant and must deny, and Jobs/Studio remain hard closed.

Before approval: independent privacy review of the actual consent text, per-film notice and cancellation UX; server-verified source rights, immutable bucket/object generation, plan digest, tenant affiliation, authenticated Jobs workload; grant transaction writing the exact same receipt schema; revocation race and deletion tests; full hosted exact-SHA checks and independent deployment approval. No code in this child permits a live render.
