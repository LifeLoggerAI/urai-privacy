import { pathToFileURL } from 'node:url'

export function assertCallableLoaded(response, body) {
  if (response.status !== 401 || body?.error?.status !== 'UNAUTHENTICATED') {
    throw new Error('Functions emulator did not load the protected createExportRequest callable')
  }
}

async function main() {
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!/^127\.0\.0\.1:\d+$/.test(process.env[name] || '')) {
      throw new Error('Local Firebase emulator authority is required: ' + name)
    }
  }
  // Exact configured local project/port. No token, private input, or live URL.
  const response = await fetch('http://127.0.0.1:5001/urai-privacy-integration-test/us-central1/createExportRequest', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: {} }), signal: AbortSignal.timeout(10000),
  })
  const body = await response.json()
  assertCallableLoaded(response, body)
  console.log('PASS: loaded createExportRequest rejects unauthenticated emulator request')
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
