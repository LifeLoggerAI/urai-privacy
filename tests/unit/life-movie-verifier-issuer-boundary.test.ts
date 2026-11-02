import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Source-only guard: a candidate is never a signed issuer or live grant. */
const consentApi = readFileSync("functions/src/consent-api.ts", "utf8");
const assembler = readFileSync("functions/src/life-movie-scoped-grant-assembler.ts", "utf8");
const functionsEntry = readFileSync("functions/src/index.ts", "utf8");

describe("Life Movie issuer / verifier separation stays closed", () => {
  it("keeps the grant assembler out of public Functions entry and callable handlers", () => {
    expect(functionsEntry).not.toContain("assembleLifeMovieScopedGrantProposal");
    expect(consentApi).not.toContain("assembleLifeMovieScopedGrantProposal");
    expect(assembler).not.toMatch(/\bonCall\s*\(|\bonRequest\s*\(|\.runTransaction\s*\(/);
  });
  it("rechecks active dedicated Jobs identity before reading any grant", () => {
    const start = consentApi.indexOf("export const verifyLifeMovieRenderConsent = onCall");
    const end = consentApi.indexOf("const parsed = lifeMovieVerificationSchema", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const guard = consentApi.slice(start, end);
    expect(guard).toContain("isTrustedJobsConsentCaller");
    expect(guard).toContain("isTrustedActiveJobsConsentCaller");
    expect(guard).toContain("if (!currentJobsIdentity)");
  });
  it("reads current consent and deletion tombstone within one Firestore transaction", () => {
    const start = consentApi.indexOf("const lifeMovieVerificationSchema");
    const block = consentApi.slice(start);
    expect(block).toContain('db.collection("consentRecords").doc(recordId)');
    expect(block).toContain('db.collection("privacyDeletionTombstones").doc(subjectUid)');
    const transaction = block.indexOf("db.runTransaction(async (transaction) =>");
    expect(transaction).toBeGreaterThanOrEqual(0);
    const body = block.slice(transaction);
    expect(body).toContain("transaction.get(recordRef)");
    expect(body).toContain("transaction.get(tombstoneRef)");
    expect(body).toContain("evaluateLifeMovieRenderAuthorization");
    expect(body).toContain("transaction.create(accessRef");
    expect(body).toContain('decision: allowed ? "allow" : "deny"');
  });
  it("never turns an audit event into a reusable grant", () => {
    const start = consentApi.indexOf("export const verifyLifeMovieRenderConsent = onCall");
    const block = consentApi.slice(start);
    expect(block).toContain("receiptHash: allowed ? decisionReceiptId : null");
    expect(block).not.toContain("transaction.set(recordRef");
    expect(block).not.toContain("transaction.create(recordRef");
    expect(block).not.toContain("assembleLifeMovieScopedGrantProposal");
  });
});
