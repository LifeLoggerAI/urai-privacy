import { createHash } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { projectRevocationToJobs } from "./consent-revocation-dispatch";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Row = Record<string, unknown>;

export function verifiedJobsConsumerAck(
  outbox: Row, acknowledgement: Row, eventId: string
): boolean {
  if (outbox.eventId !== eventId ||
      outbox.jobsTransportStatus !== "delivered" ||
      !/^[a-f0-9]{64}$/.test(String(outbox.jobsTransportReceiptHash ?? "")) ||
      acknowledgement.consumerId !== "urai-jobs" ||
      acknowledgement.status !== "applied" ||
      acknowledgement.actorRole !== "system" ||
      typeof acknowledgement.actorUid !== "string" || !acknowledgement.actorUid ||
      acknowledgement.correlationId !== eventId ||
      acknowledgement.detailHash !== outbox.jobsTransportReceiptHash ||
      !/^[a-f0-9]{64}$/.test(String(acknowledgement.integrityHash ?? ""))) {
    return false;
  }
  try {
    const createdAt = outbox.createdAt as { toDate?: () => Date } | undefined;
    if (!createdAt || typeof createdAt.toDate !== "function") return false;
    projectRevocationToJobs(outbox, eventId, createdAt.toDate().toISOString());
  } catch { return false; }
  return acknowledgement.integrityHash === digest({
    eventId, consumerId: "urai-jobs", status: "applied",
    correlationId: eventId, detailHash: outbox.jobsTransportReceiptHash,
    actorUid: acknowledgement.actorUid, tokenConsumerId: "urai-jobs"
  });
}

/**
 * One transport: dispatchConsentRevocationToJobs in #331.
 * This is only a terminal ACK reconciliation, not a second dispatcher.
 * The real authenticated Jobs consumer must call acknowledgeConsentRevocation.
 */
export const reconcileNativeJobsRevocationAck = onDocumentWritten({
  document: "consentRevocationOutbox/{eventId}", region: "us-central1", retry: true
}, async (event) => {
  if (!event.data?.after.exists) return;
  const eventId = event.params.eventId;
  const ref = getFirestore().collection("consentRevocationOutbox").doc(eventId);
  await getFirestore().runTransaction(async (tx) => {
    const outbox = await tx.get(ref);
    if (!outbox.exists) return;
    const row = outbox.data() ?? {};
    if (row.jobsAckStatus === "verified" ||
        row.jobsTransportStatus !== "delivered" ||
        row.lastAcknowledgedConsumer !== "urai-jobs" ||
        row.lastAcknowledgementStatus !== "applied") return;
    const ack = await tx.get(ref.collection("acknowledgements").doc("urai-jobs"));
    if (!ack.exists || !verifiedJobsConsumerAck(row, ack.data() ?? {}, eventId)) return;
    tx.update(ref, {
      jobsAckStatus: "verified",
      jobsAckConsumer: "urai-jobs",
      jobsAckVerifiedReceiptHash: row.jobsTransportReceiptHash,
      jobsAckVerifiedAt: FieldValue.serverTimestamp()
    });
  });
});

