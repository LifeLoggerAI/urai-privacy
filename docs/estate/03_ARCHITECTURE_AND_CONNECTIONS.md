# Security architecture and cross-system trust edges

**Verified snapshot:** 2026-11-07. Privacy main 1163d6f32a123ef9a6638e092a3eee5ec4a3b317; review #236 5daa194148c1f0b157062ca09b8f1b6e629d6d29. All claims in this pack are SOURCE-REVIEW or explicitly labeled historical test receipts. None authorizes production, private media access, consent issuance, or deployment.

## Boundaries by enforcement tier
Browser: components/AuthGate.tsx (Firebase login; admin custom claims), components/AdminGate.tsx and app/admin/layout.tsx; app/privacy-center/consent/page.tsx deliberately hides the Life Movie grant action while allowing deny/revoke. src/lib/firebase-privacy-client.ts dispatches Firebase callables and UID-filtered subscriptions. Client checks are usability, **not** security authority.

API/Functions: functions/src/functions-entry.ts exports canonical consent, verification, revocation, export/deletion. functions/src/consent-api.ts derives caller UID from authenticated onCall; setCanonicalConsent writes transactionally with tombstone check; evaluateCanonicalConsent rejects unscoped life-movie.render. verifyLifeMovieRenderConsent requires exact Jobs custom-claims/pinned UID and Admin SDK checkRevoked=true, then checks subject/tenant/receipt/scope and deletion state in transaction. A decision is point-in-time, not a reusable bearer capability.

Firestore: firestore.rules denies direct client writes to grants, audit, export/deletion jobs and outbox; owner/admin read; catches unknown paths, blocks profile privilege changes and stale deletion planning. Storage: storage.rules denies arbitrary client media paths, limits export package/manifest reads to owner/admin, completed/unexpired package, inactive deletion fence; does not provide private Studio/Replay media IAM. Firebase Admin SDK and GCS signed URLs are separate provider access boundaries, not constrained by client Security Rules.

Consent lifecycle: functions/src/consent-decision.ts purpose/tier/version/expiry; functions/src/life-movie-scoped-receipt.ts binds UID+tenant+movie plan and immutable sourceSet digests by SHA256 **integrity**, not signature; functions/src/life-movie-render-authorization.ts rejects review-only/prod-authorized marker-bearing candidates, deleted/revoked/expired, forged or mismatched scope. functions/src/life-movie-scoped-grant-assembler.ts and issuer-review.ts are source-only review candidates, not exported or approved issuance.

Revocation/deletion: functions/src/consent-revocation.ts writes idempotent outbox and immutable consumer ACK; functions/src/consent-revocation-jobs-dispatcher.ts is NOT exported/scheduled/deployed, although it has lease, retry, ABA updateTime checks and canonical consent revalidation. functions/src/deletion-contract.ts has three active local adapters and eight pending cross-system consumers; deletion-mutation-guard.ts blocks false global completion even when local residual scan is clear.

Exports: functions/src/export-lifecycle-functions.ts requires owner/admin, completion, expiry and exact path before a short-lived GCS signed URL; enforce old signed-link revocation at **real provider boundary** as a separate P0, since signed URLs may bypass Firebase rules.

## Cross-repo trust edges — verified code versus missing runtime
Privacy -> Jobs: exact pin ea8f0165ac74511a4e4196919ddd3109d0c1ff2e in scripts/run-r818-native-jobs-privacy-acceptance.sh; synthetic four-emulator acceptance exists at earlier Privacy/Jobs pair; current R841 fresh native end-to-end pending. Jobs must verify source ownership/generations, service identity, expiry and revocation for every sensitive stage.
Privacy -> Studio: Studio movie project/source selection and render-plan/source-set digest agreement needs trusted server-side verifier; source proposed but no signed positive production transaction proven.
Jobs -> Storage -> Spatial Replay: protected sole-writer GCS IAM, generation-checked deletion, no stale writers/URLs, private MP4/SRT authenticated playback and device exercise NOT demonstrated.
Deletion -> Spatial/Studio/Analytics/Content/Jobs/Factory/Communications/RuAi: eight pending adapters and subject-scoped downstream acknowledgment receipts. RuAi consumer-to-B2B data-linkage disposition is explicitly pending; no automatic sharing authority.
Provider mappings: firebase.json config shows region us-central1 and Node22, emulator demo project; repository config is NOT evidence of actual deployed project/region/IAM.
