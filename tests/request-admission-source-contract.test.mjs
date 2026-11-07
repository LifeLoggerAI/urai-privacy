import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('functions/src/index.ts','utf8');
const source=readFileSync('functions/src/request-admission-policy.ts','utf8');
const exportHandler=s.slice(s.indexOf('export const createExportRequest ='),s.indexOf('// Legacy unsafely exposed'));
const deletionHandler=s.slice(s.indexOf('export const createDeletionRequest ='),s.indexOf('export const processDeletionRequest ='));
test('export creation uses current signed actor rather than stale callable auth',()=>{
  assert.match(exportHandler,/createPrivacyActorGuard\(request\)/);
  assert.match(exportHandler,/await actor\.requireCurrent\(\)/);
});
test('export creation reads owner consent and tombstone in same transaction',()=>{
  assert.match(exportHandler,/db\.runTransaction\(async \(tx\)/);
  assert.match(exportHandler,/tx\.get\(db\.collection\("privacyDeletionTombstones"\)\.doc\(uid\)\)/);
  assert.match(exportHandler,/tx\.get\(db\.collection\("consentRecords"\)\.doc\(\`\$\{uid\}_data_export\`\)\)/);
  assert.match(exportHandler,/checkedLifeMovieDeletionState\(deletionFence\)/);
});
test('export admission checks current C7 consent and projection before job writes',()=>{
  assert.match(exportHandler,/exportRequestAdmissionBlockReason\(/);
  assert.match(exportHandler,/evaluateConsentDecision\(\{\s*purpose:\s*"data\.export"/);
  assert.match(exportHandler,/CONSENT_DECISION_POLICY_VERSION/);
  const validate=exportHandler.indexOf('if (admitted ||');
  const create=exportHandler.indexOf('tx.set(reqRef');
  assert.ok(validate>=0 && create>validate);
  assert.ok(exportHandler.indexOf('await actor.requireCurrent()',validate)<create);
});
test('deletion request remains accessible without C7 export consent',()=>{
  assert.match(deletionHandler,/deletionRequestAdmissionBlockReason\(/);
  assert.match(deletionHandler,/checkedLifeMovieDeletionState\(deletionFence\)/);
  assert.doesNotMatch(deletionHandler,/exportRequestAdmissionBlockReason|evaluateConsentDecision|data\.export/);
});
test('deletion creation authenticates before guarded transaction writes',()=>{
  assert.match(deletionHandler,/createPrivacyActorGuard\(request\)/);
  const deny=deletionHandler.indexOf('if (blockReason)');
  const write=deletionHandler.indexOf('tx.create(ref');
  assert.ok(deny>=0 && deny<write);
  assert.ok(deletionHandler.indexOf('await actor.requireCurrent()',deny)<write);
});
test('pure policy denies expired or misbound C7 projections',()=>{
  assert.match(source,/canonical_c7_not_current/);
  assert.match(source,/c7_receipt_projection_mismatch/);
  assert.match(source,/c7_expired_or_projection_expiry_mismatch/);
  assert.match(source,/malformed_or_foreign_deletion_fence/);
});
