'use strict'

// Local review patch against PR323 a1d279275749ab85728b2fc3555c98b5870cd289.
// Native disposable-emulator acceptance only; never a security certification.
const assert = require('node:assert/strict')
const { randomBytes, createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const { resolve } = require('node:path')
const { exactErrorCode, assertTerminalDeletion, buildReceipt } = require('./r1545-lifecycle-assertions.cjs')

const project = 'urai-privacy-r1512-disposable'
const sourceRoot = resolve(__dirname, '../..')
const backendSource = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim()
assert.match(backendSource, /^[0-9a-f]{40}$/)
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: sourceRoot, encoding: 'utf8' }).trim(), '', 'Tracked checkout must be clean')
assert.equal(process.env.GCLOUD_PROJECT, project)
assert.equal(process.env.URAI_EXACT_SHA, backendSource, 'Native runner pin must equal the actual Git checkout')
for (const [key, value] of Object.entries({
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
})) assert.equal(process.env[key], value, key + ' must target the isolated emulator')
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'RUNPOD_API_KEY', 'VERCEL_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN', 'GOOGLE_OAUTH_ACCESS_TOKEN', 'CLOUDSDK_AUTH_ACCESS_TOKEN', 'NODE_OPTIONS']) {
  assert.ok(!process.env[key], key + ' must not be present')
}
// No owner signing request: it can reach provider metadata despite Storage emulation.
// An arbitrary callable error must never be relabeled as a signer limitation.
const { initializeApp, deleteApp } = require('firebase/app')
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth')
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions')
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = require('firebase-admin/app')
const { getAuth: getAdminAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')

const prefix = 'r1545_' + randomBytes(6).toString('hex')
const apps = [], checks = []
const phases = { exportRequest: 'not-started', exportPackage: 'not-verified', deletionRequest: 'not-started', deletionMutation: 'not-started', deletion: 'not-verified', postDeletionFence: 'not-tested' }
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
let admin
function receipt(failed) {
  console.log('R1545_CANONICAL_PRIVACY_LIFECYCLE_RESULT ' + JSON.stringify(buildReceipt({
    checks, phases, failed, source: backendSource,
    harnessSha256: digest(readFileSync(__filename)),
    helperSha256: digest(readFileSync(require.resolve('./r1545-lifecycle-assertions.cjs'))),
  })))
}
function client(name) {
  const app = initializeApp({ apiKey: 'disposable-emulator-only', projectId: project, appId: '1:123:web:r1545' }, prefix + name)
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const functions = getFunctions(app, 'us-central1')
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  return { auth, functions }
}
async function call(who, name, data = {}) {
  return (await httpsCallable(who.functions, name, { timeout: 30000 })(data)).data
}
async function run() {
  admin = initializeAdminApp({ projectId: project, storageBucket: project + '.appspot.com' }, prefix + '-admin')
  const adminAuth = getAdminAuth(admin), db = getFirestore(admin), bucket = getStorage(admin).bucket()
  const owner = client('owner'), operator = client('operator'), stranger = client('stranger')
  const identities = await Promise.all([owner, operator, stranger].map((who, i) =>
    createUserWithEmailAndPassword(who.auth, prefix + i + '@example.test', 'DisposableOnly123!')))
  const uid = identities[0].user.uid, operatorUid = identities[1].user.uid, strangerUid = identities[2].user.uid
  assert.equal(new Set([uid, operatorUid, strangerUid]).size, 3)
  await adminAuth.setCustomUserClaims(operatorUid, { admin: true, r1545DisposableOperator: true })
  await signInWithEmailAndPassword(operator.auth, prefix + '1@example.test', 'DisposableOnly123!')
  assert.equal((await operator.auth.currentUser.getIdTokenResult(true)).claims.admin, true)
  checks.push('distinct-authenticated-identities-and-emulator-operator-claim')

  const userRef = db.collection('users').doc(uid), strangerRef = db.collection('users').doc(strangerUid)
  const marker = prefix + '-owner-record', foreignMarker = prefix + '-foreign-record'
  await userRef.set({ uid, memo: marker, secretToken: 'SYNTHETIC_DO_NOT_EXPORT' })
  await strangerRef.set({ uid: strangerUid, memo: foreignMarker })
  assert.equal((await userRef.get()).data()?.memo, marker)
  assert.equal((await strangerRef.get()).data()?.memo, foreignMarker)
  checks.push('owner-and-foreign-records-seeded-and-read-back')
  const grant = await call(owner, 'setCanonicalConsent', { purpose: 'memory.storage', status: 'granted', surface: 'r1545-lifecycle' })
  assert.equal(grant.status, 'granted')
  assert.equal((await call(owner, 'evaluateCanonicalConsent', { purpose: 'memory.storage', correlationId: prefix + '-grant' })).allowed, true)
  await assert.rejects(call(stranger, 'evaluateCanonicalConsent', { targetUid: uid, purpose: 'memory.storage', correlationId: prefix + '-foreign' }), exactErrorCode('functions/permission-denied'))
  assert.equal((await call(owner, 'setCanonicalConsent', { purpose: 'memory.storage', status: 'revoked', surface: 'r1545-lifecycle' })).status, 'revoked')
  assert.equal((await call(owner, 'evaluateCanonicalConsent', { purpose: 'memory.storage', correlationId: prefix + '-revoked' })).allowed, false)
  checks.push('consent-grant-owner-isolation-and-revocation-denial')

  const exportRequest = await call(owner, 'createExportRequest')
  assert.equal(exportRequest.status, 'pending')
  assert.ok(exportRequest.exportJobId)
  phases.exportRequest = 'pending'
  await assert.rejects(call(owner, 'processExportRequest', { jobId: exportRequest.exportJobId }), exactErrorCode('functions/permission-denied'))
  const exportResult = await call(operator, 'processExportRequest', { jobId: exportRequest.exportJobId })
  assert.equal(exportResult.status, 'completed')
  const job = (await db.collection('exportJobs').doc(exportRequest.exportJobId).get()).data()
  assert.equal(job?.status, 'completed'); assert.equal(job.complete, true); assert.equal(job.uid, uid)
  const request = (await db.collection('privacyRequests').doc(job.requestId).get()).data()
  assert.equal(request?.status, 'completed'); assert.equal(request.uid, uid)
  const exportPrefix = 'exports/' + uid + '/' + exportRequest.exportJobId + '/'
  assert.equal(job.exportPackagePath, exportPrefix + 'export.json')
  assert.equal(job.exportManifestPath, exportPrefix + 'manifest.json')
  const [exportBytes] = await bucket.file(job.exportPackagePath).download()
  const [manifestBytes] = await bucket.file(job.exportManifestPath).download()
  assert.equal(digest(exportBytes), job.exportSha256)
  assert.equal(digest(manifestBytes), job.manifestSha256)
  const exported = JSON.parse(exportBytes), manifest = JSON.parse(manifestBytes)
  assert.equal(exported.uid, uid); assert.equal(manifest.uid, uid)
  assert.equal(exported.data.users[0].memo, marker)
  assert.ok(!exportBytes.toString().includes('SYNTHETIC_DO_NOT_EXPORT'))
  assert.ok(!exportBytes.toString().includes(foreignMarker))
  assert.equal(manifest.files[0].sha256, job.exportSha256)
  await assert.rejects(call(stranger, 'getExportDownloadUrl', { jobId: exportRequest.exportJobId, file: 'export' }), exactErrorCode('functions/permission-denied'))
  phases.exportRequest = 'completed'; phases.exportPackage = 'completed-and-admin-storage-bytes-verified'
  checks.push('export-terminal-records-package-hashes-content-redaction-and-foreign-denial')

  const deletionRequest = await call(owner, 'createDeletionRequest', { reason: 'R1545 disposable lifecycle' })
  assert.equal(deletionRequest.status, 'pending'); assert.ok(deletionRequest.requestId)
  const requestId = deletionRequest.requestId
  phases.deletionRequest = 'pending'
  const processed = await call(operator, 'processDeletionRequest', { requestId, status: 'processing' })
  assert.equal(processed.status, 'processing'); assert.equal(processed.destructiveDeletionReady, false)
  const dryRun = await call(operator, 'executeDeletionRequest', { requestId, mode: 'dryRun' })
  assert.equal(dryRun.destructiveDeletionReady, true)
  assert.match(dryRun.planHash, /^[0-9a-f]{64}$/)
  assert.deepEqual(dryRun.plan.targets.users, [uid], 'Seeded user must be in approved deletion targets')
  assert.ok(dryRun.plan.storageObjects.includes(job.exportPackagePath))
  assert.ok(dryRun.plan.storageObjects.includes(job.exportManifestPath))
  checks.push('deletion-approved-plan-includes-seeded-record-and-export')
  const executed = await call(operator, 'executeDeletionRequest', { requestId, mode: 'execute', expectedPlanHash: dryRun.planHash })
  // The guarded entry point returns the inner mutation result unchanged, then
  // verifies completion before resolving. Only persisted evidence proves finality.
  assert.equal(executed.requestId, requestId); assert.equal(executed.status, 'processing')
  assert.equal(executed.mode, 'execute'); assert.equal(executed.planHash, dryRun.planHash)
  assert.equal(executed.verificationRequired, true)
  phases.deletionMutation = 'returned-awaiting-terminal-readback'
  const record = (await db.collection('deletionRequests').doc(requestId).get()).data()
  assert.ok(record?.deletionCompletionVerificationAuditId, 'Missing completion-verification audit linkage')
  const audit = (await db.collection('auditLogs').doc(record.deletionCompletionVerificationAuditId).get()).data()
  const tombstone = (await db.collection('privacyDeletionTombstones').doc(uid).get()).data()
  assertTerminalDeletion({ record, tombstone, audit, uid, requestId, operatorUid })
  await assert.rejects(adminAuth.getUser(uid), exactErrorCode('auth/user-not-found'))
  assert.equal((await userRef.get()).exists, false)
  for (const collection of ['privacyRequests', 'exportJobs', 'consentRecords', 'dataAccessEvents']) {
    assert.equal((await db.collection(collection).where('uid', '==', uid).get()).empty, true, collection + ' has residual records')
  }
  for (const objectPrefix of ['exports/' + uid + '/', 'privacy-deletion-plans/' + digest(uid) + '/']) {
    assert.equal((await bucket.getFiles({ prefix: objectPrefix }))[0].length, 0)
  }
  assert.equal((await strangerRef.get()).data()?.memo, foreignMarker)
  assert.equal((await adminAuth.getUser(strangerUid)).uid, strangerUid)
  phases.deletionRequest = 'completed'; phases.deletionMutation = 'completed'
  phases.deletion = 'completed-verified-for-canonical-emulator-scope'
  checks.push('terminal-deletion-readback-linked-audit-tombstone-and-residuals-verified')
  // Existing cached owner token must not recreate consent through the fence.
  await assert.rejects(call(owner, 'setCanonicalConsent', { purpose: 'memory.storage', status: 'granted', surface: 'r1545-post-delete' }), exactErrorCode('functions/failed-precondition'))
  phases.postDeletionFence = 'consent-recreation-denied'
  checks.push('post-deletion-consent-recreation-denied')
}
const deadline = setTimeout(() => { receipt(true); console.error('R1545_LIFECYCLE_TIMEOUT'); process.exit(1) }, 180000)
deadline.unref()
run().then(() => receipt(false)).catch(error => {
  receipt(true)
  // No error is swallowed or converted into a signing blocker.
  console.error('R1545_LIFECYCLE_FAILURE', error.code || error.name, error.message)
  process.exitCode = 1
}).finally(async () => {
  clearTimeout(deadline)
  await Promise.all(apps.map(deleteApp))
  if (admin) await deleteAdminApp(admin)
}).catch(error => { console.error('R1545_CLEANUP_FAILURE', error.code || error.name); process.exitCode = 1 })
