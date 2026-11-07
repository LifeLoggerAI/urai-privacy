import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync('functions/src/index.ts','utf8');
const policy = readFileSync('functions/src/deletion-document-version.ts','utf8');
test('v3 approval binds exact document update times in the plan hash',()=>{
  assert.match(s, /version:\s*z\.literal\("privacy-deletion-plan-v3"\)/);
  assert.match(s, /targetVersions:\s*z\.record/);
  assert.match(s, /targetVersions:\s*Object\.fromEntries/);
  assert.match(s, /targetVersions\[\`users\/\$\{uid\}\`\]/);
});
test('transactional deletion checks owner and version before conditional delete',()=>{
  const a=s.indexOf('async function deleteDocumentIds('), b=s.indexOf('async function executeDeletion(',a);
  assert.ok(a>0 && b>a);
  const body=s.slice(a,b);
  assert.match(body,/db\.runTransaction\(/);
  assert.match(body,/deletionDocumentBelongsToSubject\(/);
  assert.match(body,/sameDeletionDocumentVersion\(/);
  assert.match(body,/transaction\.delete\(references\[i\],\s*\{\s*lastUpdateTime:\s*snapshot\.updateTime\s*\}\)/);
  assert.doesNotMatch(body,/db\.batch\(/);
});
test('resumed plans cannot authorize replacements or new export objects',()=>{
  assert.match(s,/sameDeletionDocumentVersion\(approved\.targetVersions/);
  assert.match(s,/storageGenerationSubsetApproved\(current\.uid/);
  assert.match(s,/ifGenerationMatch:\s*generation/);
});
test('strict owner/version policy and downstream global HOLD remain included',()=>{
  assert.match(policy,/Object\.getOwnPropertyDescriptor\(value,\s*'seconds'\)/);
  assert.match(policy,/deletionDocumentBelongsToSubject/);
  const guard=readFileSync('functions/src/deletion-mutation-guard.ts','utf8');
  assert.match(guard,/deletionEcosystemCompletionBlockReason\(\)/);
});
