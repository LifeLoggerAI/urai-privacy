# Export download consent fence

Date: 2026-10-07
Owner: URAI Privacy
Status: source repair; live release evidence remains required.

## Runtime authority

`getExportDownloadUrl` now returns an authenticated `downloadExportPackage` endpoint and `requiresAuthorization: true`. Consumers must send a current Firebase ID token in the `Authorization: Bearer` header. The Privacy Center downloads the response through the configured project's exact HTTPS endpoint and saves a local Blob. It never forwards authentication to another host, follows a redirect, or opens a bearer link in a new window.

Both descriptor creation and actual delivery require a completed owner-bound request/job, current `data.export` consent with the current policy and C7 tier, the same canonical receipt/deadline used for publication, no active deletion fence, and an unexpired package. Delivery checks Auth token revocation and commits an audit event before streaming. Every subsequent chunk (at most 64KiB) rereads current authentication, receipt, consent, deletion fence and deadline before emitting bytes; denial destroys the stream. Already delivered bytes cannot be recalled. Withdrawal, receipt replacement, expiry, or deletion invalidates previously returned descriptors. No new Cloud Storage signed URL is minted: signed URLs bypass Storage Rules and cannot provide this per-request withdrawal check.

Storage Rules read at most two unique Firestore documents: the export job and existing `privacyDeletionTombstones/{uid}` subject fence. `setCanonicalConsent` atomically writes the canonical record, events/audit, and a minimal `data.export` receipt projection in that fence. The export claim also derives this projection from the canonical record in the same transaction. Clients cannot write the projection. It is a denial check bound to the canonical receipt, not another source of consent authority.

Export attempts continue to use their unique publication paths, attempt ledger, live receipt fence, package lifecycle, and deletion orchestration. This repair does not admit private ingestion, provider work, or production deployment.

## Compatibility and deployment

Completed legacy jobs without an exact consent receipt/deadline binding fail closed. Users must grant current export consent and request a new export. Never infer a grant or rewrite a historical receipt to make a legacy package readable.

Any other consumer of `getExportDownloadUrl` must adopt authenticated HTTP delivery before deploying this source. Deploy the callable, HTTP endpoint, canonical consent writer, export publisher, and Storage Rules as one reviewed release. Earlier signed URLs issued by older deployed source remain subject to their existing expiry and object deletion; this source cannot retrospectively revoke those capabilities. Live signoff must account for that transition window and prove the new transport before reporting revocation ready.

## Verification

Behavioral tests exercise the actual Functions handler with SDK boundaries injected: current owner delivery; cross-user/anonymous/revoked-session denial; missing, revoked, expired, malformed, replaced, or inherited-purpose consent denial; deletion fences; receipt races; and audit failure before admission. Client transport tests exercise exact project binding and HTTP failures. Existing deletion, unique attempt, cleanup, and export inventory tests remain required.

The loaded Firebase emulator suite includes a synthetic Auth signup, actual canonical grant, direct Storage read, descriptor issuance, authenticated HTTP body, anonymous denial, actual canonical withdrawal, then owner/admin Storage denial and denial of the earlier descriptor. It requires the loaded Functions emulator and cannot be replaced by static inspection.

Local Java 21 successfully loads Auth, Firestore, Storage and the actual function definitions. This workspace denies the Functions child's Unix socket (`listen EPERM /tmp/fire_emu_*.sock`), blocking the local loaded suite before its assertions. Exact-source hosted CI remains the authority for that suite; neither the runtime nor loader assertion is bypassed. No production-ready or Golden Master claim follows from local unit/build success.
