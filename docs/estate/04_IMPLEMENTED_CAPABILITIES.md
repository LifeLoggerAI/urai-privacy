# Security control matrix — implementation vs proven enforcement

**Verified snapshot:** 2026-11-07. Privacy main 1163d6f32a123ef9a6638e092a3eee5ec4a3b317; review #236 5daa194148c1f0b157062ca09b8f1b6e629d6d29. All claims in this pack are SOURCE-REVIEW or explicitly labeled historical test receipts. None authorizes production, private media access, consent issuance, or deployment.

| Control | Source path / Git blob SHA-1 (R841) | Trust assumption and current evidence | Status / missing proof |
|---|---|---|---|
| Owner/client gate | components/AuthGate.tsx fbec956; components/AdminGate.tsx 36ad3f4 | Browser Firebase claims refresh, server must enforce separately | Source verified; physical browser denied access not rerun |
| Firestore client owner isolation | firestore.rules 0d3b73a; tests/rules/firestore.rules.test.ts f0d750c | Verified Firebase Auth UID and signed admin claims; deny writes by clients | Source reviewed; earlier emulator suites historical only; live deployment unknown |
| Storage export scope | storage.rules 3e25a6f; tests/rules/storage.rules.test.ts 8f72d9e | Owner/admin and valid completed unexpired export; deletion fence | Source reviewed; client-rules tests available, real GCS signed-link invalidation unknown |
| Cross-user callable | functions/src/consent-api.ts 43da4d4; cross-user-authority.ts 443097b | onCall-verified token, own claim fields, audit; admin/system exceptions intentional | Source verified, cross-project IAM/issuer needs acceptance |
| Canonical C1-C8 consent | consent-decision.ts 35c699b; consent-api.ts 43da4d4 | Deny missing/wrong policy/tier/expiry/revoked; owner UID from call | Source verified, live authentic positive owner workflow unproved |
| Movie-scoped C6 refusal | consent-api.ts 43da4d4; app/privacy-center/consent/page.tsx 3757798 | General grant must deny; review-only candidate cannot authorize | Source verified fail-closed; approved positive issuer absent |
| Movie integrity/selection | life-movie-scoped-receipt.ts b22ce33; life-movie-render-authorization.ts e09564b | Exact subject, tenant, project, plan and source digest; hash not signer | Source verified; rights, signed issuance and provider IAM missing |
| Jobs service principal | life-movie-jobs-identity.ts 78f3cfe; consent-api.ts 43da4d4 | Pinned UID, verified Firebase bearer and checkRevoked=true | Source verified; real workload provisioning unproved |
| Revocation event/outbox | consent-revocation.ts 5b069b7; consent-revocation-transition.ts 0b5d17e | Firestore trigger and duplicate idempotency; verified token consumer | Source verified; actual delivery/ACK not certified |
| Dispatch/retry/ABA | consent-revocation-jobs-dispatcher.ts 4126167 | Transaction lease, immutable event, Firestore updateTime, remote ACK | Prepared library only, not exported/scheduled/deployed |
| Deletion tombstone/planning lease | life-movie-deletion-fence.ts e08751e; firestore/storage rules | Missing/malformed present lease never treated clear | Source verified; staging race tests pending |
| Deletion completion | deletion-contract.ts 1a9ffd5; deletion-mutation-guard.ts 45746fa | 3 local active, 8 external pending; local-zero residual insufficient | Global completion deliberately blocked until verified ACKs |
| Exports/download URLs | export-lifecycle-functions.ts 70ba1ce | Owner/admin+expiry+scoped path, short-lived GCS URL | Source verified; post-revocation provider-level 403 missing |
| Audit events | consent-api.ts 43da4d4; index.ts 13ba253 | Server-generated hashes, write-restricted client collections | Source verified; privileged service/IAM retention integrity audit pending |
| Native acceptance | run-r818-native-jobs-privacy-acceptance.sh a4ca794 | Exact clean source pins, credential veto, bounded tests | R841 full execution blocked; local preflight 5/5 |

No row is production_verified. For each source link, use https://github.com/LifeLoggerAI/urai-privacy/blob/5daa194148c1f0b157062ca09b8f1b6e629d6d29/<path>. These are abbreviated blob prefixes; full Git blob IDs are in MANIFEST.json.
