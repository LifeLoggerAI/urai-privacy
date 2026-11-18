'use strict';

// R1512: Genuine local four-Firebase-emulator callable acceptance.
// Disposable users only. No provider IAM, production writes, or destructive
// deletion execution. Protected CI and qualified review remain required.
const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const { initializeApp, deleteApp } = require('firebase/app')
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth')
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions')

const project = 'urai-privacy-r1512-disposable'
assert.equal(process.env.GCLOUD_PROJECT, project, 'Only the disposable emulator project is permitted')
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099')
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080')
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199')
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'RUNPOD_API_KEY', 'VERCEL_TOKEN']) {
  assert.ok(!process.env[key], key + ' must not be present in this test')
}

const prefix = 'r1512_' + randomBytes(6).toString('hex')
const apps = []
const checks = []
const timeout = setTimeout(() => {
  console.error('R1512_TIMEOUT')
  process.exit(1)
}, 150000)
timeout.unref()

function client(name) {
  const app = initializeApp(
    { apiKey: 'disposable-emulator-only', projectId: project, appId: '1:123:web:emulator' },
    prefix + name,
  )
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const fn = getFunctions(app, 'us-central1')
  connectFunctionsEmulator(fn, '127.0.0.1', 5001)
  return { auth, fn }
}

async function call(who, name, data = {}) {
  return (await httpsCallable(who.fn, name, { timeout: 30000 })(data)).data
}

async function run() {
  const owner = client('owner')
  const stranger = client('stranger')
  const anonymous = client('anonymous')
  const [a, b] = await Promise.all([owner, stranger].map(
    (who, i) => createUserWithEmailAndPassword(
      who.auth, prefix + i + '@example.test', 'DisposableOnly123!',
    ),
  ))
  assert.notEqual(a.user.uid, b.user.uid)
  checks.push('distinct-owner-identities')

  await assert.rejects(call(anonymous, 'createExportRequest'))
  checks.push('anonymous-export-denied')
  await assert.rejects(call(anonymous, 'createDeletionRequest'))
  checks.push('anonymous-deletion-denied')
  await assert.rejects(call(anonymous, 'setCanonicalConsent', { purpose: 'memory.storage', status: 'granted' }))
  checks.push('anonymous-consent-denied')
  await assert.rejects(call(owner, 'setCanonicalConsent', { purpose: 'unregistered', status: 'granted' }))
  checks.push('unknown-purpose-denied')

  const consent = await call(owner, 'setCanonicalConsent', {
    purpose: 'memory.storage', status: 'granted', surface: 'r1512-emulator-acceptance',
  })
  assert.equal(consent.status, 'granted')
  checks.push('canonical-consent-granted')
  const decision = await call(owner, 'evaluateCanonicalConsent', {
    purpose: 'memory.storage', correlationId: prefix + 'eval',
  })
  assert.equal(decision.allowed, true)
  checks.push('owner-consent-evaluation-allowed')
  await assert.rejects(call(stranger, 'evaluateCanonicalConsent', {
    targetUid: a.user.uid, purpose: 'memory.storage', correlationId: prefix + 'foreign',
  }))
  checks.push('foreign-consent-evaluation-denied')

  const exportRequest = await call(owner, 'createExportRequest')
  assert.equal(exportRequest.status, 'pending')
  assert.ok(exportRequest.exportJobId)
  checks.push('owner-export-request-pending')
  await assert.rejects(call(owner, 'getExportDownloadUrl', {
    jobId: exportRequest.exportJobId, file: 'export',
  }))
  checks.push('premature-download-denied')
  await assert.rejects(call(stranger, 'getExportDownloadUrl', {
    jobId: exportRequest.exportJobId, file: 'export',
  }))
  checks.push('foreign-download-denied')

  const deletionRequest = await call(owner, 'createDeletionRequest', { reason: 'User requested deletion' })
  assert.equal(deletionRequest.status, 'pending')
  assert.ok(deletionRequest.requestId)
  checks.push('owner-account-deletion-request-pending')
  assert.equal(checks.length, 12)
  assert.equal(new Set(checks).size, 12)

  console.log('R1512_CANONICAL_PRIVACY_FOUR_EMULATOR_PASS ' + JSON.stringify({
    checksPassed: checks.length, checks, source: process.env.URAI_EXACT_SHA || null,
    actualEmulators: ['Authentication', 'Functions', 'Firestore', 'Storage'],
    destructiveDeletionExecuted: false, productionWrites: false,
    independentCloudIAMVerified: false, consumerAppIntegrated: false, releaseApproved: false,
  }))
}

run().catch(error => {
  console.error('R1512_FAILURE', error.stack || String(error))
  process.exitCode = 1
}).finally(async () => {
  await Promise.all(apps.map(deleteApp))
  clearTimeout(timeout)
})
