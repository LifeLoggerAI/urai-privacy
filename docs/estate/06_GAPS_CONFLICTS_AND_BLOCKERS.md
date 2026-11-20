# Release-critical gaps, contradictions and resolution tests

**Verified snapshot:** 2026-11-07. Privacy main 1163d6f32a123ef9a6638e092a3eee5ec4a3b317; review #236 5daa194148c1f0b157062ca09b8f1b6e629d6d29. All claims in this pack are SOURCE-REVIEW or explicitly labeled historical test receipts. None authorizes production, private media access, consent issuance, or deployment.

P0-1 **Positive consent and authentic issuer:** general UI deliberately blocks Life Movie grants. Approved owner authentication, reviewed notice/selection/source rights, trusted tenant and atomic server grant issuance, real signed/attested authority and approved deploy are missing. SHA256 matching alone is NOT cryptographic signature.

P0-2 **Actual private media boundary:** independent effective GCS bucket IAM and broker-only writer, reject historical privileged Admin SDK identities, deny stale signed URLs after withdrawal, abort/expire in-flight uploads, prove object generation-bound deletion, late-write/recreation denial, protect Studio→Jobs→Replay read/delivery for exactly owner. Firestore/Storage client rules cannot substitute for GCS IAM.

P0-3 **Revocation:** outbox and dispatcher source exists but dispatcher is not exported, scheduled or deployed; after actual revoke require Jobs ACK and every stage/lease/segment/output/Replay access revalidation, stale consent ABA protections, retry/idempotency and user-visible failure handling in actual services.

P0-4 **Global deletion:** 8 registered external contributors pending and no signed subject-scoped downstream ACK verifier. Privacy-local zero residual must not produce ecosystem deletion completion. RuAi disposition and Analytics retraction need independent proof. Keep fail-closed 'verified:false' behavior.

P0-5 **Current full source acceptance:** R841 combined original 14+ gate runner requires clean Privacy 5daa194148c1f0b157062ca09b8f1b6e629d6d29 and Jobs ea8f0165ac74511a4e4196919ddd3109d0c1ff2e, Node22/pnpm8.15.9/Java21, pristine credentials, available 7 fixed localhost ports, Unix socket support and all four Firebase services; the current host refused port 8080 EADDRINUSE. No current full acceptance was performed here.

P0-6 **Protected CI, deploy and devices:** five Actions workflows reported failure with empty job steps, admission cause unknown; no verified deployed source hash, provider revision, signed production IAM/owner/grants, independent human security review, browser/physical device accessibility acceptance, rollback exercise or founder GO. Credential or billing changes require separate authority.

Source conflict A: docs/RELEASE_BLOCKERS.md states 'No integration tests implemented', but R841 tree has life-movie integration tests; old document stale, not current truth. Source conflict B: docs/LIFE_MOVIE_RENDER_CONSENT_INTEGRATION.md initially says owner should grant via generic Privacy Center, but its later addenda and current consent-api/page explicitly deny unscoped grants; latest source wins. Source conflict C: past 23/23 synthetic pass vs Nov 5 R583 four-service EXIT 1; different source/host receipts, neither proves R841 or production.

Security note: export-lifecycle-functions.ts checks owner and package expiry before minting a GCS signed read URL; it does not demonstrate live invalidation of already-issued URLs on revocation. No bug exploitation or private data probe was performed. Reserve this as unclosed provider-security test, not ungrounded allegation of data leak.
