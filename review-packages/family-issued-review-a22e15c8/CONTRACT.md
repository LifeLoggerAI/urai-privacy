# Isolated Family Stories issuer and delivery candidate

Review-only implementation proposal, exercised only in disposable local Firebase emulators. Not canonical purpose approval, a real signer, production IAM, or a deployed integration. Ordinary Privacy entrypoints and registry stay unchanged. Storytime #120 runtime stays unchanged. No real media or permissions.

## Fixed isolation

- Project: `demo-urai-family-issued-review`
- Auth `127.0.0.1:30099`; Firestore `127.0.0.1:30080`; Storage `127.0.0.1:30199`; Functions `127.0.0.1:30001`
- Activation: `FAMILY_ISSUED_REVIEW_ENABLED=synthetic-only-v1`
- Policy fixture: `FAMILY_ISSUED_REVIEW_POLICY=synthetic-explicit-text-consent-v1`
- Private signer file: `FAMILY_ISSUED_REVIEW_PRIVATE_KEY_FILE` (ephemeral, never logged).
- Existing public pin variables: `STORYTIME_FAMILY_PRIVACY_ED25519_KEY_ID` and `STORYTIME_FAMILY_PRIVACY_ED25519_PUBLIC_KEY_SPKI_B64`.
- Delivery actor: exact UID `synthetic-family-privacy-delivery`, current custom claim `familyReviewDelivery=true`, verified email and enabled account. Verify bearer with checkRevoked, current account and bearer again. No ordinary owner or relative may deliver.
- Audience: `urai-storytime-review`; fixed consumer URL `http://127.0.0.1:30001/demo-urai-family-issued-review/us-central1/reviewAcceptFamilyEvent`.

Callables reject before writes unless exact demo project, all loopback emulator hosts, activation and policy fixture match. Export only from isolated fixture, not ordinary Functions entry files. Auth UID is derived from verified context; client owner UID is never accepted. Missing real canonical admission remains an explicitly tested denial.

## Callable inputs and outputs

- `reviewIssueFamilyGrant`: strict `{requestId,sessionId,recipientUid,sourceVersionId,approvedProjectionSha256,expiresInSeconds,acceptSyntheticPolicy:true}`; expiry integer 60..3600. Output `{receiptId,eventId,revision,shareEpoch,duplicate:boolean}`.
- `reviewWithdrawFamilyGrant`: strict `{requestId,receiptId}`; authenticate owner and recheck decision ownership. Story-wide epoch advance preserves current Storytime semantics. Output `{eventId,revision,shareEpoch}`.
- `reviewDeleteFamilySubject`: strict `{requestId}`; subject is current authenticated UID. Write durable synthetic subject fence and signed delete event. Output `{eventId}`.
- `reviewDispatchFamilyEvent`: strict `{eventId}`; only fixed current delivery actor. Read immutable Privacy outbox, HTTP POST signed envelope to fixed consumer using the verified delivery actor bearer. Return downstream result; store ACK separately. No caller-supplied destination/event/signature.
- `reviewAcceptFamilyEvent`: strict `{event}`; only fixed current delivery actor. Validate signed envelope, public pin, audience, project, kind, scope and inner receipt. Output `{eventId,status:'applied'|'duplicate'|'stale',...}`. Conflicting same event ID denied; stale delivery never restores authority.

## Signed event

Exact object keys: `schemaVersion,eventId,kind,projectId,audience,subjectUid,ownerUid,recipientUid,sessionId,receiptId,revision,shareEpoch,issuedAtMs,receipt,issuerKeyId,eventSignature`.

Schema `family-review-event-v1`; kind `grant|withdraw|delete-subject`; positive safe integer revision; nonnegative safe integer shareEpoch; integer issuedAtMs. Identity values bounded `[A-Za-z0-9._-]+`, except irrelevant fields are empty strings for deletion. `subjectUid` is empty for grant/withdraw, authenticated requester for deletion.

Canonical event bytes: UTF-8 JSON of `['urai-family-review-event-v1',schemaVersion,eventId,kind,projectId,audience,subjectUid,ownerUid,recipientUid,sessionId,receiptId,revision,shareEpoch,issuedAtMs,receiptTupleOrNull,issuerKeyId]`.

Grant receipt object contains exactly the existing 13 signed fields plus `issuerKeyId,issuerSignature`. Tuple order: `schemaVersion,id,userId,sourceSessionId,recipientUid,sourceVersionId,shareEpoch,purpose,policyVersion,decision,issuedBy,approvedProjectionSha256,expiresAtMs,issuerKeyId,issuerSignature`. Inner signature uses unchanged Privacy #335 helper and unchanged Storytime #120 verifier. Other event kinds carry receipt `null`.

Both signatures use ephemeral review Ed25519 key. Outer signature adds destination, demo identity realm, revision and kind. It is a proposed review transport, not ratified cloud identity or canonical consent.

## State

- Scope ID: SHA256(JSON.stringify([ownerUid,sessionId])). Privacy `familyReviewScopes/{scopeId}`: revision, shareEpoch, ownerUid, sessionId, status. Each issue/withdraw increments revision. Initial epoch matches existing Storytime `familyStorySharingStates/{sessionId}` or zero. Withdrawal increments epoch and permanently blocks reissue for this story in this narrow prototype, preserving existing no-regrant behavior. No claim of selective renewal or multi-recipient policy.
- Privacy `familyReviewDecisions/{receiptId}`: immutable signed receipt and request fingerprint, ownerUid, recipientUid, sessionId, mutable lifecycle status. Receipt ID `review-receipt-` + SHA256(JSON.stringify([ownerUid,requestId])). Exact retry rechecks lifecycle/fences; conflicting request ID denied.
- Privacy `familyReviewOutbox/{eventId}` contains `{event}` only. ID `review-event-` + SHA256(JSON.stringify([kind,uid,requestId])). ACKs are separate `familyReviewDeliveryAcks` docs.
- Privacy `familyReviewSubjectFences/{uid}` permanently active on deletion. Issuance checks both subject fences, both Storytime tombstones, exact source/chapter and current accounts.
- Consumer `familyReviewDeliveryEvents/{eventId}` contains digest/status; `familyReviewDeliveryScopes/{scopeId}` max revision/status/epoch. Consumer tombstones are existing `privacyDeletionTombstones/{uid}`.
- Grant delivery verifies exact current source/content, owner and recipient account status, sharing epoch, fences and inner signature, then writes `consentDecisionReceipts/{receiptId}` with Timestamp expiry. It never creates view grants. Owner must call unchanged `grantFamilyStoryView` after delivery.
- Withdrawal persists even if grant has not arrived, marks existing receipt revoked, monotonically advances story epoch, stores terminal withdrawn scope and revokes story grants. Duplicate delivery does not advance again. Read all transaction documents before writes.
- Deletion first durably fences subject, then idempotently purges consumer receipts and family grants where subject is owner or recipient, and sharing state owned by subject. Recipient deletion preserves someone else's source story/chapter/state. Keep minimal fences/inbox evidence. Return scoped residual counts and distinguish purge pending from complete. No source-media/global deletion claim. Retry after purge failure must complete cleanup even if inbox already exists.

## Evidence

Build exact sources; assert default-off and actual canonical denial; real emulator current-owner auth; no positive receipt seeded by test Admin SDK; one issued/delivered projection for named Mom; cousin/outsider/second-story denial; digest and source-owner mismatch; delivery forbidden for ordinary owner; exact and conflicting retries; withdrawal-before-grant delivery; withdrawal denies current view; actual subject deletion propagates and purges scoped authority records; delayed replay cannot restore. Reuse historical suites. Positive policy and service identity remain explicit synthetic fixtures. Same-project emulator transport does not certify cloud cross-project IAM.
