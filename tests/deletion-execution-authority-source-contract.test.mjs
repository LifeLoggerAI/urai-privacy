import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('functions/src/index.ts','utf8');
const actor=readFileSync('functions/src/privacy-actor-guard.ts','utf8');
const bound=source.slice(source.indexOf('export const executeDeletionRequest ='),source.indexOf('export const writeAuditLog ='));
const fn=source.slice(source.indexOf('async function executeDeletion('),source.indexOf('export const createExportRequest ='));
const docs=source.slice(source.indexOf('async function deleteDocumentIds('),source.indexOf('async function executeDeletion('));
test('deletion plan v4 binds subject Auth account creation incarnation',()=>{
 assert.match(source,/version:\s*z\.literal\("privacy-deletion-plan-v4"\)/);
 assert.match(source,/authAccountCreatedAt:\s*await deletionAuthAccountCreatedAt\(uid\)/);
 assert.match(source,/current\.authAccountCreatedAt !== approved\.authAccountCreatedAt/);
});
test('the privileged call requires current Auth and signed admin claims',()=>{
 assert.match(bound,/createPrivacyActorGuard\(request,\s*true\)/);
 assert.match(actor,/verifyIdToken\(bearer,\s*true\)/);
 assert.match(actor,/account\.disabled/);
 assert.match(actor,/signedAdmin/);
});
test('deletion execution requires matching mutation and execution attempt tokens',()=>{
 assert.match(bound,/deletionMutationLeaseToken !== mutationToken/);
 assert.match(bound,/deletionExecutionAttemptToken:\s*authority\.binding\.token/);
 assert.match(source,/deletionExecutionAuthorityBlockReason\(/);
 assert.match(source,/transaction\.get\(db\.collection\("privacyDeletionTombstones"\)/);
 assert.match(source,/transaction\.get\(db\.collection\("legalHoldRecords"\)/);
});
test('Firestore read-verify-delete and GCS object deletion both require fresh authority',()=>{
 assert.match(docs,/await requireCurrentDeletionExecution\(authority,\s*transaction\)/);
 assert.match(docs,/await authority\.actor\.requireCurrent\(\)/);
 assert.match(docs,/lastUpdateTime:\s*snapshot\.updateTime/);
 assert.match(fn,/await requireCurrentDeletionExecution\(authority\);\s*await bucket\.file\(objectName\)\.delete\(\{\s*ignoreNotFound:\s*true,\s*ifGenerationMatch:\s*generation\s*\}\)/);
});
test('Auth deletion and success transition revalidate live authority',()=>{
 assert.match(fn,/deletionAuthAccountCreatedAt\(args\.uid\) !== plan\.authAccountCreatedAt/);
 assert.match(fn,/await auth\.deleteUser\(args\.uid\);\s*await requireCurrentDeletionExecution\(authority\)/);
 assert.match(bound,/await db\.runTransaction\(async \(tx\) => \{\s*await requireCurrentDeletionExecution\(authority,\s*tx\);\s*tx\.update\(ref/);
});
test('failed old attempts do not mutate a replacement execution',()=>{
 assert.match(bound,/current\.data\(\)\?\.deletionExecutionAttemptToken !== authority\.binding\.token/);
 assert.match(bound,/current\.data\(\)\?\.deletionExecutionState !== "executing"/);
});
test('global deletion completion remains independent and blocked',()=>{
 const guard=readFileSync('functions/src/deletion-mutation-guard.ts','utf8');
 assert.match(guard,/deletionEcosystemCompletionBlockReason\(\)/);
 assert.match(guard,/deletionCompletionVerificationRequired:\s*true/);
});
