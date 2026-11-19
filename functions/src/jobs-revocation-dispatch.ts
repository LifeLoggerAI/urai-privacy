import { createHash, randomUUID } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";

const db = getFirestore();
const jobsToken = defineSecret("URAI_JOBS_PRIVACY_EVENT_TOKEN");
const jobsUrl = defineString("URAI_JOBS_REVOCATION_URL");
const hex64 = /^[0-9a-f]{64}$/;
const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

type Row = Record<string, any>;
export function projectJobsRevocation(row: Row): Record<string, unknown> {
  const strings = ["eventId", "consentRecordId", "uid", "purpose", "consentTier", "policyVersion"];
  if (row.schemaVersion !== "consent.revoked.v1" ||
      strings.some((key) => typeof row[key] !== "string" || !row[key] ||
        row[key].length > 160) ||
      !hex64.test(row.eventId) || !hex64.test(row.sourceReceiptHash) ||
      !hex64.test(row.integrityHash)) {
    throw new Error("invalid-outbox-event");
  }
  const prior = row.priorGrantReceiptHash;
  const state = row.priorGrantEvidenceState;
  if (state === "present" ? !(typeof prior === "string" && hex64.test(prior)) :
      (state === "not_applicable" || state === "missing_or_invalid") ? prior !== null : true) {
    throw new Error("invalid-prior-grant-evidence");
  }
  const eventId = hash({schemaVersion: row.schemaVersion, recordId: row.consentRecordId,
    uid: row.uid, purpose: row.purpose, consentTier: row.consentTier,
    policyVersion: row.policyVersion, receiptHash: row.sourceReceiptHash});
  if (eventId !== row.eventId ||
    row.integrityHash !== hash({eventId, recordId: row.consentRecordId,
      uid: row.uid, purpose: row.purpose, priorGrantReceiptHash: prior,
      priorGrantEvidenceState: state})) {
    throw new Error("invalid-outbox-lineage");
  }
  const at = row.createdAt?.toDate?.();
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) throw new Error("invalid-event-time");
  return {
    type: "consent.revoked.v2", schemaVersion: row.schemaVersion, eventId,
    consentRecordId: row.consentRecordId, uid: row.uid, purpose: row.purpose,
    consentTier: row.consentTier, policyVersion: row.policyVersion,
    sourceReceiptHash: row.sourceReceiptHash, priorGrantReceiptHash: prior,
    priorGrantEvidenceState: state, integrityHash: row.integrityHash,
    correlationId: eventId, revokedAt: at.toISOString()
  };
}

export function verifyJobsReceipt(body: unknown, event: Record<string, unknown>): string {
  const ack = (body as any)?.acknowledgement;
  if ((body as any)?.ok !== true || !ack ||
      ack.consumerId !== "urai-jobs" || ack.eventId !== event.eventId ||
      ack.ownerUid !== event.uid || ack.purpose !== event.purpose ||
      ack.policyVersion !== event.policyVersion ||
      ack.decisionReceiptId !== event.sourceReceiptHash ||
      ack.sourceReceiptHash !== event.sourceReceiptHash ||
      ack.priorGrantReceiptHash !== event.priorGrantReceiptHash ||
      ack.priorGrantEvidenceState !== event.priorGrantEvidenceState ||
      ack.correlationId !== event.correlationId ||
      ack.schemaVersion !== event.type || ack.status !== "blocked" ||
      !ack.derivativeInvalidation || ack.derivativeInvalidation.purpose !== event.purpose ||
      ["jobsScanned", "jobsInvalidated", "plansInvalidated", "storageObjectsDeleted"].some(
        (field) => !Number.isSafeInteger(ack.derivativeInvalidation[field]) || ack.derivativeInvalidation[field] < 0)) {
    throw new Error("jobs-receipt-mismatch");
  }
  const expectedHash = createHash("sha256").update([
    event.eventId, event.uid, event.purpose,
    event.policyVersion, event.sourceReceiptHash, "blocked"
  ].join("\n")).digest("hex");
  if (ack.integrityHash !== expectedHash) throw new Error("jobs-receipt-integrity");
  return expectedHash;
}

function destination(url: string): URL {
  const u = new URL(url);
  const permitted = u.protocol === "https:" &&
    (u.hostname.endsWith(".cloudfunctions.net") || u.hostname.endsWith(".run.app")) &&
    u.username === "" && u.password === "" && u.search === "" && u.hash === "";
  const emulator = process.env.FUNCTIONS_EMULATOR === "true" &&
    u.protocol === "http:" && ["127.0.0.1", "localhost"].includes(u.hostname);
  if (!(permitted || emulator)) throw new Error("untrusted-jobs-target");
  return u;
}

/**
 * Review-only, fail-closed transport. A delivered receipt is NOT a Privacy ACK:
 * the trusted Jobs consumer must separately perform its own authenticated ACK.
 */
export const deliverJobsConsentRevocation = onSchedule({
  schedule: "every 5 minutes", secrets: [jobsToken],
  retryCount: 0, timeoutSeconds: 120, memory: "256MiB"
}, async () => {
  const url = destination(jobsUrl.value()).toString();
  const secret = jobsToken.value();
  if (!secret) throw new Error("missing-jobs-transport-secret");
  const outbox = db.collection("consentRevocationOutbox");
  const pending = await outbox.where("status", "==", "pending").limit(20).get();
  const interrupted = await outbox.where("status", "==", "dispatching").limit(20).get();
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const doc of [...pending.docs, ...interrupted.docs]) {
    const attemptId = randomUUID();
    let lease = false;
    try {
      lease = await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(doc.ref);
        if (!snapshot.exists) return false;
        const row = snapshot.data() ?? {};
        const expired = row.status === "dispatching" &&
          typeof row.dispatchLeaseAt?.toMillis === "function" &&
          row.dispatchLeaseAt.toMillis() < cutoff;
        if (row.status !== "pending" && !expired) return false;
        tx.update(doc.ref, {
          status: "dispatching", dispatchAttemptId: attemptId,
          dispatchLeaseAt: FieldValue.serverTimestamp(),
          attempts: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp()
        });
        return true;
      });
      if (!lease) continue;
      const event = projectJobsRevocation(doc.data());
      const response = await fetch(url, {
        method: "POST", redirect: "error",
        headers: { authorization: "Bearer " + secret, "content-type": "application/json" },
        body: JSON.stringify(event), signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error("jobs-delivery-http-" + response.status);
      const receiptHash = verifyJobsReceipt(await response.json(), event);
      await db.runTransaction(async (tx) => {
        const current = await tx.get(doc.ref);
        if (current.data()?.status !== "dispatching" ||
            current.data()?.dispatchAttemptId !== attemptId) return;
        tx.update(doc.ref, {
          status: "delivered_pending_ack", jobsReceiptHash: receiptHash,
          jobsDeliveredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
        });
      });
    } catch (error) {
      if (lease) {
        await db.runTransaction(async (tx) => {
          const current = await tx.get(doc.ref);
          if (current.data()?.status !== "dispatching" ||
              current.data()?.dispatchAttemptId !== attemptId) return;
          tx.update(doc.ref, {
            status: "pending", lastDeliveryError:
              String(error instanceof Error ? error.message : "unknown").slice(0, 160),
            updatedAt: FieldValue.serverTimestamp()
          });
        });
      }
      console.error("Jobs consent revocation delivery failed", { eventId: doc.id });
    }
  }
});
/**
 * A Jobs HTTP delivery is NOT Privacy acknowledgement. The only admissible
 * final state is an independently consumer-bound Privacy callable ACK whose
 * event identity and detailHash agree with the previously verified Jobs receipt.
 * An integrity hash is not a signature: service IAM/reviewer controls still apply.
 */
export function validJobsPrivacyAck(ack: Row, outbox: Row): boolean {
  if (outbox.status !== "delivered_pending_ack" ||
      !hex64.test(String(outbox.jobsReceiptHash || "")) ||
      ack.consumerId !== "urai-jobs" || ack.status !== "applied" ||
      ack.actorRole !== "system" ||
      typeof ack.actorUid !== "string" || !ack.actorUid ||
      ack.correlationId !== outbox.eventId ||
      ack.detailHash !== outbox.jobsReceiptHash ||
      !hex64.test(String(ack.integrityHash || ""))) return false;
  try { projectJobsRevocation(outbox); } catch { return false; }
  return ack.integrityHash === hash({
    eventId: outbox.eventId, consumerId: "urai-jobs", status: "applied",
    correlationId: outbox.eventId, detailHash: outbox.jobsReceiptHash,
    actorUid: ack.actorUid, tokenConsumerId: "urai-jobs"
  });
}

export const reconcileJobsConsentRevocationAck = onSchedule({
  schedule: "every 5 minutes", retryCount: 0,
  timeoutSeconds: 120, memory: "256MiB"
}, async () => {
  const delivered = await db.collection("consentRevocationOutbox")
    .where("status", "==", "delivered_pending_ack").limit(20).get();
  for (const doc of delivered.docs) {
    try {
      await db.runTransaction(async (tx) => {
        const current = await tx.get(doc.ref);
        const ack = await tx.get(doc.ref.collection("acknowledgements").doc("urai-jobs"));
        if (!current.exists || !ack.exists ||
            !validJobsPrivacyAck(ack.data() ?? {}, current.data() ?? {})) return;
        tx.update(doc.ref, {
          status: "acknowledged",
          verifiedConsumerId: "urai-jobs",
          verifiedJobsReceiptHash: current.data()?.jobsReceiptHash,
          acknowledgedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      });
    } catch {
      console.error("Jobs acknowledgement reconciliation failed", { eventId: doc.id });
    }
  }
});
