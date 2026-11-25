# Local Jobs/Privacy reconciliation acceptance

Emulator-only selected production exports. Do not deploy this fixture. Use sibling
`urai-jobs` with its updated `r1629-owner-request-to-privacy.emulator.cjs` script.
Build Jobs shared-types and Functions, and Privacy Functions first. Install a
Firebase CLI and Firebase browser SDK locally. The verified run reused the
sibling Spatial checkout's installed SDK and CLI. No cloud credentials are used;
the script rejects credential environment variables.

From the Privacy root in PowerShell, with the three sibling checkouts:

```powershell
npm --prefix functions run build
$env:NODE_PATH = (Resolve-Path ../urai-spatial/node_modules).Path
$env:URAI_JOBS_DELETION_SOURCE_PROJECT = 'urai-jobs-r1624-disposable'
$env:URAI_JOBS_PRIVACY_DELETION_SERVICE_UID = 'r1622-jobs-service'
node ../urai-spatial/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,functions --project urai-privacy-r1512-disposable --config firebase.genesis-jobs-review.json "node ../urai-jobs/scripts/r1629-owner-request-to-privacy.emulator.cjs"
```

The CLI supplies `GCLOUD_PROJECT`, Auth and Firestore loopback addresses. If your
environment already sets `GOOGLE_CLOUD_PROJECT` or `FIREBASE_CONFIG`, they must
match the disposable Privacy project. No production secrets may be present.

Expected: 36 checks, including real owner submission, protected Jobs execution,
authenticated delivery, independent source readback and durable reconciliation.
Jobs remains `source-partial-verified`, seven other participants remain pending,
and `globalDeletionComplete` remains false. This does not certify provider
deletion, full participant coverage, hosted delivery or production release.
