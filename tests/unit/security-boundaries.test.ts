import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const functionsSource = readFileSync("functions/src/index.ts", "utf8");
const functionsEntry = readFileSync("functions/src/functions-entry.ts", "utf8");
const exportRequest = readFileSync("functions/src/export-request.ts", "utf8");
const exportPagination = readFileSync("functions/src/export-pagination.ts", "utf8");
const exportCleanup = readFileSync("functions/src/export-artifact-cleanup.ts", "utf8");
const consentApi = readFileSync("functions/src/consent-api.ts", "utf8");
const consentExpiry = readFileSync("functions/src/consent-expiry.ts", "utf8");
const deletionMutationGuard = readFileSync("functions/src/deletion-mutation-guard.ts", "utf8");
const consentRevocation = readFileSync("functions/src/consent-revocation.ts", "utf8");
const firebaseClient = readFileSync("src/lib/firebase-privacy-client.ts", "utf8");
const consentPage = readFileSync("app/privacy-center/consent/page.tsx", "utf8");
const firestoreRules = readFileSync("firestore.rules", "utf8");
const storageRules = readFileSync("storage.rules", "utf8");
const lifecycle = readFileSync("functions/src/export-lifecycle-functions.ts", "utf8");

describe("privacy security boundaries", () => {
  it("does not trust user-controlled Firestore role documents for administrator authority", () => {
    expect(functionsSource).not.toContain('snap.data()?.role === "admin"');
    expect(functionsSource).not.toContain('db.collection("users").doc(uid).get()\n  return snap.exists');
    expect(firestoreRules).not.toContain("function isRoleAdmin()");
    expect(firestoreRules).toContain("request.auth.token.admin == true");
    expect(firestoreRules).toContain("request.auth.token.role == 'admin'");
  });

  it("blocks owners from creating or changing privileged user fields", () => {
    expect(firestoreRules).toContain("ownerIsNotCreatingPrivilegedFields");
    expect(firestoreRules).toContain("ownerIsNotChangingPrivilegedFields");
    expect(firestoreRules).toContain("deletionFenceIsInactive(uid)");
    expect(firestoreRules).toContain("privacyDeletionTombstones/$(uid)");
    for (const field of ["'role'", "'admin'", "'isAdmin'", "'legalHold'", "'markedForDeletion'", "'deletionMarkedAt'"]) {
      expect(firestoreRules).toContain(field);
    }
  });

  it("requires privacy records and evidence to be written by trusted server code", () => {
    for (const collection of ["privacyRequests", "exportJobs", "deletionRequests", "consentRecords", "consentEvents", "legalHoldRecords", "auditLogs", "adminActions", "dataAccessEvents", "policyVersions"]) {
      expect(firestoreRules).toContain(`match /${collection}/{id}`);
    }
    expect(firestoreRules).toContain("allow create, update, delete: if false;");
  });

  it("binds destructive deletion to an immutable exact-target dry-run plan", () => {
    expect(functionsSource).toContain("const deletionPlanSchema");
    expect(functionsSource).toContain("targets: z.record");
    expect(functionsSource).toContain("storageObjects: z.array");
    expect(functionsSource).toContain("approvedDeletionPlanPath");
    expect(functionsSource).toContain("writeDeletionPlanArtifact");
    expect(functionsSource).toContain("readDeletionPlanArtifact");
    expect(functionsSource).toContain("candidateDeletionPlan: FieldValue.delete()");
    expect(functionsSource).toContain("approvedPlanHash");
    expect(functionsSource).toContain("deletionPlanHash(approvedPlan)");
    expect(functionsSource).toContain("deletionPlanIsSubsetOfApproved");
    expect(functionsSource).toContain("Deletion targets changed after dry run");
    expect(functionsSource).toContain("A current dry-run plan hash is required before destructive deletion.");
    expect(functionsSource).toContain("deletion_execute_blocked_stale_plan_hash");
  });

  it("prevents concurrent execution and deletes only approved account targets", () => {
    expect(functionsSource).toContain('deletionExecutionState === "executing"');
    expect(functionsSource).toContain('deletionExecutionState: "executing"');
    expect(functionsSource).toContain("DELETION_EXECUTION_LEASE_MS");
    expect(functionsSource).toContain("deletionExecutionLeaseUntil");
    expect(functionsSource).toContain("deleteDocumentIds(collectionName, currentPlan.targets[collectionName]");
    expect(functionsSource).toContain('bucket.file(objectName).delete({ ignoreNotFound: true })');
    expect(functionsSource).toContain("await auth.deleteUser(args.uid)");
  });

  it("does not reopen terminal deletion requests", () => {
    expect(functionsSource).toContain('["rejected", "failed", "completed"].includes(String(deletion.status))');
    expect(functionsSource).toContain("Deletion request is already in a terminal state.");
  });

  it("removes the legacy consent bypass and uses only canonical consent purposes", () => {
    expect(functionsEntry).not.toMatch(/\bupdateConsent\b/);
    expect(functionsSource).not.toContain("export const updateConsent");
    expect(functionsSource).not.toContain('policyVersion: "0.1.0-draft"');
    expect(firebaseClient).toContain('callPrivacyFunction("setCanonicalConsent"');
    expect(consentApi).toContain("CONSENT_DECISION_POLICY_VERSION");
    expect(consentApi).toContain("{ merge: false }");
    for (const purpose of [
      "memory.storage",
      "behavior.passive-context",
      "location.context",
      "inference.sensitive",
      "biometric.identity",
      "ai.personalization",
      "data.export",
      "data.monetization.anonymized"
    ]) {
      expect(consentPage).toContain(purpose);
    }
    expect(consentPage).not.toContain("audio_transcription");
    expect(consentPage).not.toContain("gps_context");
  });

  it("assigns every grant a bounded server-owned expiry", () => {
    expect(consentApi).toContain("resolveConsentExpiry");
    expect(consentApi).toContain("expiresAt: effectiveExpiresAt");
    expect(consentExpiry).toContain("MAX_CONSENT_GRANT_TTL_MS");
    expect(consentExpiry).toContain("Math.min(requestedExpiry, maximumExpiry)");
  });

  it("holds a subject-wide planning fence before deletion plan artifacts can be created", () => {
    expect(deletionMutationGuard).toContain("deletionPlanningFenceBlockReason");
    expect(deletionMutationGuard).toContain("deletionPlanningLeaseToken: token");
    expect(deletionMutationGuard).toContain('args.operation !== "execute"');
    expect(functionsSource).toContain("deletionPlanningLeaseUntil");
    expect(functionsSource).toContain("Deletion is blocked while another request prepares a subject deletion plan.");
  });

  it("binds consent receipts to server-owned notice metadata", () => {
    expect(consentApi).toContain("const CANONICAL_CONSENT_NOTICE");
    expect(consentApi).toContain("noticeVersion: CANONICAL_CONSENT_NOTICE.version");
    expect(consentApi).toContain("noticeHash: CANONICAL_CONSENT_NOTICE.hash");
    expect(consentApi).not.toContain("noticeVersion: z.string");
    expect(consentApi).not.toContain("parsed.data.noticeVersion");
    expect(consentApi).not.toContain("parsed.data.noticeHash");
  });

  it("serializes consent decisions with revocation and deletion fencing", () => {
    expect(consentApi).toContain("const decision = await db.runTransaction");
    expect(consentApi).toContain("transaction.get(recordRef)");
    expect(consentApi).toContain("transaction.get(tombstoneRef)");
    expect(consentApi).toContain("transaction.create(accessRef");
    expect(consentApi).toContain("consent decisions are blocked");
    expect(consentApi).not.toContain('db.collection("consentRecords").doc(recordId).get()');
    expect(consentApi).not.toContain("await accessRef.set");
  });

  it("fences deletion-request creation in the same transaction as its retained write", () => {
    expect(functionsSource).toContain('export const createDeletionRequest');
    expect(functionsSource).toContain('tx.get(db.collection("privacyDeletionTombstones").doc(uid))');
    expect(functionsSource).toContain('tx.create(ref');
    expect(functionsSource).toContain("new deletion requests are blocked");
  });

  it("selects expired export packages before applying cleanup page bounds", () => {
    expect(lifecycle).toContain('.where("packageExpiresAt", "<=", Timestamp.fromMillis(now))');
    expect(lifecycle).toContain('.orderBy("packageExpiresAt")');
    expect(lifecycle).toContain("backfillLegacyExportPackageExpiry");
    expect(lifecycle).toContain('privacyMaintenance").doc("exportLifecycleLegacyMigration');
    expect(lifecycle).toContain("lifecycleMigratedAt");
    expect(lifecycle).toContain('status: "cleanup_blocked"');
    expect(lifecycle).toContain('cleanupReason: "INVALID_LEGACY_EXPORT"');
  });

  it("binds revocation acknowledgements to an immutable consumer identity", () => {
    expect(consentRevocation).toContain("boundConsumerAuthority");
    expect(consentRevocation).toContain("token?.consumerId");
    expect(consentRevocation).toContain("parsed.data.consumerId !== authority.consumerId");
    expect(consentRevocation).toContain("transaction.create(ackRef");
    expect(consentRevocation).toContain("A different immutable acknowledgement already exists for this consumer.");
    expect(consentRevocation).not.toContain("transaction.set(ackRef");
  });

  it("exports every revocation acknowledgement with executable pagination and parent-event identity", () => {
    expect(functionsEntry).toContain('export { processExportRequest } from "./export-request";');
    expect(exportRequest).toContain('const revocationAcknowledgementExportKey = "consentRevocationAcknowledgements";');
    expect(exportRequest).toContain('import { collectNestedRows, collectPaginatedRows } from "./export-pagination";');
    expect(exportRequest).toContain("collectPaginatedRows<DocumentData>");
    expect(exportRequest).toContain("collectNestedRows({");
    expect(exportRequest).toContain('listSubcollectionDocuments("consentRevocationOutbox", outbox.id, "acknowledgements")');
    expect(exportRequest).toContain(".orderBy(FieldPath.documentId())");
    expect(exportRequest).toContain(".limit(limit)");
    expect(exportRequest).toContain("query = query.startAfter(cursor)");
    expect(exportRequest).toContain("eventId: outbox.id");
    expect(exportRequest).toContain("recordCount += acknowledgements.length");
    expect(exportRequest).toContain("collections[revocationAcknowledgementExportKey] = []");
    expect(exportRequest).toContain('onCall({ timeoutSeconds: 540, memory: "1GiB" }');
    expect(exportPagination).toContain("Pagination cursor did not advance.");
    expect(exportRequest).toContain('action: "export_processing_failed"');
  });

  it("removes or explicitly tracks every deterministic export artifact after failure", () => {
    expect(exportRequest).toContain('import { removeExportArtifacts } from "./export-artifact-cleanup";');
    expect(exportCleanup).toContain("export async function removeExportArtifacts");
    expect(exportCleanup).toContain("for (const path of [...cleanupTargets].reverse())");
    expect(exportRequest).toContain("delete({ ignoreNotFound: true })");
    expect(exportRequest).toContain("removeExportArtifacts([exportPath, manifestPath], deleteExportArtifact)");
    expect(exportRequest).toContain("artifactCleanupStatus: cleanupStatus");
    expect(exportRequest).toContain("artifactCleanupPendingPaths: cleanup.pendingPaths");
    expect(exportRequest).toContain("artifactCleanupFailureCount: cleanup.pendingPaths.length");
    expect(lifecycle).toContain('where("status", "==", "failed")');
    expect(lifecycle).toContain('.where("artifactCleanupStatus", "==", "incomplete")');
    expect(lifecycle).toContain('status: "artifact_cleanup"');
    expect(lifecycle).toContain("reclaimExpiredCleanupClaim(document, now)");
    expect(lifecycle).toContain('.where("artifactCleanupStatus", "==", "processing")');
    expect(lifecycle).toContain("artifactCleanupLeaseExpiresAt");
    expect(lifecycle).toContain("artifactCleanupLeaseToken: cleanupToken");
    expect(exportRequest).toContain('status === "artifact_cleanup"');
    expect(lifecycle).toContain("cleanupFailedJob(document)");
    expect(storageRules).toContain("activeExportPackage(uid, jobId)");
    expect(storageRules).toContain("packageExpiresAt > request.time");
  });

  it("does not claim privacy certification from queue counts alone", () => {
    expect(functionsSource).toContain('verdict: "evidence_incomplete"');
    expect(functionsSource).toContain('certification: "not_certified"');
    expect(functionsSource).not.toContain('? "needs_review" : "healthy"');
  });
});
