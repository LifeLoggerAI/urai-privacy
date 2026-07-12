import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../functions/src/index.ts", import.meta.url), "utf8");
const guardSource = readFileSync(new URL("../../functions/src/deletion-mutation-guard.ts", import.meta.url), "utf8");
const authoritySource = readFileSync(new URL("../../functions/src/deletion-completion-authority.ts", import.meta.url), "utf8");
const consentSource = readFileSync(new URL("../../functions/src/consent-api.ts", import.meta.url), "utf8");
const auditSource = readFileSync(new URL("../../scripts/audit-tier-one.mjs", import.meta.url), "utf8");

function section(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("destructive deletion binds a stored dry-run plan and legal-hold check", () => {
  const executeSection = section(
    "export const executeDeletionRequest",
    "export const writeAuditLog"
  );
  assert.match(executeSection, /expectedPlanHash !== approvedPlanHash/);
  assert.match(executeSection, /deletionPlanHash\(approvedPlan\) !== approvedPlanHash/);
  assert.match(executeSection, /currentPlan\.legalHold/);
  assert.match(executeSection, /deletionPlanIsSubsetOfApproved/);
});

test("destructive mutation remains non-final until residual verification", () => {
  const executeSection = section(
    "export const executeDeletionRequest",
    "export const writeAuditLog"
  );
  assert.match(executeSection, /status: "processing"/);
  assert.match(executeSection, /deletionExecutionState: "verification_required"/);
  assert.match(executeSection, /deletionCompletionVerificationRequired: true/);
  assert.match(executeSection, /deletionCompletionVerificationStatus: "pending"/);
  assert.match(executeSection, /destructiveDeletionCompletedAt: FieldValue\.delete\(\)/);
  assert.match(executeSection, /action: "deletion_execute_mutation_completed"/);
  assert.match(executeSection, /verificationRequired: true/);
  assert.doesNotMatch(executeSection, /status: "completed"/);
  assert.doesNotMatch(executeSection, /action: "deletion_execute_completed"/);
});

test("the verification transaction is the sole final completion writer", () => {
  assert.match(guardSource, /Deletion completion verifier is required before destructive execution/);
  assert.match(guardSource, /status: "completed"/);
  assert.match(guardSource, /deletionExecutionState: "completed"/);
  assert.match(guardSource, /destructiveDeletionCompletedAt: Timestamp\.fromDate\(now\)/);
  assert.match(guardSource, /deletionCompletionVerified: true/);
  assert.match(guardSource, /deletionCompletionVerificationRequired: false/);
  assert.match(guardSource, /deletionCompletionVerificationStatus: "verified"/);
  assert.match(guardSource, /action: "deletion_completion_verified"/);
  assert.match(guardSource, /deletionCompletionAuthorityBlockReason/);
});

test("unverified verification_required state requires a fresh dry run before repeat execute", () => {
  assert.match(authoritySource, /function isUnverifiedDeletionCompletionState/);
  assert.match(authoritySource, /state\.deletionExecutionState === "verification_required"/);
  assert.match(guardSource, /isUnverifiedDeletionCompletionState\(state\)/);
  assert.match(guardSource, /run a new dry run before another destructive execution/);
});

test("verification authority requires the exact live execute lease and non-final state", () => {
  assert.match(authoritySource, /deletionMutationLeaseToken !== input\.leaseToken/);
  assert.match(authoritySource, /deletionMutationLeaseOperation !== "execute"/);
  assert.match(authoritySource, /deletionMutationLeaseBy !== input\.actorUid/);
  assert.match(authoritySource, /leaseUntil === null \|\| leaseUntil <= input\.nowMillis/);
  assert.match(authoritySource, /state\.status !== "processing"/);
  assert.match(authoritySource, /state\.deletionExecutionState !== "verification_required"/);
  assert.match(authoritySource, /state\.deletionCompletionVerificationRequired !== true/);
});

test("consent receipts persist the exact timestamp covered by their hash", () => {
  assert.match(consentSource, /updatedAt: now/);
  assert.match(consentSource, /const receiptHash = hash\(receipt\)/);
  assert.match(consentSource, /transaction\.set\(recordRef, \{/);
  assert.match(consentSource, /\.\.\.receipt,/);
  assert.match(consentSource, /serverUpdatedAt: FieldValue\.serverTimestamp\(\)/);
  assert.doesNotMatch(consentSource, /transaction\.set\(recordRef, \{ \.\.\.receipt, updatedAt: FieldValue\.serverTimestamp\(\)/);
});

test("Tier-One audit requires canonical consent callables and rejects the retired export", () => {
  assert.match(auditSource, /"setCanonicalConsent"/);
  assert.match(auditSource, /"evaluateCanonicalConsent"/);
  assert.match(auditSource, /Retired updateConsent callable must not reappear/);
  assert.doesNotMatch(auditSource, /"updateConsent",/);
});
