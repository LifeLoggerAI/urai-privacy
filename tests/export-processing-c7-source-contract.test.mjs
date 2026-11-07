import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('functions/src/export-request.ts','utf8');
const claim=s.slice(s.indexOf('const claim = await db.runTransaction'),s.indexOf('const { exportPath, manifestPath } = claim;'));
const during=s.slice(s.indexOf('const requireCurrent = async () =>'),s.indexOf('  try {\n    const exportData'));
const publish=s.slice(s.indexOf('const auditRef = db.collection("auditLogs").doc();',s.indexOf('const requireCurrent = async ()')),s.indexOf('    return { jobId, status: "completed"'));
test('worker claim checks request state and consent projection before any writes',()=>{
 assert.match(claim,/exportProcessingRequestStateBlockReason\(/);
 assert.match(claim,/exportRequestAdmissionBlockReason\(/);
 assert.ok(claim.indexOf('if (stateBlocked)') < claim.indexOf('tx.set(deletionFenceRef'));
 assert.ok(claim.indexOf('if (admission)') < claim.indexOf('tx.set(deletionFenceRef'));
});
test('a processor never creates or repairs positive C7 projection fields',()=>{
 assert.doesNotMatch(claim,/exportConsentStatus:\s*"granted"/);
 assert.doesNotMatch(claim,/exportConsentReceiptHash:\s*consentReceiptHash\s*,/);
 assert.doesNotMatch(claim,/exportConsentPolicyVersion:\s*consent.policyVersion/);
});
test('every collection authority recheck binds canonical C7 to projection',()=>{
 assert.match(during,/exportRequestAdmissionBlockReason\(/);
 assert.match(during,/checkedLifeMovieDeletionState\(fence\)/);
 assert.match(during,/consent.receiptHash !== claim.consentReceiptHash/);
});
test('final publication also denies revoked or mismatched C7 projection',()=>{
 assert.match(publish,/exportRequestAdmissionBlockReason\(/);
 assert.match(publish,/checkedLifeMovieDeletionState\(deletionFence\)/);
 assert.match(publish,/consent.receiptHash !== claim.consentReceiptHash/);
});
test('processing attempt token, ledger and cleanup are preserved',()=>{
 assert.match(claim,/exportProcessingLeaseToken:\s*token/);
 assert.match(claim,/tx.create\(attemptRef/);
 assert.match(s,/exportPublicationBlockReason\(/);
 assert.match(s,/removeExportArtifacts\(/);
});
