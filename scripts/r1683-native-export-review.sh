#!/bin/sh
# Disposable emulator-only repeatable native export + revoked owner bearer check.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"
for name in GOOGLE_APPLICATION_CREDENTIALS FIREBASE_TOKEN RUNPOD_API_KEY VERCEL_TOKEN GITHUB_TOKEN GH_TOKEN GOOGLE_OAUTH_ACCESS_TOKEN CLOUDSDK_AUTH_ACCESS_TOKEN; do
  if printenv "$name" >/dev/null 2>&1; then
    echo "R1683_ENVIRONMENT_DENIED: inherited credential-shaped environment" >&2
    exit 7
  fi
done
if [ "${URAI_PRIVATE_MEMORY_WRITES_ENABLED:-false}" != false ] || [ "${URAI_REVIEW_ONLY:-true}" != true ]; then
  echo "R1683_ENVIRONMENT_DENIED: review mode and private-write hold required" >&2
  exit 7
fi
if [ "$(git status --porcelain --untracked-files=no)" != "" ]; then
  echo "R1683_SOURCE_DIRTY: tracked Git source differs from checkout" >&2
  exit 7
fi
export GCLOUD_PROJECT=urai-privacy-r1512-disposable
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:29099
export FIRESTORE_EMULATOR_HOST=127.0.0.1:28080
export FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:29199
npm --prefix functions run build
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec \
  --config firebase.r1683.review.json \
  --project urai-privacy-r1512-disposable \
  --only auth,functions,firestore,storage \
  "node tests/integration/r1683-export-revocation.emulator.cjs"
