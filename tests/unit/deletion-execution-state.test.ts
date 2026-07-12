import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../functions/src/index.ts", import.meta.url), "utf8");
const guardSource = readFileSync(new URL("../../functions/src/deletion-mutation-guard.ts", import.meta.url), "utf8");
const retrySource = readFileSync(new URL("../../functions/src/deletion-retry.ts", import.meta.url), "utf8");

function section(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("deletion plans bind the request id and retention version before hashing", () => {
  const createSection = section(
    "export const createDeletionRequest",
    "export const dryRunDeletionRequest"
  );
  assert.match(createSection, /requestId: requestRef\.id/);
  assert.match(createSection, /retentionPolicyVersion/);
  assert.match(createSection, /const planHash = buildDeletionPlanHash\(plan\)/);
});

test("destructive execution fails closed on plan drift and legal hold", () => {
  const executeSection = section(
    "export const processDeletionRequest",
    "export const retryDeletionSubset"
  );
  assert.match(executeSection, /data\.planHash !== parsed\.data\.planHash/);
  assert.match(executeSection, /currentPlanHash !== parsed\.data\.planHash/);
  assert.match(executeSection, /evaluateLegalHoldsForDeletion/);
  assert.match(executeSection, /legalHold\.blocked/);
});

test("initial deletion mutation remains non-final until residual verification", () => {
  const executeSection = section(
    "export const processDeletionRequest",
    "export const retryDeletionSubset"
  );
  assert.match(executeSection, /status: failedIds\.length === 0 \? "processing" : "partial_failure"/);
  assert.match(executeSection, /deletionExecutionState: completionState/);
  assert.match(executeSection, /completionState: "verifying" \| "partial_failure"/);
  assert.match(executeSection, /deletionCompletionVerificationRequired: failedIds\.length === 0/);
  assert.match(executeSection, /deletionCompletionVerificationStatus: failedIds\.length === 0 \? "pending"/);
  assert.match(executeSection, /completedAt: deleteField/);
  assert.match(executeSection, /destructiveDeletionCompletedAt: deleteField/);
  assert.doesNotMatch(executeSection, /status: failedIds\.length === 0 \? "completed"/);
  assert.doesNotMatch(executeSection, /action: failedIds\.length === 0 \? "deletion_execution_completed"/);
});

test("subset retries preserve the same non-final verification boundary", () => {
  const retrySection = section(
    "export const retryDeletionSubset",
    "export const getPrivacyHealthReport"
  );
  assert.match(retrySection, /completionState: "verifying" \| "partial_failure"/);
  assert.match(retrySection, /status: "processing" \| "partial_failure"/);
  assert.match(retrySection, /deletionCompletionVerificationRequired: uniqueRemainingFailed\.length === 0/);
  assert.match(retrySection, /deletionCompletionVerificationStatus: uniqueRemainingFailed\.length === 0 \? "pending"/);
  assert.match(retrySection, /completedAt: deleteField/);
  assert.match(retrySection, /destructiveDeletionCompletedAt: deleteField/);
  assert.doesNotMatch(retrySection, /const status = uniqueRemainingFailed\.length === 0 \? "completed"/);
});

test("the verification transaction is the sole final completion writer", () => {
  assert.match(guardSource, /Deletion completion verifier is required before destructive execution/);
  assert.match(guardSource, /status: "completed"/);
  assert.match(guardSource, /deletionExecutionState: "completed"/);
  assert.match(guardSource, /destructiveDeletionCompletedAt: Timestamp\.fromDate\(now\)/);
  assert.match(guardSource, /deletionCompletionVerified: true/);
  assert.match(guardSource, /deletionCompletionVerificationRequired: false/);
  assert.match(guardSource, /action: "deletion_completion_verified"/);
  assert.match(guardSource, /deletionCompletionAuthorityBlockReason/);
});

test("subset retries are limited to the stored failed target set", () => {
  const retrySection = section(
    "export const retryDeletionSubset",
    "export const getPrivacyHealthReport"
  );
  assert.match(retrySection, /data\.status !== "partial_failure"/);
  assert.match(retrySection, /failedTargetIds\.includes\(targetId\)/);
  assert.match(retrySection, /evaluateLegalHoldsForDeletion/);
  assert.match(retrySection, /currentPlanHash !== parsed\.data\.planHash/);
});

test("retry helpers preserve explicit deleted, not-found, and failed outcomes", () => {
  assert.match(retrySource, /outcome: "deleted" \| "not_found" \| "failed"/);
  assert.match(retrySource, /partitionTargetsByOutcome/);
  assert.match(retrySource, /buildDeletionTargetFingerprint/);
});
