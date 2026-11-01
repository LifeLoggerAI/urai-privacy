import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  CONSENT_DECISION_POLICY_VERSION,
  LIFE_MOVIE_RENDER_CONSENT_PURPOSE,
  matchesLifeMovieRenderScope,
  policyVersionForPurpose,
  consentPurposeRegistry,
  isCanonicalConsentPurpose,
  evaluateConsentDecision,
  type ConsentPurpose
} from "./consent-decision";
import { resolveConsentExpiry } from "./consent-expiry";
import { verifiesLifeMovieScopedReceipt } from "./life-movie-scoped-receipt";
import { isTrustedJobsConsentCaller, isTrustedActiveJobsConsentCaller } from "./life-movie-jobs-identity";

const db = getFirestore();

const setConsentSchema = z.object({
  purpose: z.string().trim().min(2).max(120),
  status: z.enum(["granted", "denied", "revoked"]),
  expiresAt: z.string().datetime().optional(),
  surface: z.string().trim().min(2).max(80).default("feature-gate"),
  jurisdiction: z.string().trim().min(2).max(80).default("unknown")
});

const decisionSchema = z.object({
  targetUid: z.string().trim().min(1).max(160).optional(),
  purpose: z.string().trim().min(2).max(120),
  correlationId: z.string().trim().min(8).max(160)
});

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const CANONICAL_CONSENT_NOTICE = Object.freeze({
  version: "privacy-consent-2026-07-11",
  hash: hash({
    noticeVersion: "privacy-consent-2026-07-11",
    policyVersion: CONSENT_DECISION_POLICY_VERSION,
    purposeRegistry: consentPurposeRegistry
  })
});

function uidFrom(request: { auth?: { uid?: string; token?: Record<string, unknown> } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  return uid;
}

function canonicalPurpose(value: string): ConsentPurpose {
  if (!isCanonicalConsentPurpose(value)) {
    throw new HttpsError("failed-precondition", "Unknown consent purpose. Processing must fail closed until the purpose registry is updated.");
  }
  return value as ConsentPurpose;
}

function consentRecordId(uid: string, purpose: string) {
  return `${uid}_${purpose.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function crossUserAuthority(token?: Record<string, unknown>) {
  if (token?.admin === true || token?.role === "admin") {
    return { role: "admin" as const, consumerId: null };
  }

  const system = token?.system === true || token?.role === "system";
  const consumerId = typeof token?.consumerId === "string" ? token.consumerId.trim() : "";
  if (system && /^[a-zA-Z0-9._-]{2,120}$/.test(consumerId)) {
    return { role: "system" as const, consumerId };
  }

  return null;
}

export const setCanonicalConsent = onCall(async (request) => {
  const uid = uidFrom(request);
  const parsed = setConsentSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join("; "));

  const purpose = canonicalPurpose(parsed.data.purpose);
  // Global, unscoped Life Movie grants are not an acceptable render authority.
  // Scoped issuance requires an approved selection/notice flow, not this general toggle.
  if (purpose === LIFE_MOVIE_RENDER_CONSENT_PURPOSE && parsed.data.status === "granted") {
    throw new HttpsError("failed-precondition", "Life Movie consent requires an approved, movie-specific source selection flow.");
  }
  const definition = consentPurposeRegistry[purpose];
  const nowMillis = Date.now();
  let effectiveExpiresAt: string | null;
  try {
    effectiveExpiresAt = resolveConsentExpiry({
      status: parsed.data.status,
      requestedExpiresAt: parsed.data.expiresAt,
      nowMillis
    });
  } catch (error) {
    throw new HttpsError(
      "invalid-argument",
      error instanceof Error ? error.message : "Consent expiry is invalid."
    );
  }

  const recordId = consentRecordId(uid, purpose);
  const now = new Date(nowMillis).toISOString();
  const evidence = {
    uid,
    purpose,
    status: parsed.data.status,
    surface: parsed.data.surface,
    jurisdiction: parsed.data.jurisdiction,
    noticeVersion: CANONICAL_CONSENT_NOTICE.version,
    noticeHash: CANONICAL_CONSENT_NOTICE.hash,
    policyVersion: policyVersionForPurpose(purpose),
    expiresAt: effectiveExpiresAt
  };
  const evidenceHash = hash(evidence);
  const receipt = {
    uid,
    purpose,
    consentTier: definition.requiredTier,
    status: parsed.data.status,
    policyVersion: policyVersionForPurpose(purpose),
    expiresAt: effectiveExpiresAt,
    surface: parsed.data.surface,
    jurisdiction: parsed.data.jurisdiction,
    noticeVersion: CANONICAL_CONSENT_NOTICE.version,
    noticeHash: CANONICAL_CONSENT_NOTICE.hash,
    evidenceHash,
    updatedAt: now
  };
  const receiptHash = hash(receipt);
  const recordRef = db.collection("consentRecords").doc(recordId);
  const eventRef = db.collection("consentEvents").doc();
  const auditRef = db.collection("auditLogs").doc();

  await db.runTransaction(async (transaction) => {
    const deletionFence = await transaction.get(db.collection("privacyDeletionTombstones").doc(uid));
    if (deletionFence.data()?.active === true) {
      throw new HttpsError("failed-precondition", "Account deletion is in progress or completed; consent changes are blocked.");
    }
    transaction.set(recordRef, {
      ...receipt,
      receiptHash,
      serverUpdatedAt: FieldValue.serverTimestamp()
    }, { merge: false });
    transaction.set(eventRef, {
      ...receipt,
      consentRecordId: recordId,
      actorUid: uid,
      createdAt: FieldValue.serverTimestamp(),
      receiptHash: hash({ ...receipt, eventId: eventRef.id })
    });
    transaction.set(auditRef, {
      actorUid: uid,
      actorRole: "user",
      action: "canonical_consent_updated",
      targetUid: uid,
      source: "function",
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        purpose,
        status: parsed.data.status,
        consentTier: definition.requiredTier,
        // Audit the exact per-purpose policy version committed in the consent receipt.
        policyVersion: receipt.policyVersion,
        consentRecordId: recordId,
        consentEventId: eventRef.id,
        evidenceHash,
        updatedAt: now
      },
      integrityHash: hash({ uid, purpose, status: parsed.data.status, consentRecordId: recordId, auditId: auditRef.id, evidenceHash, updatedAt: now })
    });
  });

  return {
    consentId: recordId,
    consentEventId: eventRef.id,
    auditId: auditRef.id,
    status: parsed.data.status,
    consentTier: definition.requiredTier,
    policyVersion: policyVersionForPurpose(purpose),
    expiresAt: effectiveExpiresAt,
    updatedAt: now,
    evidenceHash,
    receiptHash
  };
});

export const evaluateCanonicalConsent = onCall(async (request) => {
  const actorUid = uidFrom(request);
  const parsed = decisionSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join("; "));

  const purpose = canonicalPurpose(parsed.data.purpose);
  // A purpose-wide decision cannot authorize one particular private movie.
  // Only verifyLifeMovieRenderConsent checks subject, tenant, reviewed receipt,
  // immutable selected sources, expiry and revocation together.
  if (purpose === LIFE_MOVIE_RENDER_CONSENT_PURPOSE) {
    throw new HttpsError("failed-precondition", "Life Movie rendering requires the dedicated movie-scoped consent verifier.");
  }
  const targetUid = parsed.data.targetUid ?? actorUid;
  const authority = targetUid === actorUid ? { role: "user" as const, consumerId: null } : crossUserAuthority(request.auth?.token);
  if (!authority) {
    throw new HttpsError("permission-denied", "Owner, administrator, or a consumer-bound trusted system authority is required.");
  }

  const recordId = consentRecordId(targetUid, purpose);
  const recordRef = db.collection("consentRecords").doc(recordId);
  const tombstoneRef = db.collection("privacyDeletionTombstones").doc(targetUid);
  const accessRef = db.collection("dataAccessEvents").doc();
  const decision = await db.runTransaction(async (transaction) => {
    const [snapshot, deletionFence] = await Promise.all([
      transaction.get(recordRef),
      transaction.get(tombstoneRef)
    ]);
    if (deletionFence.data()?.active === true) {
      throw new HttpsError("failed-precondition", "Account deletion is in progress or completed; consent decisions are blocked.");
    }

    const evaluated = evaluateConsentDecision({
      purpose,
      record: snapshot.exists ? snapshot.data() : null
    });
    transaction.create(accessRef, {
      uid: targetUid,
      actorUid,
      actorRole: authority.role,
      consumerId: authority.consumerId,
      purpose,
      correlationId: parsed.data.correlationId,
      decision: evaluated.allowed ? "allow" : "deny",
      reason: evaluated.reason,
      requiredTier: evaluated.requiredTier,
      policyVersion: evaluated.policyVersion,
      evaluatedAt: FieldValue.serverTimestamp(),
      consentRecordId: snapshot.exists ? recordId : null,
      integrityHash: hash({
        targetUid,
        actorUid,
        actorRole: authority.role,
        consumerId: authority.consumerId,
        purpose,
        correlationId: parsed.data.correlationId,
        allowed: evaluated.allowed,
        reason: evaluated.reason,
        eventId: accessRef.id
      })
    });
    return evaluated;
  });

  return { ...decision, targetUid, correlationId: parsed.data.correlationId, decisionEventId: accessRef.id };
});

const lifeMovieRenderScopeSchema = z.object({
  projectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  renderPlanDigest: z.string().regex(/^[0-9a-f]{64}$/),
  sourceSetDigest: z.string().regex(/^[0-9a-f]{64}$/)
}).strict();

const lifeMovieVerificationSchema = z.object({
  subjectUid: z.string().trim().min(1).max(160),
  tenantId: z.string().trim().min(1).max(160),
  correlationId: z.string().trim().min(8).max(160),
  decisionReceiptId: z.string().regex(/^[0-9a-f]{64}$/),
  policyVersion: z.string().trim().min(1).max(80),
  renderScope: lifeMovieRenderScopeSchema
}).strict();

/** Jobs-only current decision, never a reusable capability or render-enablement flag. */
export const verifyLifeMovieRenderConsent = onCall(async (request) => {
  const actorUid = uidFrom(request);
  const authority = crossUserAuthority(request.auth?.token);
  if (!authority || authority.role !== "system" || authority.consumerId !== "urai-jobs" ||
      !isTrustedJobsConsentCaller({ uid: actorUid, token: request.auth?.token }, process.env.URAI_PRIVACY_JOBS_VERIFIER_UID)) {
    throw new HttpsError("permission-denied", "A dedicated verified Jobs system identity is required.");
  }
  // The callable verified signature, issuer and audience. Explicitly recheck
  // revocation/disabled status before any scoped consent record is read.
  const currentJobsIdentity = await isTrustedActiveJobsConsentCaller(
    { uid: actorUid, token: request.auth?.token },
    process.env.URAI_PRIVACY_JOBS_VERIFIER_UID,
    request.rawRequest?.headers.authorization,
    (idToken, checkRevoked) => getAuth().verifyIdToken(idToken, checkRevoked),
  );
  if (!currentJobsIdentity) {
    throw new HttpsError("permission-denied", "Current Jobs service identity verification is required.");
  }
  const parsed = lifeMovieVerificationSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid Life Movie verification request.");
  const { subjectUid, tenantId, correlationId, decisionReceiptId, policyVersion, renderScope } = parsed.data;
  const purpose = LIFE_MOVIE_RENDER_CONSENT_PURPOSE;
  const recordId = consentRecordId(subjectUid, purpose);
  const recordRef = db.collection("consentRecords").doc(recordId);
  const tombstoneRef = db.collection("privacyDeletionTombstones").doc(subjectUid);
  const accessRef = db.collection("dataAccessEvents").doc();
  return await db.runTransaction(async (transaction) => {
    const [recordSnapshot, tombstone] = await Promise.all([
      transaction.get(recordRef), transaction.get(tombstoneRef)
    ]);
    const record = recordSnapshot.exists ? recordSnapshot.data() : null;
    const evaluated = evaluateConsentDecision({ purpose, record });
    const receiptMatches = typeof record?.receiptHash === "string"
      && /^[0-9a-f]{64}$/.test(record.receiptHash)
      && record.receiptHash === decisionReceiptId;
    const subjectMatches = record?.uid === subjectUid;
    // Neither an old purpose-wide grant nor a caller-supplied hash is sufficient.
    const scopeMatches = matchesLifeMovieRenderScope(record?.renderScope, renderScope);
    // A matching loose scope does not prove the original grant committed it.
    const receiptBindsScope = verifiesLifeMovieScopedReceipt(record, {
      subjectUid, tenantId, decisionReceiptId, renderScope
    });
    const policyMatches = policyVersion === policyVersionForPurpose(purpose);
    const deleted = tombstone.data()?.active === true;
    // Tenant membership and source rights remain independent Jobs/Studio checks.
    const allowed = evaluated.allowed && receiptMatches && subjectMatches && scopeMatches && receiptBindsScope && policyMatches && !deleted;
    const reason = deleted ? "ACCOUNT_DELETED"
      : !subjectMatches ? "SUBJECT_MISMATCH"
      : !scopeMatches ? "RENDER_SCOPE_MISMATCH"
      : !receiptBindsScope ? "SCOPED_RECEIPT_INTEGRITY_MISMATCH"
      : !receiptMatches ? "RECEIPT_MISMATCH"
      : !policyMatches ? "POLICY_VERSION_MISMATCH" : evaluated.reason;
    transaction.create(accessRef, {
      uid: subjectUid, actorUid, actorRole: "system", consumerId: authority.consumerId,
      tenantId, purpose, correlationId, decision: allowed ? "allow" : "deny",
      reason, policyVersion: evaluated.policyVersion, renderScopeHash: hash(renderScope),
      consentRecordId: recordSnapshot.exists ? recordId : null,
      evaluatedAt: FieldValue.serverTimestamp(),
      integrityHash: hash({ subjectUid, actorUid, tenantId, purpose, correlationId,
        receiptHash: decisionReceiptId, renderScopeHash: hash(renderScope), allowed, reason, eventId: accessRef.id })
    });
    return {
      allowed, reason, subjectUid, tenantId, purpose, correlationId,
      policyVersion: evaluated.policyVersion, requiredTier: evaluated.requiredTier,
      receiptHash: allowed ? decisionReceiptId : null,
      expiresAt: allowed ? record?.expiresAt : null,
      // Echo only the scope checked by the dedicated verifier. This is an
      // authenticated result binding, not a new bearer capability or grant.
      renderScope: allowed ? renderScope : null,
      evaluatedAt: evaluated.evaluatedAt,
      decisionEventId: accessRef.id
    };
  });
});
