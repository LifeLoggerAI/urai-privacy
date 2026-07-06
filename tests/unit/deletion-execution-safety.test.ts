import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const orchestrator = readFileSync("functions/src/deletion-orchestrator.ts", "utf8");
const consentApi = readFileSync("functions/src/consent-api.ts", "utf8");

describe("deletion execution safety source contract", () => {
  it("binds adapter receipts and finalization to the active execution token", () => {
    expect(orchestrator).toContain("assertExecutionOwner(current.data(), executionToken)");
    expect(orchestrator).toContain("deletion_orchestration_stale_execution_taken_over");
    expect(orchestrator).toContain("deletion_orchestration_superseded");
    expect(orchestrator).toContain("supersededExecutionToken");
  });

  it("supports stale retry while rejecting active duplicate execution", () => {
    expect(orchestrator).toContain("!isStaleProcessingExecution(existingData)");
    expect(orchestrator).toContain("!isStaleProcessingExecution(currentData)");
    expect(orchestrator).toContain("Deletion execution is already in progress.");
  });

  it("avoids redundant user and empty storage operations", () => {
    expect(orchestrator).toContain("legalHold: await hasLegalHold(uid, userDoc)");
    expect(orchestrator).toContain("if (count > 0) await bucket.deleteFiles");
  });

  it("stores the same canonical timestamp covered by the consent receipt hash", () => {
    expect(consentApi).toContain("transaction.set(recordRef, { ...receipt, receiptHash }");
    expect(consentApi).toContain("createdAt: now");
    expect(consentApi).not.toContain("{ ...receipt, updatedAt: FieldValue.serverTimestamp(), receiptHash }");
  });
});
