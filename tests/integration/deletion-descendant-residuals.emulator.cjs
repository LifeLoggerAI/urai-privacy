'use strict';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const fromFunctions = createRequire(path.resolve(__dirname, '../../functions/package.json'));
const { initializeApp, deleteApp } = fromFunctions('firebase-admin/app');
const { getFirestore } = fromFunctions('firebase-admin/firestore');
const project = 'demo-urai-deletion-descendants';
assert.equal(process.env.GCLOUD_PROJECT, project);
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:18080');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:19099');
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:19201');
const app = initializeApp({ projectId: project, storageBucket: `${project}.appspot.com` });
const { collectDeletionCompletionResiduals, deletionCompletionBlockReason } = require('../../functions/lib/deletion-completion-verifier');
const { verifyLocalDeletion } = require('../../functions/lib/deletion-local-executor');
const { deletionEcosystemCompletionBlockReason } = require('../../functions/lib/deletion-contract');
const db = getFirestore(app), uid = `synthetic-${randomUUID()}`;
const root = db.doc(`users/${uid}`), orphan = root.collection('memories').doc('missing-parent').collection('parts').doc('retained');
const ordinary = root.collection('settings').doc('current');
const other = db.doc(`users/other-${uid}/settings/current`);
(async () => {
  try {
    await root.set({ uid });
    await orphan.set({ synthetic: true });
    await ordinary.set({ synthetic: true });
    await other.set({ synthetic: true });
    await root.delete();
    const residuals = await collectDeletionCompletionResiduals(uid);
    assert.deepEqual(residuals.firestoreTargets.users, []);
    assert.deepEqual(residuals.firestoreTargets.userDescendants, [orphan.path, ordinary.path].sort());
    assert.equal(residuals.totalResidualTargets, 2);
    assert.equal(deletionCompletionBlockReason(residuals).code, 'failed-precondition');
    const local = await verifyLocalDeletion(uid);
    assert.equal(local.verified, false);
    assert.equal(local.firestoreRemaining.userDescendants, 2);
    await orphan.delete(); await ordinary.delete();
    assert.equal((await collectDeletionCompletionResiduals(uid)).totalResidualTargets, 0);
    assert.equal((await verifyLocalDeletion(uid)).verified, true);
    assert.equal((await other.get()).exists, true);
    assert.notEqual(deletionEcosystemCompletionBlockReason(), '');
    console.log('DELETION_DESCENDANT_NATIVE_PASS ' + JSON.stringify({ orphanDescendantsDetected: 2, parentAbsent: true, finalCompletionBlocked: true, localFalseCleanPrevented: true, unrelatedOwnerPreserved: true, globalDeletionCertified: false }));
  } finally {
    await orphan.delete(); await ordinary.delete(); await root.delete(); await other.delete();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await db.terminate(); await deleteApp(app); });

