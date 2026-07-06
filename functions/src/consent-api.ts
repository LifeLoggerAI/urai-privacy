import { createHash } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  CONSENT_DECISION_POLICY_VERSION,
  consentPurposeRegistry,
  evaluateConsentDecision,
  type ConsentPurpose
} from "./consent-decision";

const db = getFirestore();

const setConsentSchema = z.object({
  purpose: z.string().trim().min(2).max(120),
  status: z.enum(["granted", "denied", "revoked"]),
  expiresAt: z.string().datetime().optional(),
  surface: z.string().trim().min(2).max(80).default("feature-gate"),
  jurisdiction: z.string().trim().min(2).max(80).default("unknown"),
  evidenceHash: z.string().trim().min(16).max(128)
});

const decisionSchema = z.object({
  targetUid: z.string().trim().min(1).max(160).optional(),
  purpose: z.string().trim().min(2).max(120),
  correlationId: z.string().trim().min(8).max(160)
});

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function uidFrom(request: { auth?: { uid?: string; token?: Record<string, unknown> } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  return uid;
}

function isPrivileged(token?: Record<string, unknown>) {
  return token?.admin === true || token?.system === true || token?.role === "admin" || token?.role === "system";
}

function canonicalPurpose(value: string): ConsentPurpose {
  if (!(value in consentPurposeRegistry)) {
    throw new HttpsError("failed-precondition", "Unknown consent purpose. Processing must fail closed until the purpose registry is updated.");
  }
  return value as ConsentPurpose;
}

function consentRecordId(uid: string, purpose: string) {
  return `${uid}_${purpose.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export const setCanonicalConsent = onCall(async (request) => {
  const uid = uidFrom(request);
  const parsed = setConsentSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join("; "));

  const purpose = canonicalPurpose(parsed.data.purpose);
  const definition = consentPurposeRegistry[purpose];
  const recordId = consentRecordId(uid, purpose);
  const now = new Date().toISOString();
  const receipt = {
    uid,
    purpose,
    consentTier: definition.requiredTier,
    status: parsed.data.status,
    policyVersion: CONSENT_DECISION_POLICY_VERSION,
    expiresAt: parsed.data.expiresAt ?? null,
    surface: parsed.data.surface,
    jurisdiction: parsed.data.jurisdiction,
    evidenceHash: parsed.data.evidenceHash,
    updatedAt: now
  };
  const receiptHash = hash(receipt);
  const recordRef = db.collection("consentRecords").doc(recordId);
  const eventRef = db.collection("consentEvents").doc();
  const auditRef = db.collection("auditLogs").doc();

  await db.runTransaction(async (transaction) => {
    transaction.set(recordRef, { ...receipt, receiptHash }, { merge: true });
    transaction.set(eventRef, { ...receipt, consentRecordId: recordId, actorUid: uid, createdAt: now, receiptHash: hash({ ...receipt, eventId: eventRef.id }) });
    transaction.set(auditRef, {
      actorUid: uid,
      actorRole: "user",
      action: "canonical_consent_updated",
      targetUid: uid,
      source: "function",
      timestamp: FieldValue.serverTimestamp(),
      metadata: { purpose, status: parsed.data.status, consentTier: definition.requiredTier, policyVersion: CONSENT_DECISION_POLICY_VERSION, consentRecordId: recordId, consentEventId: eventRef.id },
      integrityHash: hash({ uid, purpose, status: parsed.data.status, consentRecordId: recordId, auditId: auditRef.id })
    });
  });

  return { consentId: recordId, consentEventId: eventRef.id, auditId: auditRef.id, status: parsed.data.status, consentTier: definition.requiredTier, policyVersion: CONSENT_DECISION_POLICY_VERSION, receiptHash };
});

export const evaluateCanonicalConsent = onCall(async (request) => {
  const actorUid = uidFrom(request);
  const parsed = decisionSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join("; "));

  const purpose = canonicalPurpose(parsed.data.purpose);
  const targetUid = parsed.data.targetUid ?? actorUid;
  if (targetUid !== actorUid && !isPrivileged(request.auth?.token)) {
    throw new HttpsError("permission-denied", "Owner, administrator, or trusted system authority is required.");
  }

  const recordId = consentRecordId(targetUid, purpose);
  const snapshot = await db.collection("consentRecords").doc(recordId).get();
  const decision = evaluateConsentDecision({ purpose, record: snapshot.exists ? snapshot.data() : null });
  const accessRef = db.collection("dataAccessEvents").doc();
  await accessRef.set({
    uid: targetUid,
    actorUid,
    purpose,
    correlationId: parsed.data.correlationId,
    decision: decision.allowed ? "allow" : "deny",
    reason: decision.reason,
    requiredTier: decision.requiredTier,
    policyVersion: decision.policyVersion,
    evaluatedAt: FieldValue.serverTimestamp(),
    consentRecordId: snapshot.exists ? recordId : null,
    integrityHash: hash({ targetUid, actorUid, purpose, correlationId: parsed.data.correlationId, allowed: decision.allowed, reason: decision.reason, eventId: accessRef.id })
  });

  return { ...decision, targetUid, correlationId: parsed.data.correlationId, decisionEventId: accessRef.id };
});
