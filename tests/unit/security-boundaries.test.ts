import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const functionsSource = readFileSync("functions/src/index.ts", "utf8");
const functionsEntry = readFileSync("functions/src/functions-entry.ts", "utf8");
const exportRequest = readFileSync("functions/src/export-request.ts", "utf8");
const exportPagination = readFileSync("functions/src/export-pagination.ts", "utf8");
const exportCleanup = readFileSync("functions/src/export-artifact-cleanup.ts", "utf8");
const consentApi = readFileSync("functions/src/consent-api.ts", "utf8");
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
    expect(functionsSource).toContain("approvedDeletionPlan");
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
    expect(functionsSource).toContain('["completed", "rejected", "failed"].includes(String(deletion.status))');
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
