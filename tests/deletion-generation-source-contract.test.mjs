import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// This test is a source admission tripwire, not GCS provider certification.
const executor = readFileSync('functions/src/index.ts', 'utf8');
const policy = readFileSync('functions/src/deletion-storage-generation.ts', 'utf8');
test('deletion plan schema binds object generations to v2 plan hash', () => {
  assert.match(executor, /version:\s*z\.literal\("privacy-deletion-plan-v2"\)/);
  assert.match(executor, /storageObjectGenerations:\s*z\.record/);
  assert.match(executor, /storageObjectGenerations:\s*Object\.fromEntries/);
  assert.match(executor, /storageObjectGenerations\[file\.name\]\s*=\s*generation/);
});
test('deletion checks exact approved generation and uses atomic provider precondition', () => {
  assert.match(executor, /approvedStorageGeneration\(args\.uid,\s*objectName,\s*plan,\s*currentPlan\)/);
  assert.match(executor, /ifGenerationMatch:\s*generation/);
  assert.match(executor, /Number\(error\.code\)\s*===\s*412/);
  assert.doesNotMatch(executor, /bucket\.file\(objectName\)\.delete\(\{\s*ignoreNotFound:\s*true\s*\}\)/);
});
test('stale, new and replaced objects block resumed deletion', () => {
  assert.match(executor, /storageGenerationSubsetApproved\(current\.uid,\s*approved,\s*current\)/);
  assert.match(policy, /new Set\(approved\.storageObjects\)\.size/);
  assert.match(policy, /approvedStorageGeneration\(subjectUid,\s*name,\s*approved,\s*current\)/);
});
test('global downstream verification remains required', () => {
  const guard = readFileSync('functions/src/deletion-mutation-guard.ts', 'utf8');
  assert.match(guard, /deletionEcosystemCompletionBlockReason\(\)/);
  assert.match(guard, /verified:\s*false/);
});
