# R1586+ Family Stories — canonical Privacy-to-Storytime wire compatibility, review-only (2026-11-19 Central / 2026-11-20 UTC)

**LAUNCH HOLD / NO-GO. PRIVATE MEMORY WRITES DISABLED.**

## Identity and scope
- Privacy draft implementation is additive and intentionally **not an issuer**: no canonical purpose registration, no signing keys, secrets, Firestore writes, HTTPS endpoints, IAM or provider requests.
- Base/source: `LifeLoggerAI/urai-privacy` #331 head `c00094d7e6f80367eccd5a69edf9203528f33cc2`, nested review branch `review/r1586-family-privacy-signed-wire-fixture-hold-20261119`.
- Executed Privacy Git HEAD: `8f79ade634a14fa31f8428e84b01f71cecec8d7e`, Git tree `197eefb12a4fe2896df7c364a6018437317fe6b4`.
- Independently consumed Storytime verifier exact code head `d3fe96f0b2d024e29f7acb32e0065e836fa41d61` from Storytime draft [#117](https://github.com/LifeLoggerAI/urai-storytime/pull/117). Its backend authenticates a story owner/recipient but family sharing remains disabled by default.
- Source files: `functions/src/family-story-share-wire-review.ts`, `tests/integration/r1586-family-story-privacy-wire-cross-repo.test.cjs`.

## Implemented reviewed candidate
Privacy-side **pure encoding contract** for a proposed `storytime.family_share` receipt. Validates exact known fields and encodes in fixed order as a domain-separated, explicit schema array. Storytime's independent `family-privacy-receipt-signature.js` computes identical bytes and verifies a pinned Ed25519 public key/issuer ID. The proposed review code calls the existing **canonical Privacy purpose registry** and explicitly returns `PURPOSE_UNREGISTERED`, so it cannot be treated as approved family consent. Should purpose later be approved, its review admission still returns `ISSUER_NOT_APPROVED` until separately authorized. No production sign API exists.

## Native test execution on existing Runpod worker
Existing pod `vxmo8gjblvsvxg`; Node v22.23.5; preserved frozen dependency graph; disposable local test keys generated only in the test. No cloud Firebase, IAM, audio/photo, personal records, provider, new pod or production service touched.

| Test step | Exact result | Original local output digest SHA256 |
| --- | --- | --- |
| `npm --prefix functions run build` | **EXIT 0 / PASS** | `782f5896cb1f991f190159123fe42093389b72b09546f53486886f3e3e11cd42` |
| `node --test tests/integration/r1586-family-story-privacy-wire-cross-repo.test.cjs`, with `STORYTIME_REVIEW_VERIFIER_PATH` set to exact Storytime compiled module | **20/20 PASS / EXIT 0** | `1326d3892ce42dc2ec3550154910205993d9008e2f1f1567f689e83a6cfc3a35` |
| Existing Privacy `npm run test:unit` | **207/207 PASS / EXIT 0** | `6dff4b583cd31b189277ecd30b4a1fc24b1302d5e825f1679c72cca328411e03` |
| `npm --prefix functions run typecheck` | **PASS / EXIT 0** | `7f293b5a2afa0d1f32c6c9ca33b9ccc721b9b4ae5c4056244685b0a730bf44d3` |

The 20 tests cover: purpose registry unregistered; **byte-for-byte canonical compatibility** independently produced in Privacy and Storytime; synthetic Ed25519 valid signature; missing trusted key and wrong key ID; signature tampering, wrong public key, and changes to owner, recipient, session, source version, consent epoch, approved content hash, expiry, policy purpose/version, decision, issuer and receipt ID; invalid subjects, negative epoch, malformed content hash; strict extra-field rejection.

The local Privacy test checkout is a complete detached Git fetch, with source commit/tree displayed before execution. Reused parent `node_modules` via links to the installed frozen dependency graph; no `npm ci` was executed on this new review copy. This is **not** an independent clean protected CI or staging deployment.

## Critical limitations and release dependencies
- **NO canonical family purpose approved**: current `functions/src/consent-decision.ts` rejects `storytime.family_share`. This review prototype deliberately **does not modify that registry**. User or legal consent not gathered.
- Synthetic test signer is inside the test and not an authorized Privacy signer/KMS service; binary compatibility is not a real Privacy→Storytime issuance or revocation-delivery integration.
- Existing `consent.revoked.v2` Privacy→Jobs transport and ACK does not mean family grants are revoked or signed. Need canonical owner-wide state checks, key issuance/custody, rotation, scope and concurrent deletion/revoke tests.
- **No new durable private memory read/write**; Storytime real-Auth family callables remain hard-off; no real family media or voice, storage IAM, protected CI, Vercel, host authenticated session or independent legal/security approval.
- Storytime's older broad `stories`/ `storyRuns` Firestore family-role policy, pending secure media broker/voiceover purpose, Jobs narrator generation-bound deletion, 38 inherited Storytime aggregate failures and live GCS IAM still require independent remediation.

## Handoff
- Review owner issue: [Privacy #334](https://github.com/LifeLoggerAI/urai-privacy/issues/334).
- Existing downstream draft: [Storytime #117](https://github.com/LifeLoggerAI/urai-storytime/pull/117).
- Before any live enablement: independent Privacy/legal explicit family-purpose consent tier and guardian/minor/third-party rights; ratified wire contract with source-scoped signed issuer/KMS and real current-consent checks; exact-source *native multi-service* grant/revoke/deletion integration; independent Cloud IAM/hosted, accessibility and security acceptance. Only then consider nonproduction staging with private data still protected.
- **PRODUCTION HOLD / NO-GO. PRIVATE-MEMORY WRITES OFF.**
