'use strict'

// R1545: disposable authenticated lifecycle completion acceptance.
// Emulator-only. The admin identity is created inside the disposable Auth
// emulator and receives only the test admin claim; no provider credentials,
// production data, or production writes are permitted.
const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const { initializeApp, deleteApp } = require('firebase/app')
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, getIdToken } = require('firebase/auth')
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions')
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = require('firebase-admin/app')
const { getAuth: getAdminAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')

const project = 'urai-privacy-r1512-disposable'
assert.equal(process.env.GCLOUD_PROJECT, project)
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'RUNPOD_API_KEY', 'VERCEL_TOKEN']) {
  assert.ok(!process.env[key], key + ' must not be present')
}

const prefix = 'r1545_' + randomBytes(6).toString('hex')
const apps = []
const admin = initializeAdminApp({ projectId: project }, prefix + '-admin')
const adminAuth = getAdminAuth(admin)
const db = getFirestore(admin)
const bucket = getStorage(admin).bucket()
const checks = []

function client(name) {
  const app = initializeApp(
    { apiKey: 'disposable-emulator-only', projectId: project, appId: '1:123:web:r1545' },
    prefix + name,
  )
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const functions = getFunctions(app, 'us-central1')
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  return { app, auth, functions }
}

async function call(who, name, data = {}) {
  return (await httpsCallable(who.functions, name, { timeout: 30000 })(data)).data
}

async function run() {
  const owner = client('owner')
  const operator = client('operator')
  const ownerCredential = await createUserWithEmailAndPassword(owner.auth, prefix + '-owner@example.test', 'DisposableOnly123!')
  const operatorCredential = await createUserWithEmailAndPassword(operator.auth, prefix + '-operator@example.test', 'DisposableOnly123!')
  await adminAuth.setCustomUserClaims(operatorCredential.user.uid, { admin: true, r1545DisposableOperator: true })
  await signInWithEmailAndPassword(operator.auth, prefix + '-operator@example.test', 'DisposableOnly123!')
  await getIdToken(operator.auth.currentUser, true)
  checks.push('authenticated-disposable-owner-and-operator')

  await call(owner, 'setCanonicalConsent', { purpose: 'memory.storage', status: 'granted', surface: 'r1545-lifecycle' })
  checks.push('consent-granted')
  const consent = await call(owner, 'evaluateCanonicalConsent', { purpose: 'memory.storage', correlationId: prefix + '-consent' })
  assert.equal(consent.allowed, true)
  checks.push('consent-evaluation-allowed')

  const exportRequest = await call(owner, 'createExportRequest')
  assert.equal(exportRequest.status, 'pending')
  checks.push('export-request-created')
  const exportResult = await call(operator, 'processExportRequest', { jobId: exportRequest.exportJobId })
  assert.equal(exportResult.status, 'completed')
  checks.push('export-processing-completed')
  const download = await call(owner, 'getExportDownloadUrl', { jobId: exportRequest.exportJobId, file: 'export' })
  assert.equal(typeof download.url, 'string')
  assert.ok(download.url.length > 0)
  checks.push('owner-authorized-export-download-url')
  await assert.rejects(call(client('stranger'), 'getExportDownloadUrl', { jobId: exportRequest.exportJobId, file: 'export' }))
  checks.push('foreign-export-download-denied')

  const deletionRequest = await call(owner, 'createDeletionRequest', { reason: 'R1545 disposable lifecycle' })
  assert.equal(deletionRequest.status, 'pending')
  const processed = await call(operator, 'processDeletionRequest', { requestId: deletionRequest.requestId, status: 'processing' })
  assert.equal(processed.destructiveDeletionReady, false)
  checks.push('deletion-request-and-plan-created')
  const dryRun = await call(operator, 'executeDeletionRequest', { requestId: deletionRequest.requestId, mode: 'dryRun' })
  assert.equal(dryRun.destructiveDeletionReady, true)
  assert.ok(dryRun.planHash)
  checks.push('deletion-dry-run-approved')
  const executed = await call(operator, 'executeDeletionRequest', {
    requestId: deletionRequest.requestId,
    mode: 'execute',
    expectedPlanHash: dryRun.planHash,
  })
  assert.ok(executed)
  checks.push('deletion-execution-returned')

  await assert.rejects(adminAuth.getUser(ownerCredential.user.uid))
  checks.push('deleted-auth-user-unavailable')
  const userDoc = await db.collection('users').doc(ownerCredential.user.uid).get()
  assert.equal(userDoc.exists, false)
  checks.push('deleted-user-document-absent')
  const [objects] = await bucket.getFiles({ prefix: 'exports/' + ownerCredential.user.uid + '/' })
  assert.equal(objects.length, 0)
  checks.push('deleted-export-objects-absent')

  console.log('R1545_CANONICAL_PRIVACY_LIFECYCLE_PASS ' + JSON.stringify({
    checksPassed: checks.length,
    checks,
    source: process.env.URAI_EXACT_SHA || null,
    requestVsCompletion: { export: 'completed', deletion: 'completed' },
    productionWrites: false,
    independentCloudIAMVerified: false,
    releaseApproved: false,
  }))
}

run().catch((error) => {
  console.error('R1545_LIFECYCLE_FAILURE', error.stack || String(error))
  process.exitCode = 1
}).finally(async () => {
  await Promise.all(apps.map(deleteApp))
  await deleteAdminApp(admin)
})
