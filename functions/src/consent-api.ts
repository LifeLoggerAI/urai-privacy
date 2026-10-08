import { createHash } from "node:crypto";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  CONSENT_DECISION_POLICY_VERSION,
  consentPurposeRegistry,
  evaluateConsentDecision,
  type ConsentPurpose
} from "./consent-decision";
import { resolveConsentExpiry } from "./consent-expiry";
import { createPrivacyActorGuard } from "./privacy-actor-guard";

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

function canonicalPurpose(value: string): ConsentPurpose {
  if (!Object.hasOwn(consentPurposeRegistry, value)) {
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
  const actor = await createPrivacyActorGuard(request);
  const uid = actor.uid;
  const parsed = setConsentSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join("; "));

  const purpose = canonicalPurpose(parsed.data.purpose);
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
    policyVersion: CONSENT_DECISION_POLICY_VERSION,
    expiresAt: effectiveExpiresAt
  };
  const evidenceHash = hash(evidence);
  const receipt = {
    uid,
    purpose,
    consentTier: definition.requiredTier,
    status: parsed.data.status,
    policyVersion: CONSENT_DECISION_POLICY_VERSION,
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
    const deletionFenceRef = db.collection("privacyDeletionTombstones").doc(uid);
    const deletionFence = await transaction.get(deletionFenceRef);
    if (deletionFence.data()?.active === true) {
      throw new HttpsError("failed-precondition", "Account deletion is in progress or completed; consent changes are blocked.");
    }
    // Auth can be revoked, disabled, or recreated while the transaction read waits.
    await actor.requireCurrent();
    transaction.set(recordRef, {
      ...receipt,
      receiptHash,
      serverUpdatedAt: FieldValue.serverTimestamp()
    }, { merge: false });
    // Storage can read only two Firestore documents per evaluation. Keep this
    // canonical receipt projection in the existing subject fence, atomically
    // with the actual consent record. It cannot independently grant consent.
    if (purpose === "data.export") transaction.set(deletionFenceRef, {
      uid,
      exportConsentStatus: parsed.data.status,
      exportConsentReceiptHash: receiptHash,
      exportConsentPolicyVersion: CONSENT_DECISION_POLICY_VERSION,
      exportConsentExpiresAt: effectiveExpiresAt
        ? Timestamp.fromMillis(Date.parse(effectiveExpiresAt)) : FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
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
        policyVersion: CONSENT_DECISION_POLICY_VERSION,
        consentRecordId: recordId,
        consentEventId: eventRef.id,
        evidenceHash,
        updatedAt: now
      },
      integrityHash: hash({ uid, purpose, status: parsed.data.status, consentRecordId: recordId, auditId: auditRef.id, evidenceHash, updatedAt: now })
    });
  });

  await actor.requireCurrent();
  return {
    consentId: recordId,
    consentEventId: eventRef.id,
    auditId: auditRef.id,
    status: parsed.data.status,
    consentTier: definition.requiredTier,
    policyVersion: CONSENT_DECISION_POLICY_VERSION,
    expiresAt: effectiveExpiresAt,
    updatedAt: now,
    evidenceHash,
    receiptHash
  };
});

export const evaluateCanonicalConsent = onCall(async (request) => {
  const actor = await createPrivacyActorGuard(request);
  const actorUid = actor.uid;
  const parsed = decisionSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join("; "));

  const purpose = canonicalPurpose(parsed.data.purpose);
  const targetUid = parsed.data.targetUid ?? actorUid;
  const requireCurrentAuthority = async () => {
    const current = await actor.requireCurrent();
    const authority = targetUid === actorUid
      ? { role: "user" as const, consumerId: null } : crossUserAuthority(current.token);
    if (!authority) {
      throw new HttpsError("permission-denied", "Current owner, administrator, or consumer-bound trusted system authority is required.");
    }
    return authority;
  };
  const initialAuthority = await requireCurrentAuthority();
  const requireUnchangedAuthority = async () => {
    const current = await requireCurrentAuthority();
    if (current.role !== initialAuthority.role || current.consumerId !== initialAuthority.consumerId) {
      throw new HttpsError("permission-denied", "Consent decision actor authority changed.");
    }
    return current;
  };

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

    const authority = await requireUnchangedAuthority();
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

  await requireUnchangedAuthority();
  return { ...decision, targetUid, correlationId: parsed.data.correlationId, decisionEventId: accessRef.id };
});

