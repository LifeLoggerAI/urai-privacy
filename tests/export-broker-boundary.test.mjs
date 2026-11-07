import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExportBrokerBoundary } from '../scripts/assert-export-broker-boundary.mjs';

// Minimal source fixtures only. This tests refusal and string-shape detection,
// NOT consent issuance, Firebase authority, or private-media rendering.
function safeFixture() {
  return {
    lifecycle: `export const downloadExportPackage = onRequest({ cors: true }, async () => {
      getAuth(app).verifyIdToken(bearer, true);
      readExportDownloadAuthority(transaction, currentAuth, jobId, file);
      for (let offset = 0; offset < chunk.length; offset += 64 * 1024) { yield chunk; }
    });
    const x = readExportDownloadAuthority(transaction, actorAuth, jobId, file);
    const consentReceiptHash = x.consentReceiptHash;
    const link = { requiresAuthorization: true };`,
    entry: `export { getExportDownloadUrl, downloadExportPackage, cleanupExpiredExportPackages } from './export-lifecycle-functions';`,
    actor: `const account = await auth.getUser(uid);
    const verified = await auth.verifyIdToken(bearer, true);
    if (account.disabled) throw new Error('disabled');
    const signedAdmin = verified.admin === true;
    const admin = signedAdmin && claims.admin === true;`,
    consent: 'transaction.set(deletionFenceRef, {exportConsentStatus: status, exportConsentReceiptHash: receiptHash});',
    processor: 'await actor.requireCurrent(); evaluateConsentDecision({purpose:"data.export"});',
    storage: `rules_version = '2'; match /exports/{uid}/{allPaths=**} { allow read, write: if false; }`,
    ui: `import { downloadExportPackage } from '@/lib/firebase-privacy-client'; await downloadExportPackage({jobId});`,
    client: 'fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, redirect: "error" });',
    callableClient: 'const x = fetchAuthorizedExport({url,projectId,getIdToken});',
  };
}
function rejectWhen(label, mutate, expected) {
  test(`blocks ${label}`, () => {
    const source = safeFixture();
    mutate(source);
    const result = evaluateExportBrokerBoundary(source);
    assert.equal(result.pass, false);
    assert.ok(result.failures.includes(expected), result.failures.join(', '));
  });
}
test('recognizes a fully present source shape without declaring production approval', () => {
  assert.deepEqual(evaluateExportBrokerBoundary(safeFixture()), {pass:true,failures:[]});
});
rejectWhen('legacy GCS signed URL', x => { x.lifecycle += '\nconst url = object.getSignedUrl({action:"read"});'; }, 'LEGACY_GCS_SIGNED_URL_FORBIDDEN');
rejectWhen('missing HTTP broker', x => { x.lifecycle = x.lifecycle.replace('export const downloadExportPackage = onRequest','const oldDownloadExportPackage = onCall'); }, 'AUTHENTICATED_BROKER_HANDLER_REQUIRED');
rejectWhen('missing current token check', x => { x.actor = x.actor.replace('verifyIdToken(bearer, true)', 'decodeIdToken(bearer)'); }, 'CURRENT_TOKEN_RECHECK_REQUIRED');
rejectWhen('missing per-chunk revalidation', x => { x.lifecycle = x.lifecycle.replace('readExportDownloadAuthority(transaction, currentAuth, jobId, file)', 'checkOldAuthority()'); }, 'REVALIDATION_PER_64K_CHUNK_REQUIRED');
rejectWhen('missing consent projection', x => { x.consent = 'transaction.set(deletionFenceRef, {status});'; }, 'CANONICAL_C7_PROJECTION_REQUIRED');
rejectWhen('direct Storage read allowed', x => { x.storage = 'match /exports/{uid}/{jobId}/{fileName} { allow read: if isOwner(uid); }'; }, 'DIRECT_STORAGE_EXPORT_READ_AND_WRITE_DENIAL');
rejectWhen('overlapping Storage match', x => { x.storage += '\nmatch /exports/{uid}/{other=**} { allow read: if isAdmin(); }'; }, 'DIRECT_STORAGE_EXPORT_READ_AND_WRITE_DENIAL');
rejectWhen('browser opens direct URL', x => { x.ui += '\nwindow.open(url,"_blank");'; }, 'UI_MUST_USE_BROKER_NOT_OPEN_BEARER_URL');
rejectWhen('download redirect following', x => { x.client = x.client.replace('redirect: "error"', 'redirect: "follow"'); }, 'CLIENT_BOUND_BEARER_AND_NO_REDIRECT');
rejectWhen('missing broker export', x => { x.entry = 'export {getExportDownloadUrl} from "./export-lifecycle-functions";'; }, 'BROKER_EXPORTED_FROM_DEPLOYABLE_ENTRY');
rejectWhen('missing required source file', x => { x.actor = ''; }, 'missing:functions/src/privacy-actor-guard.ts');
